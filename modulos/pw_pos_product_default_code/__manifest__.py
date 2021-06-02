# -*- coding: utf-8 -*-
{
    'name': 'Product Internal Reference on PoS Screen and Receipt',
    'version': '13.0',
    'author': 'Preway IT Solutions',
    'category': 'Point of Sale',
    'depends': ['point_of_sale'],
    'summary': 'This module show Product Internal Reference on POS screen and receipt',
    'description': """
- POS Product Internal Reference
- POS Product Default Code
- POS Product code on screen
- POS Product Code on Receipt
- Product Default Code on pos screen
- Product Internal Reference on pos screen and receipt
    """,
    "data": [
        'views/pos_templates.xml',
    ],
    "qweb": [
        "static/src/xml/pos.xml",
    ],
    'price': 8.0,
    'currency': "EUR",
    'application': True,
    'installable': True,
    "images":["static/description/Banner.png"],
}
