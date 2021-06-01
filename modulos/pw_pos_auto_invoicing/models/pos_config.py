# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class PosConfig(models.Model):
    _inherit = 'pos.config'

    is_auto_invoice = fields.Boolean('Auto Invoicing')
