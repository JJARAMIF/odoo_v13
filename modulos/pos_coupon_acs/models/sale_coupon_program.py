# -*- coding: utf-8 -*-
# Part of Odoo. See COPYRIGHT & LICENSE files for full copyright and licensing details.

from odoo.tools.safe_eval import safe_eval
from odoo.exceptions import ValidationError
from odoo import api, fields, models, _


class SaleCouponProgram(models.Model):
    _inherit = 'sale.coupon.program'

    @api.depends('sale_order_count', 'pos_order_count')
    def _compute_order_count(self):
        for program in self:
            if program.used_in == 'sale':
                program.order_count = program.sale_order_count
            elif program.used_in == 'pos':
                program.order_count = program.pos_order_count
            else:
                program.order_count += (program.sale_order_count + program.pos_order_count)

    @api.depends('pos_order_line_ids.product_id')
    def _compute_sale_order_count(self):
        product_data = self.env['sale.order.line'].read_group([('product_id', 'in', self.mapped('discount_line_product_id').ids)], ['product_id'], ['product_id'])
        mapped_data = dict([(m['product_id'][0], m['product_id_count']) for m in product_data])
        for program in self:
            program.sale_order_count = mapped_data.get(program.discount_line_product_id.id, 0)

    @api.depends('pos_order_line_ids.product_id')
    def _compute_pos_order_count(self):
        product_data = self.env['pos.order.line'].read_group([('product_id', 'in', self.mapped('discount_line_product_id').ids)], ['product_id'], ['product_id'])
        mapped_data = dict([(m['product_id'][0], m['product_id_count']) for m in product_data])
        for program in self:
            program.pos_order_count = mapped_data.get(program.discount_line_product_id.id, 0)

    used_in = fields.Selection([('sale', "Sale"),
        ('pos', "Point of Sale"),
        ('all', "Both")], string='Available For', default='sale')
    pos_order_line_ids = fields.Many2many('pos.order.line', store=False, search='_search_pos_order_line_ids')
    sale_order_count = fields.Integer(compute='_compute_sale_order_count')
    pos_order_count = fields.Integer(compute='_compute_pos_order_count')
    order_count = fields.Integer(compute='_compute_order_count')

    def _search_pos_order_line_ids(self, operator, arg):
        # just a hack to enable the invalidation of 'pos_order_count'
        return []

    @api.model
    def create(self, vals):
        res = super(SaleCouponProgram, self).create(vals)
        if res.discount_line_product_id and res.used_in in ('pos', 'all'):
            res.discount_line_product_id.write({
                    'sale_ok': True,
                    'available_in_pos': True
                })
        return res

    def write(self, vals):
        for rec in self:
            if vals.get('used_in') and vals.get('used_in') in ('pos', 'all'):
                discount_line_product_id = self.env['product.product'].browse(vals.get('discount_line_product_id', rec.discount_line_product_id.id))
                discount_line_product_id.write({
                        'sale_ok': True,
                        'available_in_pos': True
                    })
        return super(SaleCouponProgram, self).write(vals)

    @api.constrains('reward_type', 'used_in')
    def _check_reward_type(self):
        if self.used_in and self.used_in in ('pos', 'all') and self.reward_type == "free_shipping":
            raise ValidationError(_("You can\'t configure free shipping for because this rule is configure for POS."))

    @api.model
    def _filter_programs_by_used_in_sale(self):
        '''Filter program which used not for point of sale'''
        return self.filtered(lambda program: program.used_in in ('sale', 'all'))

    @api.model
    def _filter_programs_from_common_rules(self, order, next_order=False):
        programs = super(SaleCouponProgram, self)._filter_programs_from_common_rules(order, next_order=next_order)
        programs = programs._filter_programs_by_used_in_sale()
        return programs

    def compute_pos_program_amount(self, field, currency_to):
        self.ensure_one()
        return self._compute_program_amount(field, self.env['res.currency'].browse(currency_to))

    def is_valid_product(self, product):
        return self._is_valid_product(self.env['product.product'].browse(product))

    def is_valid_partner(self, partner):
        return self._is_valid_partner(self.env['res.partner'].browse(partner))

    @api.model
    def get_valid_partner_pos(self):
        result = {}
        partner = self.env['res.partner']
        for program in self.search([('active', '=', True), ('used_in', 'in', ('pos', 'all'))]):
            result[program.id] = partner.search(safe_eval(program.rule_partners_domain or "[]")).ids
        return result

    @api.model
    def check_pos_coupon(self, code, order, partner):
        result = {"is_valid_coupon": False, "is_valid_partner": False, "currency_rate": 0.0, "valid_products": []}

        def check_partner_domain(program_id):
            return (not safe_eval(program_id.rule_partners_domain or "[]") and not partner)

        program_id = self.env['sale.coupon.program'].search([('promo_code_usage', '=', 'code_needed'), ('promo_code', '=', code)])
        if program_id:
            result["is_valid_coupon"] = True
            result["currency_rate"] = program_id.currency_id and program_id.currency_id.rate or 0.0
            if bool(partner):
                result["is_valid_partner"] = program_id._is_valid_partner(self.env['res.partner'].browse(partner))
            else:
                result["is_valid_partner"] = check_partner_domain(program_id)
            if order.get('lines'):
                for line in order['lines']:
                    if program_id._is_valid_product(self.env['product.product'].browse(line[2]['product_id'])):
                        if not line[2]['product_id'] in result['valid_products']:
                            result['valid_products'].append(line[2]['product_id'])
            return result
        coupon_id = self.env['sale.coupon'].search([('code', '=', code), ('state', '=', 'new')], limit=1)
        if coupon_id:
            result["is_valid_coupon"] = True
            result["currency_rate"] = coupon_id.program_id.currency_id and coupon_id.program_id.currency_id.rate or 0.0
            result["is_valid_partner"] = coupon_id.program_id._is_valid_partner(self.env['res.partner'].browse(partner))
            if order.get('lines'):
                for line in order['lines']:
                    if coupon_id.program_id._is_valid_product(self.env['product.product'].browse(line[2]['product_id'])):
                        if not line[2]['product_id'] in result['valid_products']:
                            result['valid_products'].append(line[2]['product_id'])
            return result
        return result

    def get_valid_products_on_programs(self, order, partner):
        res, res2 = dict(), dict()
        for program in self:
            res[program.id] = []
            res2[program.id] = program._is_valid_partner(self.env['res.partner'].browse(partner))
            if order.get('lines'):
                for line in order['lines']:
                    if program._is_valid_product(self.env['product.product'].browse(line[2]['product_id'])):
                        if not line[2]['product_id'] in res[program.id]:
                            res[program.id].append(line[2]['product_id'])
        return [res, res2]

    def action_view_pos_orders(self):
        self.ensure_one()
        orders = self.env['pos.order.line'].search([('product_id', '=', self.discount_line_product_id.id)]).mapped('order_id')
        return {
            'name': _('Pos Orders'),
            'view_mode': 'tree,form',
            'res_model': 'pos.order',
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', orders.ids)]
        }
