# -*- coding: utf-8 -*-
# copyright of Technaureus Info Solutions Pvt. Ltd.
# - © Technaureus Info Solutions Pvt. Ltd 2019

from odoo import models, fields, api


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    margin = fields.Float(string='Gross Margin', compute='product_margin', store=True)
    margin_with_taxes = fields.Float(string="Net Margin", compute='product_net_margin', store=True)
    standard_price = fields.Float(string="Cost")

    def _prepare_refund_data(self, refund_order, PosOrderLineLot):
        res = super(PosOrderLine, self)._prepare_refund_data(refund_order,PosOrderLineLot)
        res.update({'standard_price':-self.standard_price})
        return res

    @api.depends('price_unit', 'qty', 'margin', 'discount', 'standard_price')
    def product_margin(self):
        for line in self:
            if line.qty < 1:
                line.margin = ((line.price_unit - line.standard_price) - (
                        (line.price_unit * line.discount) / 100)) * line.qty
            else:
                line.margin = (line.price_unit - line.standard_price) - ((line.price_unit * line.discount) / 100)

            line.margin = round(line.margin, 2)

    @api.depends('price_unit', 'qty', 'margin', 'discount', 'standard_price')
    def product_net_margin(self):
        for line in self:
            price = line.price_unit
            if line.qty < 1:
                line.margin_with_taxes = (((price - line.standard_price) - (
                        (price * line.discount) / 100)) * line.qty) - (
                                                 line.price_subtotal * line.tax_ids_after_fiscal_position.amount / 100)
            else:
                line.margin_with_taxes = (((price - line.standard_price) - (
                        (price * line.discount) / 100)) * line.qty) - (
                                                 line.price_subtotal * line.tax_ids_after_fiscal_position.amount / 100)

            line.margin_with_taxes = round(line.margin_with_taxes, 2)


class PosOrder(models.Model):
    _inherit = "pos.order"

    margin_total = fields.Float(string="Margin(including taxes)", compute='product_margin_total', digits=0)
    margin_without_taxes = fields.Float(string="Margin(excluding taxes)", compute='product_margin', digits=0)
    standard_price = fields.Float(default=0.0, store=True)

    @api.depends('lines.price_unit', 'lines.qty', 'lines.margin', 'lines.discount', 'lines.standard_price')
    def product_margin_total(self):
        lt_margin = 0
        gt_margin = 0
        for order in self:
            lt_margin = sum(
                line.margin_with_taxes for line
                in order.lines if line.qty < 1)
            gt_margin = sum(
                line.margin_with_taxes * line.qty for line
                in order.lines if line.qty >= 1)

        self.margin_total = lt_margin + gt_margin
        self.margin_total = round(self.margin_total, 2)

    @api.depends('lines.price_unit', 'lines.qty', 'lines.margin', 'lines.discount', 'lines.standard_price')
    def product_margin(self):
        for order in self:
            cost_total = sum(
                ((line.standard_price * line.qty) for line
                 in order.lines))
            total_amount = sum(
                ((line.price_subtotal) for line
                 in order.lines))
        self.margin_without_taxes = total_amount - cost_total
        self.margin_without_taxes = round(order.margin_without_taxes, 2)
