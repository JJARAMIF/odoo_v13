# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
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
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################

from openerp.osv import fields, orm

class WizardAddUrlImages(orm.TransientModel):
    _name = "wizard.add.url.images"
    _description = "Add Url Images"


    def update_url_product_images(self, cr, uid, ids, context=None):
        if context is None:
            context = {}
        product_obj = self.pool['product.product']
        product_ids = context.get('active_ids')
        if product_ids:		
            for product in product_obj.browse(cr, uid, product_ids, context=context):                                             
                if product.web != False:
                        web = product.web
                        values = product_obj.onchange_image(cr, uid, ids, web, True, context=None)
                        product.write({'image_url': True, 'image_medium': values['value']['image_medium']})                                     
                else:     
			return {'value':{},'warning':{'title':'Error de configuración','message':'Revise que en todos los productos seleccionados esten la url y el checkbox'}}
        return {'type': 'ir.actions.act_window_close'}

    
