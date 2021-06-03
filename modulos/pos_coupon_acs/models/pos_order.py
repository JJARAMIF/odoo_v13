# -*- coding: utf-8 -*-
# Part of Odoo. See COPYRIGHT & LICENSE files for full copyright and licensing details.

from odoo import api, fields, models, _


class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.depends('lines', 'lines.price_subtotal')
    def _compute_reward_total(self):
        for order in self:
            order.reward_amount = sum([line.price_subtotal for line in order._get_reward_lines()])

    @api.depends('lines', 'lines.product_id', 'lines.qty', 'lines.price_subtotal', 'applied_coupon_ids', 'no_code_promo_program_ids', 'code_promo_program_id')
    def _compute_applied_coupon_promo_amount(self):
        for order in self:
            for line in order.lines.filtered(lambda line: line.is_reward_line):
                if line.product_id.id in order.applied_coupon_ids.mapped('discount_line_product_id').ids:
                    order.amount_applied_coupons_total += abs(line.price_subtotal)
                if line.product_id.id in (order.no_code_promo_program_ids + order.code_promo_program_id).mapped('discount_line_product_id').ids:
                    order.amount_applied_promo_total += abs(line.price_subtotal)

    @api.depends('lines')
    def _count_lines(self):
        self.count_lines = len(self.lines)

    count_lines = fields.Integer(string="Order Line", compute="_count_lines", store=True)
    applied_coupon_ids = fields.One2many('sale.coupon', 'pos_order_id', string="Applied Coupons", copy=False)
    generated_coupon_ids = fields.One2many('sale.coupon', 'pos_order_id', string="Offered Coupons", copy=False)
    reward_amount = fields.Float(compute='_compute_reward_total')
    no_code_promo_program_ids = fields.Many2many('sale.coupon.program', string="Applied Immediate Promo Programs",
        domain=[('promo_code_usage', '=', 'no_code_needed')], copy=False)
    code_promo_program_id = fields.Many2one('sale.coupon.program', string="Applied Promo Program",
        domain=[('promo_code_usage', '=', 'code_needed')], copy=False)
    promo_code = fields.Char(related='code_promo_program_id.promo_code', help="Applied program code", readonly=False)
    amount_applied_coupons_total = fields.Float(string='Total Amount Applied Coupons', compute='_compute_applied_coupon_promo_amount', store=True)
    amount_applied_promo_total = fields.Float(string='Total Amount Applied Promotions', compute='_compute_applied_coupon_promo_amount', store=True)

    def _get_reward_lines(self):
        self.ensure_one()
        return self.lines.filtered(lambda line: line.is_reward_line)

    @api.model
    def _order_fields(self, ui_order):
        order_fields = super(PosOrder, self)._order_fields(ui_order)
        order_fields['code_promo_program_id'] = ui_order.get('code_promo_program_id', False)
        return order_fields

    @api.model
    def _process_order(self, order, draft, existing_order):
        pos_order = super(PosOrder, self)._process_order(order=order, draft=draft, existing_order=existing_order)
        SaleCoupon = self.env['sale.coupon']
        pos_order_id = self.browse(pos_order)
        if order.get('data', False):
            if order['data'].get('applied_coupons', False):
                pos_order_id.applied_coupon_ids += SaleCoupon.browse(order['data']['applied_coupons'])
                SaleCoupon.search([('id', 'in', pos_order_id.applied_coupon_ids.ids)]).write({'pos_order_id': pos_order_id.id})

            if order['data'].get('generated_coupons_ids', False):
                pos_order_id.generated_coupon_ids += SaleCoupon.browse(order['data']['generated_coupons_ids'])
                SaleCoupon.search([
                        ('id', 'in', pos_order_id.generated_coupon_ids.ids),
                        ('state', '!=', 'used')
                    ]).write({'pos_order_id': pos_order_id.id, 'state': 'new'})
                pos_order_id._send_reward_coupon_mail()

            if order['data'].get('no_code_promo_program_ids', False):
                pos_order_id.no_code_promo_program_ids += self.env['sale.coupon.program'].browse(order['data']['no_code_promo_program_ids'])
        return pos_order

    def _send_reward_coupon_mail(self):
        self.ensure_one()
        template = self.env.ref('sale_coupon.mail_template_sale_coupon', raise_if_not_found=False)
        if template and self.partner_id:
            for coupon in self.generated_coupon_ids:
                template.send_mail(coupon.id, force_send=True, notif_layout='mail.mail_notification_light')

class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'

    is_reward_line = fields.Boolean('Is a program reward line')
