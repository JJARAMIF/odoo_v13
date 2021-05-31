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
  "name"                 :  "POS Order Margin",
  "summary"              :  "Allows the pos user to view the margin in their cost price and sale price. It also shows the same on the reporting as well.",
  "category"             :  "Point Of Sale",
  "version"              :  "1.1",
  "author"               :  "Webkul Software Pvt. Ltd.",
  "license"              :  "Other proprietary",
  "depends"              :  ['point_of_sale'],
  "website"              :  "https://store.webkul.com",
  "description"          :  """pos order margin, pos margin, margins, cost price sale price difference,
                              sale profit
                            """,
  "live_test_url"        :  "http://odoodemo.webkul.com/?module=wk_pos_order_margin&custom_url=/pos/web",
  "data"                 :  [
                             'views/pos_order_margin.xml',
                             'views/report_pos_sale_template.xml'
                            ],
  "images"               :  ['static/description/Banner.png'],
  "application"          :  True,
  "installable"          :  True,
  "auto_install"         :  False,
  "price"                :  39,
  "currency"             :  "USD",
  "pre_init_hook"        :  "pre_init_check",
}
