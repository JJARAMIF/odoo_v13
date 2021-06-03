# -*- coding: utf-8 -*-
# Part of Odoo. See COPYRIGHT & LICENSE files for full copyright and licensing details.

{
    'name': 'POS Coupons & Promotions',
    'version': '1.0',
    'summary': 'Allows to use discount coupons and promotions in pos orders',
    'category': 'Point Of Sale',
    'author': 'Aurayan Consulting Services',
    'website': '',
    'description': """
        Integrate coupon and promotion mechanism in pos order.
    """,
    'depends': ['sale_coupon', 'point_of_sale'],
    'data': [
        'security/ir.model.access.csv',
        'views/point_of_sale.xml',
        'views/pos_config_views.xml',
        'views/sale_coupon_program_views.xml',
        'views/sale_coupon_views.xml',
        'views/pos_order_views.xml',
        'report/pos_order_report_views.xml'
    ],
    'qweb': [
        'static/src/xml/pos.xml',
    ],
    'images': [
        'static/description/main_screen.png',
    ],
    'price': 70.0,
    'currency': 'EUR',
    'auto_install': False,
    'application': True,
    'installable': True,
    'license': 'OPL-1',
}
