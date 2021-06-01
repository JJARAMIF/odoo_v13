odoo.define('pos_auto_invoice.pos_auto_invoice', function (require) {
    "use strict";

    var gui = require('point_of_sale.gui');
    var screens = require('point_of_sale.screens');

    screens.PaymentScreenWidget.include({
		show: function() {
			var self = this;
			this._super();
			if(this.pos.config.is_auto_invoice && this.pos.config.module_account)
			{
				var pos_order = this.pos.get_order();
				if (pos_order !== null) {
					pos_order.set_to_invoice(true);
					this.$('.js_invoice').addClass('highlight');
				}
			}			
		},
	});
});
