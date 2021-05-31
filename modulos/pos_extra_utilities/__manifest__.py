# -*- coding: utf-8 -*-
#################################################################################
# Author      : Webkul Software Pvt. Ltd. (<https://webkul.com/>)
# Copyright(c): 2015-Present Webkul Software Pvt. Ltd.
# All Rights Reserved.
#
#
#
# This program is copyright property of the author mentioned above.
# You can`t redistribute it and/or modify it.
#
#
# You should have received a copy of the License along with this program.
# If not, see <https://store.webkul.com/license.html/>
#################################################################################
{
  "name"                 :  "POS Extra Utilities",
  "summary"              :  """The module allows you to disable buttons namely, Delete, price, discount, etc for Odoo POS user. Also, disable order validation without selection of customer in POS""",
  "category"             :  "Point of Sale",
  "version"              :  "1.0",
  "sequence"             :  1,
  "author"               :  "Webkul Software Pvt. Ltd.",
  "license"              :  "Other proprietary",
  "website"              :  "https://store.webkul.com/Odoo-POS-Extra-Utilities.html",
  "description"          :  """Odoo POS Extra Utilities
POS Disable delete
POS Disable discount
POS Disable price
Disable POS functions""",
  "live_test_url"        :  "http://odoodemo.webkul.com/?module=pos_extra_utilities&custom_url=/pos/auto",
  "depends"              :  ['point_of_sale'],
  "data"                 :  [
                             'views/pos_config_view.xml',
                             'views/res_user_view.xml',
                             'security/utilities_security.xml',
                             'views/template.xml',
                            ],
  "qweb"                 :  ['static/src/xml/pos_utilities.xml'],
  "images"               :  ['static/description/Banner.png'],
  "application"          :  True,
  "installable"          :  True,
  "auto_install"         :  False,
  "price"                :  69,
  "currency"             :  "USD",
  "pre_init_hook"        :  "pre_init_check",
}