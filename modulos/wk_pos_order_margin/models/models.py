# -*- coding: utf-8 -*-
#################################################################################
#
#   Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>)
#   See LICENSE file for full copyright and licensing details.
#   License URL : <https://store.webkul.com/license.html/>
# 
#################################################################################
from odoo import api, fields, models
from odoo.addons import decimal_precision as dp
import logging
_logger = logging.getLogger(__name__)


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    margin = fields.Float(compute='wk_product_margin', digits=dp.get_precision('Product Price'), store=True)
    purchase_price = fields.Float(string='Cost', digits=dp.get_precision('Product Price'))

    def _wk_compute_margin(self, pos_order, product_id):
        from_curr = self.env.user.company_id.currency_id
        to_curr = pos_order.pricelist_id.currency_id
        purchase_price = product_id.standard_price
        ctx = self.env.context.copy()
        ctx['date'] = pos_order.date_order
        price = from_curr.with_context(ctx).compute(purchase_price, to_curr, round=False)
        return price

    @api.model
    def _get_purchase_price(self, pricelist, product, product_uom, date):
        frm_cur = self.env.company.currency_id
        to_cur = pricelist.currency_id
        purchase_price = product.standard_price
        if product_uom != product.uom_id:
            purchase_price = product.uom_id._compute_price(purchase_price, product_uom)
        price = frm_cur._convert(
            purchase_price, to_cur,
            self.order_id.company_id or self.env.company,
            date or fields.Date.today(), round=False)
        return {'purchase_price': price}


    @api.onchange('product_id', 'product_uom')
    def product_id_change_margin(self):
        if not self.order_id.pricelist_id or not self.product_id or not self.product_uom:
            return
        self.purchase_price = self._wk_compute_margin(self.order_id, self.product_id, self.product_uom)

    @api.model
    def create(self, vals):
        if 'purchase_price' not in vals:
            pos_order = self.env['pos.order'].browse(vals['order_id'])
            product_id = self.env['product.product'].browse(vals['product_id'])
            vals['purchase_price'] = self._wk_compute_margin(pos_order, product_id)
        return super(PosOrderLine, self).create(vals)



    @api.depends('product_id', 'purchase_price', 'qty', 'price_unit', 'price_subtotal')
    def wk_product_margin(self):
        for line in self:
            currency = line.order_id.pricelist_id.currency_id
            price = line.purchase_price
            margin = line.price_subtotal - (price * line.qty)
            if margin > 0:
                line.margin = currency.round(margin) if currency else margin
            else:
                line.margin = 0


class SaleOrder(models.Model):
    _inherit = "pos.order"

    margin = fields.Float(compute='wk_product_margin', help="It gives profitability by calculating the difference between the Unit Price and the cost.", digits=dp.get_precision('Product Price'), store=True)

    @api.depends('lines.margin')
    def wk_product_margin(self):
        for order in self:
            for line in order.lines:
                order.margin = sum(order.lines.mapped('margin'))
