# -*- coding: utf-8 -*-
# Part of Odoo. See COPYRIGHT & LICENSE files for full copyright and licensing details.

from odoo import api, fields, models, _


class SaleCoupon(models.Model):
    _inherit = 'sale.coupon'

    pos_order_id = fields.Many2one('pos.order', string="POS Order")
    pos_reference = fields.Char(string="POS Reference")
