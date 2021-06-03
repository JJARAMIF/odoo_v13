# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools


class PosOrderReport(models.Model):
    _inherit = "report.pos.order"

    amount_applied_coupons_total = fields.Float(string='Total Amount Applied Coupons', readonly=True)
    amount_applied_promo_total = fields.Float(string='Total Amount Applied Promotions', readonly=True)

    def _select(self):
        return super(PosOrderReport, self)._select() +\
        ", SUM(s.amount_applied_coupons_total / s.count_lines) AS amount_applied_coupons_total, SUM(s.amount_applied_promo_total / s.count_lines) AS amount_applied_promo_total"
