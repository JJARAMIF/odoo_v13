# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class SaleCouponApplyCode(models.TransientModel):
    _inherit = 'sale.coupon.apply.code'

    def apply_coupon(self, order, coupon_code):
        error_status = {}
        program = self.env['sale.coupon.program'].search([('promo_code', '=', coupon_code), ('used_in', 'in', ('sale', 'all'))])
        if program:
            error_status = program._check_promo_code(order, coupon_code)
            if not error_status:
                if program.promo_applicability == 'on_next_order':
                    # Avoid creating the coupon if it already exist
                    if program.discount_line_product_id.id not in order.generated_coupon_ids.filtered(lambda coupon: coupon.state in ['new', 'reserved']).mapped('discount_line_product_id').ids:
                        coupon = order._create_reward_coupon(program)
                        return {
                            'generated_coupon': {
                                'reward': coupon.program_id.discount_line_product_id.name,
                                'code': coupon.code,
                            }
                        }
                else:  # The program is applied on this order
                    order._create_reward_line(program)
                    order.code_promo_program_id = program
        else:
            coupon = self.env['sale.coupon'].search([('code', '=', coupon_code), ('program_id.used_in', 'in', ('sale', 'all'))], limit=1)
            if coupon:
                error_status = coupon._check_coupon_code(order)
                if not error_status:
                    order._create_reward_line(coupon.program_id)
                    order.applied_coupon_ids += coupon
                    coupon.write({'state': 'used'})
            else:
                error_status = {'not_found': _('The code %s is invalid') % (coupon_code)}
        return error_status
