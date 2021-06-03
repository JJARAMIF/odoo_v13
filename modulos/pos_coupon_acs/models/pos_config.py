# -*- coding: utf-8 -*-
# Part of Odoo. See COPYRIGHT & LICENSE files for full copyright and licensing details.

from odoo import api, fields, models, _


class PosConfig(models.Model):
    _inherit = 'pos.config'

    iface_order_coupon = fields.Boolean(string='Apply Coupon & Promotion', help='Allow to apply Coupon and Promotion on Order.')
