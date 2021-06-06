odoo.define('pos_default_code.pos_default_code', function (require) {
    "use strict";
        var gui = require('point_of_sale.gui');
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var PopupWidget = require('point_of_sale.popups');
    var core = require('web.core');

    var _t = core._t;
    var _super_orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        generate_wrapped_product_name: function() {
        	var name = _super_orderline.generate_wrapped_product_name.call(this);
        	if (this.get_product().default_code) {
        		name[0] = name[0] + '['+this.get_product().default_code + '] ' 
        	}
        	return name
        },
    });
});
