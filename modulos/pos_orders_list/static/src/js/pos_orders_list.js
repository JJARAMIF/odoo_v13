// pos_orders_list js
odoo.define('pos_orders_list.pos_orders_list', function(require) {
	"use strict";

	var models = require('point_of_sale.models');
	var screens = require('point_of_sale.screens');
	var PosDB = require('point_of_sale.DB');
	var core = require('web.core');
	var gui = require('point_of_sale.gui');
	var popups = require('point_of_sale.popups');
	var QWeb = core.qweb;
	var rpc = require('web.rpc');
	var time = require('web.time');
	var field_utils = require('web.field_utils');
	var utils = require('web.utils');


	var _t = core._t;
	var pos_order_domain = [];

	var OrderSuper = models.Order;
	var posorder_super = models.Order.prototype;
	models.Order = models.Order.extend({
		initialize: function(attr, options) {
			this.barcode = this.barcode || "";
			this.set_barcode();
			posorder_super.initialize.call(this,attr,options);
		},

		set_barcode: function(){
			var self = this;	
			var temp = Math.floor(100000000000+ Math.random() * 9000000000000)
			self.barcode =  temp.toString();
		},

		export_as_JSON: function() {
			var self = this;
			var loaded = OrderSuper.prototype.export_as_JSON.call(this);
			loaded.barcode = self.barcode;
			return loaded;
		},

	});

	// Start SeeAllOrdersButtonWidget
	
	var SeeAllOrdersButtonWidget = screens.ActionButtonWidget.extend({
		template: 'SeeAllOrdersButtonWidget',
		button_click: function() {
			var self = this;
			var params = self.pos.get_order().get_screen_data('params');
			if(params && params['selected_partner_id'])
			{
				params['selected_partner_id'] = undefined;
			}
			this.gui.show_screen('see_all_orders_screen_widget');
		},
		
	});

	screens.define_action_button({
		'name': 'See All Orders Button Widget',
		'widget': SeeAllOrdersButtonWidget,
		'condition': function() {
			return true;
		},
	});
	// End SeeAllOrdersButtonWidget 

	// SeeAllOrdersScreenWidget start

	var SeeAllOrdersScreenWidget = screens.ScreenWidget.extend({
		template: 'SeeAllOrdersScreenWidget',
		init: function(parent, options) {
			this._super(parent, options);
			//this.options = {};
		},
		
		get_selected_partner: function() {
			var self = this;
			if (self.gui)
				return self.gui.get_current_screen_param('selected_partner_id');
			else
				return undefined;
		},
		
		render_list_orders: function(orders, search_input){
			var self = this;
			if(orders == undefined)
			{
				orders = self.pos.get('all_orders_list');
			}
			var selected_partner_id = this.get_selected_partner();
			var selected_client_orders = [];
			if (selected_partner_id != undefined && orders) {
				for (var i = 0; i < orders.length; i++) {
					if (orders[i].partner_id[0] == selected_partner_id)
						selected_client_orders = selected_client_orders.concat(orders[i]);
				}
				orders = selected_client_orders;
			}
			
			if (search_input != undefined && search_input != '' && orders) {
				var selected_search_orders = [];
				var search_text = search_input.toLowerCase()
				for (var i = 0; i < orders.length; i++) {
					if (orders[i].partner_id == '') {
						orders[i].partner_id = [0, '-'];
					}
					if(orders[i].partner_id[1] == false)
					{
						if (((orders[i].name.toLowerCase()).indexOf(search_text) != -1) || ((orders[i].state.toLowerCase()).indexOf(search_text) != -1)  || ((orders[i].pos_reference.toLowerCase()).indexOf(search_text) != -1)) {
						selected_search_orders = selected_search_orders.concat(orders[i]);
						}
					}
					else
					{
						if (((orders[i].name.toLowerCase()).indexOf(search_text) != -1) || ((orders[i].state.toLowerCase()).indexOf(search_text) != -1)  || ((orders[i].pos_reference.toLowerCase()).indexOf(search_text) != -1) || ((orders[i].partner_id[1].toLowerCase()).indexOf(search_text) != -1)) {
						selected_search_orders = selected_search_orders.concat(orders[i]);
						}
					}
				}
				orders = selected_search_orders;
			}
			var content = this.$el[0].querySelector('.orders-list-contents');
			content.innerHTML = "";
			var orders = orders;
			var current_date = null;
			if(orders){
				for(var i = 0, len = Math.min(orders.length,1000); i < len; i++){
					var order    = orders[i];
					current_date =  field_utils.format.datetime(moment(order.date_order), {type: 'datetime'});
					var ordersline_html = QWeb.render('OrdersLine',{widget: this, order:orders[i], selected_partner_id: orders[i].partner_id[0],current_date:current_date});
					var ordersline = document.createElement('tbody');
					ordersline.innerHTML = ordersline_html;
					ordersline = ordersline.childNodes[1];
					content.appendChild(ordersline);
				}	
			}
			
		},
		
		get_current_day: function () {
			var today = new Date();
			var dd = today.getDate();
			var mm = today.getMonth()+1; //January is 0!

			var yyyy = today.getFullYear();
			if(dd<10){
				dd='0'+dd;
			} 
			if(mm<10){
				mm='0'+mm;
			} 
			today = yyyy+'-'+mm+'-'+dd;
			return today;
		},
		get_orders_domain: function(){
			var self = this; 
			var current = self.pos.pos_session.id;
			if (self.pos.config.pos_session_limit == 'all')
			{
				if(self.pos.config.show_draft == true)
				{
					if(self.pos.config.show_posted == true)
					{
						pos_order_domain = [['state', 'in', ['draft','done']]];
						return [['state', 'in', ['draft','done']]]; 
					}
					else{
						pos_order_domain = [['state', 'in', ['draft']]];
						return [['state', 'in', ['draft']]]; 
					}
				}
				else if(self.pos.config.show_posted == true)
				{
					pos_order_domain = [['state', 'in', ['done']]];
					return [['state', 'in', ['done']]];
				}
				else{
					pos_order_domain =[['state', 'in', ['draft','done','paid','invoiced','cancel']]];
					return [['state', 'in', ['draft','done','paid','invoiced','cancel']]]; 
				}	
			}
			if (self.pos.config.pos_session_limit == 'last3')
			{
				if(self.pos.config.show_draft == true)
				{
					if(self.pos.config.show_posted == true)
					{
						pos_order_domain = [['state', 'in', ['draft','done']],['session_id', 'in',[current,current-1,current-2,current-3]]]; 
						return [['state', 'in', ['draft','done']],['session_id', 'in',[current,current-1,current-2,current-3]]]; 
					}
					else{
						pos_order_domain = [['state', 'in', ['draft']],['session_id', 'in',[current,current-1,current-2,current-3]]]; 
						return [['state', 'in', ['draft']],['session_id', 'in',[current,current-1,current-2,current-3]]]; 
					}
				}
				else if(self.pos.config.show_posted == true)
				{
					pos_order_domain = [['state', 'in', ['done']],['session_id', 'in',[current,current-1,current-2,current-3]]];
					return [['state', 'in', ['done']],['session_id', 'in',[current,current-1,current-2,current-3]]];
				}
				else{
					pos_order_domain = [['session_id', 'in',[current,current-1,current-2,current-3]]]; 
					return [['session_id', 'in',[current,current-1,current-2,current-3]]]; 
				}
			}
			if (self.pos.config.pos_session_limit == 'last5')
			{
				if(self.pos.config.show_draft == true)
				{
					if(self.pos.config.show_posted == true)
					{
						pos_order_domain = [['state', 'in', ['draft','done']],['session_id', 'in',[current,current-1,current-2,current-3,current-4,current-5]]]; 
						return [['state', 'in', ['draft','done']],['session_id', 'in',[current,current-1,current-2,current-3,current-4,current-5]]]; 
					}
					else{
						pos_order_domain = [['state', 'in', ['draft']],['session_id', 'in',[current,current-1,current-2,current-3,current-4,current-5]]]; 
						return [['state', 'in', ['draft']],['session_id', 'in',[current,current-1,current-2,current-3,current-4,current-5]]]; 
					}
				}
				else if(self.pos.config.show_posted == true)
				{
					pos_order_domain = [['state', 'in', ['done']],['session_id', 'in',[current,current-1,current-2,current-3,current-4,current-5]]];
					return [['state', 'in', ['done']],['session_id', 'in',[current,current-1,current-2,current-3,current-4,current-5]]];
				}
				else{
					pos_order_domain =  [['session_id', 'in',[current,current-1,current-2,current-3,current-4,current-5]]]; 
					return [['session_id', 'in',[current,current-1,current-2,current-3,current-4,current-5]]]; 
				}
			}
			
			if (self.pos.config.pos_session_limit == 'current_session')
			{
				if(self.pos.config.show_draft == true)
				{
					if(self.pos.config.show_posted == true)
					{
						pos_order_domain = [['state', 'in', ['draft','done']],['session_id', 'in',[current]]]; 
						return [['state', 'in', ['draft','done']],['session_id', 'in',[current]]]; 
					}
					else{
						pos_order_domain = [['state', 'in', ['draft']],['session_id', 'in',[current]]]; 
						return [['state', 'in', ['draft']],['session_id', 'in',[current]]]; 
					}
				}
				else if(self.pos.config.show_posted == true)
				{
					pos_order_domain = [['state', 'in', ['done']],['session_id', 'in',[current]]];
					return [['state', 'in', ['done']],['session_id', 'in',[current]]];
				}
				else{
					pos_order_domain = [['session_id', 'in',[current]]]; 
					return [['session_id', 'in',[current]]]; 
				}
			}
			
		}, 

		get_orders_fields: function () {
			var fields = ['name', 'id', 'date_order', 'partner_id', 'pos_reference', 'lines', 'amount_total', 'session_id', 'state', 'company_id','pos_order_date','barcode'];
			return fields;
		},

		get_pos_orders: function () {
			var self = this;
			var fields = self.get_orders_fields();
			var pos_domain = self.get_orders_domain();
			var load_orders = [];
			var load_orders_line = [];
			var order_ids = [];
			rpc.query({
					model: 'pos.order',
					method: 'search_read',
					args: [pos_order_domain,fields],
			}, {async: false}).then(function(output) {
				if (self.pos.config.pos_session_limit == 'current_day')
				{
					var today = self.get_current_day();
					output.forEach(function(i) {
						if(today == i.pos_order_date)
						{
							load_orders.push(i);
						}
					});
				}
				else{
					load_orders = output;
				}
				self.pos.db.get_orders_by_id = {};
				load_orders.forEach(function(order) {
					order_ids.push(order.id)
					self.pos.db.get_orders_by_id[order.id] = order;
				});
				
				var fields_domain = [['order_id','in',order_ids]];
				rpc.query({
					model: 'pos.order.line',
					method: 'search_read',
					args: [fields_domain],
				}, {async: false}).then(function(output1) {
					self.pos.db.all_orders_line_list = output1;
					load_orders_line = output1;
					self.pos.set({'all_orders_list' : load_orders});
					self.pos.set({'all_orders_line_list' : output1});
					self.render_list_orders(load_orders, undefined);
					return [load_orders,load_orders_line]
				});
			}); 
			
		},

		display_details: function (o_id) {
			var self = this;
			var orders =  self.pos.get('all_orders_list');
			var orders_lines =  self.pos.get('all_orders_line_list');
			var orders1 = [];
			for(var ord = 0; ord < orders.length; ord++){
				if (orders[ord]['id'] == o_id){
					 orders1 = orders[ord];
				}
			}
			var current_date =  field_utils.format.datetime(moment(orders1.date_order),{type: 'datetime'});
			var orderline = [];
			for(var n=0; n < orders_lines.length; n++){
				if (orders_lines[n]['order_id'][0] ==o_id){
					orderline.push(orders_lines[n])
				}
			}
			this.gui.show_popup('see_order_details_popup_widget', {'order': [orders1], 'orderline':orderline,'current_date':current_date});
		},

		orderline_click_events: function () {
			var self = this;
			this.$('.orders-list-contents').delegate('.orders-line-name', 'click', function(event) {
				var o_id = $(this).data('id');
				self.display_details(o_id);
			});
			
			this.$('.orders-list-contents').delegate('.orders-line-ref', 'click', function(event) {
				var o_id = $(this).data('id');
				self.display_details(o_id);
			});
						
			this.$('.orders-list-contents').delegate('.orders-line-partner', 'click', function(event) {
				var o_id = $(this).data('id');
				self.display_details(o_id);
			});
			
			this.$('.orders-list-contents').delegate('.orders-line-date', 'click', function(event) {
				var o_id = $(this).data('id');
				self.display_details(o_id);
			});
						
			this.$('.orders-list-contents').delegate('.orders-line-tot', 'click', function(event) {
				var o_id = $(this).data('id');
				self.display_details(o_id);
			});

			this.$('.orders-list-contents').delegate('.orders-line-state', 'click', function(event) {
				var o_id = $(this).data('id');
				self.display_details(o_id);
			});
		},
		
		show: function(options) {
			var self = this;
			this._super(options);
			this.details_visible = false;
			self.get_pos_orders();
			var orders =  self.pos.get('all_orders_list');
			var orders_lines =  self.pos.get('all_orders_line_list');
			$('.search-order input').val('');
			self.render_list_orders(orders, undefined);
			self.orderline_click_events(orders,orders_lines);
			
			this.$('.back').click(function(){
				self.gui.show_screen('products');
			});
			var current_date = null;

			$('.refresh-order').on('click',function () {
				$('.search-order input').val('');
				var params = self.pos.get_order().get_screen_data('params');
				if(params && params['selected_partner_id'])
				{
					params['selected_partner_id'] = undefined;
				}
				self.get_pos_orders();
			});

			//this code is for Search Orders
			this.$('.search-order input').keyup(function() {
				self.render_list_orders(orders, this.value);
			});
			
		},
	});
	gui.define_screen({
		name: 'see_all_orders_screen_widget',
		widget: SeeAllOrdersScreenWidget
	});

	// End SeeAllOrdersScreenWidget

	var SeeOrderDetailsPopupWidget = popups.extend({
		template: 'SeeOrderDetailsPopupWidget',
		
		init: function(parent, args) {
			this._super(parent, args);
			this.options = {};
		},
		
		
		show: function(options) {
			var self = this;
			options = options || {};
			this._super(options);
			
			
			this.order = options.order || [];
			this.orderline = options.orderline || [];
			this.current_date = options.current_date || [];
		},
		
		events: {
			'click .button.cancel': 'click_cancel',
		},
		
		renderElement: function() {
			var self = this;
			this._super();
		},

	});

	gui.define_popup({
		name: 'see_order_details_popup_widget',
		widget: SeeOrderDetailsPopupWidget
	});
	


// Start ClientListScreenWidget
	gui.Gui.prototype.screen_classes.filter(function(el) { return el.name == 'clientlist'})[0].widget.include({
			show: function(){
				this._super();
				var self = this;
				this.$('.view-orders').click(function(){
					self.gui.show_screen('see_all_orders_screen_widget', {});
				});
			$('.selected-client-orders').on("click", function() {
				self.gui.show_screen('see_all_orders_screen_widget', {
					'selected_partner_id': this.id
				});
			});
			
		},
	});

	screens.ReceiptScreenWidget.include({
		show: function () {
			this._super(); 
			var order = this.pos.get_order();                     
			$("#barcode_print").barcode(
				order.barcode, // Value barcode (dependent on the type of barcode)
				"code128" // type (string)
			);
		},
	});

	return SeeAllOrdersScreenWidget;
});
