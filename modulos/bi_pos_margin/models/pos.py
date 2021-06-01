# -*- coding: utf-8 -*-
# Part of BrowseInfo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models,api
import odoo.addons.decimal_precision as dp


class PosOrder(models.Model):
	_inherit ='pos.order'

	margin = fields.Float(compute='_product_margin',digits='Product Price', string="Margin", store=True)

	@api.depends('lines.margin')
	def _product_margin(self):
		for order in self:
			order.margin = sum(order.lines.mapped('margin'))
		

class PosOrderLine(models.Model):
	_inherit ='pos.order.line'   
		
	purchase_price = fields.Float(string='Cost', compute='product_id_change_margin', digits='Product Price', store=True)
	margin = fields.Float(compute='_product_margin', digits='Product Price', store=True)

	@api.depends('product_id')
	def product_id_change_margin(self):
		for line in self:
			line.purchase_price = line.product_id.standard_price
		return

	@api.depends('product_id', 'purchase_price', 'price_unit')
	def _product_margin(self):
		for line in self:
			line.margin = line.price_subtotal - ((line.purchase_price or line.product_id.standard_price) * line.qty)

