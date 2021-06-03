odoo.define('pos_coupon_acs.screens', function (require) {
    "use strict";

    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');

    var QWeb = core.qweb;
    var _t = core._t;

    var UpdatePromotionsButton = screens.ActionButtonWidget.extend({
        template: 'UpdatePromotions',
        button_click: function () {
            var order = this.pos.get_order();
            if (order) {
                order.updatePromotions();
            }
        },
    });

    screens.define_action_button({
        'name': 'order_update_promotions',
        'widget': UpdatePromotionsButton,
        'condition': function () {
            return this.pos.config.iface_order_coupon;
        },
    });

    var OrderCouponButton = screens.ActionButtonWidget.extend({
        template: 'OrderCouponButton',
        button_click: function () {
            var self = this;
            var order = this.pos.get_order();
            if (order) {
                this.gui.show_popup('coupon_apply_popup', {
                    title: _t('Add Coupon Code'),
                    value: order.get_coupon(),
                    confirm: function (coupon_code) {
                        order.processCoupon(coupon_code)
                    },
                });
            }
        },
    });

    screens.define_action_button({
        'name': 'order_coupon',
        'widget': OrderCouponButton,
        'condition': function () {
            return this.pos.config.iface_order_coupon;
        },
    });

    screens.ReceiptScreenWidget.include({
        click_next: function() {
            var order = this.pos.get_order();
            order.reload_coupons();
            this._super();
        },
    });

    return {
        UpdatePromotionsButton: UpdatePromotionsButton,
        OrderCouponButton: OrderCouponButton,
    }
});
