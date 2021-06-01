odoo.define('tis_pos_margin.margin_models', function (require) {
"use strict";
var models = require('point_of_sale.models');

  var _super_Orderline = models.Orderline.prototype ;
    models.Orderline = models.Orderline.extend({

       export_as_JSON: function() {
            var json = _super_Orderline.export_as_JSON.apply(this, arguments);
            json['standard_price'] = this.product.standard_price || '';
            return json;
        }

    });

});