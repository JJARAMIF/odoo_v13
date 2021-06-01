# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools


class PosOrderReport(models.Model):
	_inherit = "report.pos.order"

	margin = fields.Float(string='Margin')

	def _select(self):
		return super(PosOrderReport, self)._select() + ',SUM(l.margin) AS margin'