# -*- coding: utf-8 -*-
{
    'name': 'POS Invoice Auto Check | POS Default Invoicing',
    'version': '13.0',
    'author': 'Preway IT Solutions',
    'category': 'Point of Sale',
    'depends': ['point_of_sale'],
    'summary': 'This apps helps you select invoice button automatically on every order on pos payment screen',
    'description': """
- POS Default invoice button is selected
- POS Auto invoicing
- POS Invoice automatically 
    """,
    'data': [
        'views/pos_assets.xml',
        'views/pos_config_view.xml',
    ],
    'price': 10.0,
    'currency': "EUR",
    'application': True,
    'installable': True,
    "images":["static/description/Banner.png"],
}
