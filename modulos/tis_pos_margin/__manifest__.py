# -*- coding: utf-8 -*-
# copyright of Technaureus Info Solutions Pvt. Ltd.
# - © Technaureus Info Solutions Pvt. Ltd 2019

{
    'name': 'POS Margin And Analysis',
    'version': '13.0.0.9',
    'category': 'Point of Sale',
    'summary': 'POS Margin and Analysis',
    'sequence': 1,
    'author': 'Technaureus Info Solutions Pvt. Ltd.',
    'website': 'http://www.technaureus.com/',
    'description': """
    """,
    'price': 20,
    'currency': 'EUR',
    'license': 'Other proprietary',
    'depends': ['point_of_sale'],
    'data': [
        'views/point_of_sale.xml',
        'views/pos_order_view.xml'
    ],
    'images': ['images/margin_screenshot.png'],
    'installable': True,
    'application': True,
    'auto_install': False,
    'post_init_hook': 'load_cost_post_init_hook',
    'qweb': [],
    'live_test_url': 'https://www.youtube.com/watch?v=xkObQBFA0hc&t=54s'

}
