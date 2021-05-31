# -*- coding: utf-8 -*-
#################################################################################
#
#   Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>)
#   See LICENSE file for full copyright and licensing details.
#   License URL : <https://store.webkul.com/license.html/>
# 
#################################################################################

from odoo import fields,models

class PosConfig(models.Model):
    _inherit = 'pos.config'
    disable_price_modification = fields.Boolean("Disable price modification")
    allow_only_price_increase = fields.Boolean("Allow only increase in price", default=True)
    disable_discount_button = fields.Boolean("Disable discounts", default=True)
    disable_delete_button = fields.Boolean("Disable delete", default=True)
    validation_check = fields.Boolean("Do not validate order if customer is not selected", default=True)

class ResUsers(models.Model):
    _inherit = 'res.users'

    pos_config = fields.Many2one('pos.config', string='Default Point of Sale', domain=[('active', '=', True)])