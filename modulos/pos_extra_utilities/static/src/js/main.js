/* Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>) */
/* See LICENSE file for full copyright and licensing details. */
/* License URL : <https://store.webkul.com/license.html/> */

odoo.define('pos_extra_utilities.main', function (require) {
"use strict";
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var popup_widget = require('point_of_sale.popups');

    screens.PaymentScreenWidget.include({
        validate_order: function(force_validation) {
            var self = this;
            var order = self.pos.get_order();
            if (self.pos.config.validation_check) 
            {
                if(order.get_client()==null)
                {
                    self.gui.show_popup('confirm',{
                        'title': _t('Please Select The Customer'),
                        'body': _t('You need to select the customer before you can validate the order.'),
                        confirm: function(){
                            self.gui.show_screen('clientlist');
                        },
                    });
                }else
                    this._super(force_validation);
            }else
                this._super(force_validation);
        },
    });

    var PriceUpdatePopupWidget = popup_widget.extend({
        template:'PriceUpdatePopupWidget',

        events: {
            'click #wk_ok':'click_ok',
            'click #wk_cancel': 'click_cancel',
        }, 
        show: function(options){
            var self = this;
            this._super(options);
            $('#price_input').keyup(function(){
                if (event.keyCode === 13)
                    $('#wk_ok').trigger('click');
                
            });
        },
        click_ok: function(){
            var self = this;
            var previous_price = self.pos.get_order().selected_orderline.price;
            var new_price = $("#price_input").val();
            if(!$.isNumeric(new_price))
            {
                $('#price_error').show();
                $('#price_error').addClass("fa fa-warning");
                $('#price_error').text("  Please enter a numeric value");
            }
            else if(parseFloat(new_price)<parseFloat(previous_price))
            {
                $('#price_error').show();
                $('#price_error').addClass("fa fa-warning");
                $('#price_error').text("  New price must be greater than current price!!");
            }
            else
            { 
                self.pos.gui.current_screen.order_widget.numpad_state.appendNewChar(new_price);
                self.gui.close_popup();
                self.pos.gui.current_screen.order_widget.numpad_state.reset();
            }
        },
        click_cancel:function(){
            var self=this;
            self.pos.gui.current_screen.order_widget.numpad_state.reset();
            self.gui.close_popup();
        },
    });
    gui.define_popup({name:'price_update', widget: PriceUpdatePopupWidget});

    screens.NumpadWidget.include({
        changedMode: function() {
            var self = this;
            var mode = this.state.get('mode');
            this._super();
            if(self.pos.config.allow_only_price_increase && mode == 'price'){
                if(self.pos.get_order().selected_orderline){
                    self.gui.show_popup('price_update',{});
                    $("#price_input").val(self.pos.get_order().selected_orderline.price);
                    $('#price_input').focus();
                }
            }
            if(this.pos.config.disable_delete_button && mode != 'quantity')
                $(".product-screen .numpad .input-button.numpad-backspace").css({'pointer-events': 'none', 'opacity':'0.4', 'background': '#c1c1c1'});
            else
                $(".product-screen .numpad .input-button.numpad-backspace").css({'pointer-events': '', 'opacity':'', 'background': ''});
        },
    });
});