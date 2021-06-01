# -*- coding: utf-8 -*-
# copyright of Technaureus Info Solutions Pvt. Ltd.
# - © Technaureus Info Solutions Pvt. Ltd 2019

from odoo import models, fields, api


class PosOrderReport(models.Model):
    _inherit = "report.pos.order"

    margin = fields.Float(string='Gross Margin', readonly="1")
    margin_with_taxes = fields.Float(string="Net margin", readonly="1")
    standard_price = fields.Float(string="Cost", readonly="1")

    def _select(self):
        return super(PosOrderReport, self)._select() + """,
                SUM(l.margin) AS margin,
                SUM(l.standard_price) AS standard_price,
                SUM(l.margin_with_taxes) AS margin_with_taxes
                """

    def _group_by(self):
        return super(PosOrderReport, self)._group_by() + """,
                l.margin,
                l.standard_price
                """
