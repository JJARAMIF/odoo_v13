# -*- coding: utf-8 -*-
# from odoo import http


# class PosShowInternalReference(http.Controller):
#     @http.route('/pos_show_internal_reference/pos_show_internal_reference/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/pos_show_internal_reference/pos_show_internal_reference/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('pos_show_internal_reference.listing', {
#             'root': '/pos_show_internal_reference/pos_show_internal_reference',
#             'objects': http.request.env['pos_show_internal_reference.pos_show_internal_reference'].search([]),
#         })

#     @http.route('/pos_show_internal_reference/pos_show_internal_reference/objects/<model("pos_show_internal_reference.pos_show_internal_reference"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('pos_show_internal_reference.object', {
#             'object': obj
#         })
