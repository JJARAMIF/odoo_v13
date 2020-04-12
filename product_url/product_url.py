# -*- encoding: utf-8 -*-
##############################################################################
#
#    Avanzosc - Avanced Open Source Consulting
#    Copyright (C) 2011 - 2013 Avanzosc <http://www.avanzosc.com>
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see http://www.gnu.org/licenses/.
#
##############################################################################

from openerp.osv import fields, osv
#import decimal_precision as dp
from datetime import datetime
from openerp.tools.translate import _
import base64
import urllib2


class product_product(osv.osv):
	_inherit = 'product.product'

	_columns = {
		'image_url': fields.boolean('URL'),
		'web': fields.char('image url', size=350, help='The image URL'),
	}

	def onchange_image(self, cr, uid, ids, web, image_url, context=None):
		if image_url == True and web != False:
			link = web
			try:
				photo = base64.encodestring(urllib2.urlopen(link).read())
			except:
				return {'value':{},'warning':{'title':'Error de configuración','message':'Revise el link, no parece válido'}}
			val = {
				'image_medium': photo,
			}
			return {'value': val}
		else:
			
			return True




