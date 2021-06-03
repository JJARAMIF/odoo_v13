odoo.define('pos_coupon_acs.popups', function (require) {
"use strict";

var PopupWidget = require('point_of_sale.popups');
var gui = require('point_of_sale.gui');


var CouponApplyPopup = PopupWidget.extend({
    template: 'CouponApplyPopup',
    show: function(options){
        options = options || {};
        this._super(options);

        this.renderElement();
        this.$('input').focus();
    },
    click_confirm: function(){
        var value = this.$('input').val();
        this.gui.close_popup();
        if( this.options.confirm ){
            this.options.confirm.call(this,value);
        }
    },
});

gui.define_popup({name:'coupon_apply_popup', widget: CouponApplyPopup});

});
