odoo.define('pos_coupon_acs.models', function (require) {
    "use strict";

    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');

    var concurrency = require('web.concurrency');
    var rpc = require('web.rpc');
    var time = require('web.time');
    var session = require('web.session');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;

    var field_utils = require('web.field_utils');

    var QWeb = core.qweb;
    var _t = core._t;

    models.PosModel = models.PosModel.extend({
        add_coupons: function (coupons) {
            for (var i = 0; i < coupons.length; i++) {
                this.coupons_by_id[coupons[i].id] = coupons[i];
                this.coupons_by_code[coupons[i].code] = coupons[i];
            }
            return true;
        },
        load_new_coupons: function(couponIds) {
            var self = this;
            return new Promise(function (resolve, reject) {
                var fields = _.find(self.models, function(model) { return model.model === 'sale.coupon'; }).fields;
                rpc.query({
                    model: 'sale.coupon',
                    method: 'search_read',
                    args: [[['program_id.active', '=', true], ['program_id.used_in', 'in', ['pos', 'all']], ['id', 'in', couponIds]], fields],
                }, {
                    timeout: 3000,
                    shadow: true,
                })
                .then(function(coupons){
                    if (self.add_coupons(coupons)) {
                        resolve();
                    } else {
                        reject();
                    }
                }, function(type,err){ reject(); });
            });
        },
    }); 

    models.load_models({
        model: 'sale.coupon',
        fields: ['display_name', 'write_date', 'code', 'expiration_date', 'state', 'partner_id', 'program_id', 'pos_reference', 'sales_order_id', 'pos_order_id', 'discount_line_product_id'],
        domain: function (self) {
            return [['program_id.active', '=', true], ['program_id.used_in', 'in', ['pos', 'all']]];
        }, //TO ADD: company domain
        loaded: function (self, coupons) {
            self.coupons = coupons;
            self.coupons_by_id = {};
            for (var i = 0; i < coupons.length; i++) {
                self.coupons_by_id[coupons[i].id] = coupons[i];
            }
            self.coupons_by_code = {};
            for (var i = 0; i < coupons.length; i++) {
                self.coupons_by_code[coupons[i].code] = coupons[i];
            }
        },
    });

    models.load_models({
        model: 'sale.coupon.program',
        fields: ['display_name', 'promo_code', 'active', 'promo_applicability', 'program_type', 'reward_type', 'discount_type', 'discount_percentage', 'discount_apply_on', 'rule_products_domain', 'rule_partners_domain', 'rule_min_quantity', 'discount_max_amount', 'discount_line_product_id', 'reward_product_id', 'discount_specific_product_ids', 'reward_product_quantity', 'maximum_use_number', 'order_count', 'currency_id', 'rule_date_from', 'rule_date_to', 'promo_code_usage', 'discount_fixed_amount', 'rule_minimum_amount_tax_inclusion', 'rule_minimum_amount'],
        domain: function (self) {
            return [['active', '=', true], ['used_in', 'in', ['pos', 'all']]];
        }, //TO ADD: company domain
        loaded: function (self, coupon_programs) {
            self.coupon_programs = coupon_programs;
            self.coupon_programs_by_id = {};
            for (var i = 0; i < coupon_programs.length; i++) {
                self.coupon_programs_by_id[coupon_programs[i].id] = coupon_programs[i];
            }
            self.coupon_programs_by_promo_code = {};
            for (var i = 0; i < coupon_programs.length; i++) {
                self.coupon_programs_by_promo_code[coupon_programs[i].promo_code] = coupon_programs[i];
            }
        },
    });
    models.load_models({
        label:  'valid customer',
        loaded: function(self){
            return session.rpc('/web/dataset/call_kw/',{
                model: 'sale.coupon.program',
                method: 'get_valid_partner_pos',
                kwargs: {},
                args: [],
            }).then(function(result) {
                self.is_valid_partners_pos = function(program) {
                    if (program.rule_partners_domain) {
                        var client_id = self.get_client() && self.get_client().id || 0;
                        return _.contains(result[program.id], client_id);
                    } else {
                        return true;
                    }
                };
            });
        },
    });

    var _super_order = models.Order.prototype;

    models.Order = models.Order.extend({
        initialize: function () {
            _super_order.initialize.apply(this, arguments);
            this.coupon = this.coupon || "";
            this.applied_coupons = this.applied_coupons || [];
            this.pos.db.save('set_applied_coupons', []);
            this.code_promo_program_id = this.code_promo_program_id || false;
            this.no_code_promo_program_ids = this.no_code_promo_program_ids || [];
            this.generated_coupons_ids = this.generated_coupons_ids ||  [];
            this.is_auto_apply_promotion = this.is_auto_apply_promotion || false;
            this.applied_promo_code = this.applied_promo_code || false;
            this.valid_products_by_program = this.valid_products_by_program || {};
            this.valid_partner_by_program = this.valid_partner_by_program || {};
            this.program_amount = this.program_amount || 0;
            this.is_valid_partner = this.is_valid_partner || false;
            this.valid_products = this.valid_products || [];
            this.program_currency_rate = this.program_currency_rate || 0.0;
            this.defs = this.defs || [];
        },
        set_coupon: function (coupon) {
            this.coupon = coupon;
        },
        get_coupon: function () {
            return this.coupon;
        },
        set_applied_coupons: function (coupon) {
            if(!_.isEmpty(coupon)){
                this.applied_coupons.push(coupon.id);
            } else {
                this.applied_coupons = [];
            }
            this.pos.db.save('set_applied_coupons', _.uniq(this.applied_coupons));
        },
        get_applied_coupons: function () {
            return this.pos.db.load('set_applied_coupons', []);
        },
        reset_applied_coupons: function(couponsToRemove) {
            this.applied_coupons = _.filter(this.get_applied_coupons(), function(c) {
                return !_.contains(couponsToRemove, c);
            });
            var coupon_filter = _.filter(self.coupons_by_id, function(coupon){
                return _.contains(this.applied_coupons, coupon.id)
            });
            this.set_applied_coupons(coupon_filter);
        },
        set_applied_promo_code: function(promo_code) {
            this.applied_promo_code = promo_code;
        },
        get_applied_promo_code: function() {
            return this.applied_promo_code;
        },
        reset_applied_promo_code: function() {
            this.applied_promo_code = false;
        },

        set_no_code_promo_programs: function(program) {
            this.no_code_promo_program_ids.push(program.id);
        },
        get_no_code_promo_programs: function() {
            return this.no_code_promo_program_ids;
        },
        reset_no_code_promo_programs: function(programsToRemove) {
            this.no_code_promo_program_ids = _.filter(this.get_no_code_promo_programs(), function(p) {
                return !_.contains(programsToRemove, p);
            });
        },
        set_generated_coupons: function(couponId) {
            this.generated_coupons_ids.push(couponId);
        },
        get_generated_coupons: function() {
            return this.generated_coupons_ids;
        },

        set_code_promo_program_id: function (program_id) {
            this.code_promo_program_id = program_id;
        },
        get_code_promo_program_id: function () {
            return this.code_promo_program_id;
        },
        reset_code_promo_program_id: function () {
            this.code_promo_program_id = false;
        },

        _getNoEffectOnThresholdLines: function () {
            var lines = [];
            var code_promo_program = this.get_code_promo_program_id();
            if (code_promo_program) {
                var program = this.pos.coupon_programs_by_id[code_promo_program];
                if (_.isObject(program) && program.reward_type === "discount") {
                    lines = _.filter(this.get_orderlines(), function (line) {
                        return line.product.id === program.discount_line_product_id[0];
                    })
                }
            }
            return lines;
        },

        _filterOnMimimumAmount: function (programs) {
            var self = this;
            var untaxed_amount = self.get_total_without_tax();

            var tax_amount = self.get_total_tax();

            untaxed_amount -= _.reduce(self._getNoEffectOnThresholdLines(), function (length, line) {
                return length + line.get_price_without_tax();
            }, 0);

            tax_amount -= _.reduce(self._getNoEffectOnThresholdLines(), function (length, line) {
                return length + line.get_tax();
            }, 0);

            var get_conversion_rate = function(rule_minimum_amount) {
                var conversion_rate = self.get_program_currency_rate() / self.pos.currency.rate;
                if (conversion_rate === 0 || conversion_rate === 0.0) {
                    return round_pr(rule_minimum_amount);
                }
                return round_pr(rule_minimum_amount * conversion_rate, self.pos.currency.rounding);
            }
            return _.filter(programs, function (program) {
                var program_amount = get_conversion_rate(program.rule_minimum_amount);
                return program.rule_minimum_amount_tax_inclusion === "tax_included" &&
                    program_amount <= untaxed_amount + tax_amount ||
                    program.rule_minimum_amount_tax_inclusion === "tax_excluded" &&
                    program_amount <= untaxed_amount;
            });
        },

        _isGlobalDiscountProgram: function (program) {
            return program.promo_applicability === "on_current_order" &&
                program.reward_type === "discount" &&
                program.discount_type === "percentage" &&
                program.discount_apply_on === "on_order";
        },

        _isGlobalDiscountAlreadyApplied: function () {
            var self = this;

            var applied_coupons = [];
            _.each(self.get_applied_coupons(), function(couponId) {
                applied_coupons.push(self.pos.coupons_by_id[couponId]);
            });

            var applied_coupon_program_ids = [];
            _.each(_.map(applied_coupons, 'program_id'), function(value) {
                applied_coupon_program_ids.push(self.pos.coupon_programs_by_id[value[0]]);
            });

            var no_code_promo_programs = [];
            _.each(self.get_no_code_promo_programs(), function(programId) {
                no_code_promo_programs.push(self.pos.coupon_programs_by_id[programId]);
            });

            var applied_programs = _.union(no_code_promo_programs, applied_coupon_program_ids);

            var code_promo_program_id = self.get_code_promo_program_id();
            if (code_promo_program_id) { applied_programs.push(self.pos.coupon_programs_by_id[code_promo_program_id]); };

            return _.filter(applied_programs, function (program) {
                return self._isGlobalDiscountProgram(program);
            });
        },

        _isRewardInOrderLines: function (order, program) {
            return _.filter(order.get_orderlines(), function (line) {
                return line.product.id && line.product.id === program.reward_product_id[0] &&
                    line.quantity >= program.reward_product_quantity;
            })
        },

        set_valid_products: function (products) {
            this.valid_products = products;
        },

        get_valid_products: function (products) {
            return this.valid_products;
        },

        set_is_auto_apply_promotion: function(isAutoApply) {
            this.is_auto_apply_promotion = isAutoApply;
        },
        get_is_auto_apply_promotion: function() {
            return this.is_auto_apply_promotion;
        },
        set_valid_products_by_program: function(valid_products) {
            this.valid_products_by_program = valid_products;
        },

        get_valid_products_by_program: function(program) {
            return this.valid_products_by_program[program];
        },

        set_valid_partner_by_program: function(valid_partner) {
            this.valid_partner_by_program = valid_partner;
        },

        get_valid_partner_by_program: function(program) {
            return this.valid_partner_by_program[program];
        },

        set_is_valid_partner: function (valid) {
            this.is_valid_partner = valid;
        },
        get_is_valid_partner: function () {
            return this.is_valid_partner;
        },

        set_program_currency_rate: function(rate) {
            this.program_currency_rate = rate;
        },
        get_program_currency_rate: function() {
            return this.program_currency_rate;
        },

        _filterProgramsOnProducts: function (programs) {
            var self = this;
            var orderlines = self.get_orderlines();

            var order_lines = _.without(orderlines, function (line) {
                return _.contains(_.map(self._getRewardLines(), 'id'), line.product.id);
            });
            var products = [];
            var products_qties_defaults = [];
            _.each(_.map(order_lines, 'product'), function (product) {
                products.push(product.id);
                products_qties_defaults.push([product.id, 0]);
            });

            var products_qties = _.object(products_qties_defaults);

            _.each(order_lines, function (line) {
                products_qties[line.product.id] += line.quantity
            });
            var valid_programs = _.filter(programs, function (program) {
                return !program.rule_products_domain;
            });

            _.each(_.without(programs, function (program) {
                return _.contains(_.map(valid_programs, 'id'), program.id);
            }), function (program) {

                var valid_products = self.get_valid_products();
                if (self.get_is_auto_apply_promotion()) { //**IsNeeded
                    valid_products = self.get_valid_products_by_program(program.id);
                }

                var ordered_rule_products_qty = [];
                _.each(valid_products, function(p) {
                    ordered_rule_products_qty.push(products_qties[p])
                });

                ordered_rule_products_qty = _.reduce(ordered_rule_products_qty, function(length, value) { return length + value; });

                if (program.promo_applicability === "on_current_order" &&
                    _.contains(valid_products, program.reward_product_id[0]) &&
                    program.reward_type === "product") {
                    ordered_rule_products_qty -= program.reward_product_quantity
                }
                if (ordered_rule_products_qty >= program.rule_min_quantity) {
                    if (!_.contains((_.map(valid_programs, 'id'), program.id))) {
                        valid_programs.push(program);
                    }
                }
            });
            return valid_programs;
        },

        set_program_amount: function (amount) {
            this.program_amount = amount;
        },

        get_program_amount: function () {
            return this.program_amount;
        },

        _computeProgramAmount: function (program, field, currency_to) {
            var self = this;
            return rpc.query({
                model: 'sale.coupon.program',
                method: 'compute_pos_program_amount',
                args: [program.id, field, currency_to]
            }).then(function (res_amount) {
                return res_amount;
            });
        },

        _getPaidOrderLines: function (orderlines) {
            var self = this;
            var free_reward_products = [];
            _.each(_.map(_.filter(self.pos.coupon_programs, function (program) {
                return program.reward_type === "product";
            }), 'discount_line_product_id'), function (product) {
                free_reward_products.push(product[0]);
            });
            return _.filter(orderlines, function (line) {
                return !line.is_reward_line || _.contains(free_reward_products, line.product.id);
            });
        },

        _getCheapestLine: function (orderlines) {
            return _.min(_.filter(orderlines, function (line) {
                return !line.is_reward_line && line.price > 0;
            }), function (line) {
                return line.price;
            });
        },

        _getRewardValuesDiscountFixedAmount: function (program, orderlines) {
            var self = this;
            var total_amount = _.reduce(_.map(this._getPaidOrderLines(orderlines), function(line) { return line.get_price_with_tax(); }), function (length, value) {
                return length + value;
            }, 0);

            return this._computeProgramAmount(program, 'discount_fixed_amount', this.pos.config.currency_id[0]).then(function (fixed_amount) {
                return (total_amount < fixed_amount) ? total_amount : fixed_amount;
            });
        },

        _getRewardValuesDiscount: function (program) {
            var self = this;
            var order = self.pos.get_order();
            var orderlines = order.get_orderlines();
            if (program.discount_type === "fixed_amount") {
                return self._getRewardValuesDiscountFixedAmount(program, orderlines).then(function (price) {

                    var taxes_ids = self.pos.db.get_product_by_id(Number(program.discount_line_product_id[0])).taxes_id;
                    var taxes = [];
                    for (var i = 0; i < taxes_ids.length; i++) {
                        taxes.push(self.pos.taxes_by_id[taxes_ids[i]]);
                    };
                    var product_id = self.pos.db.get_product_by_id(Number(program.discount_line_product_id[0]));
                    if(product_id && !_.isEmpty(taxes)){
                        product_id.taxes_id = _.map(taxes, "id");
                    }
                    return [{
                        "pos": self.pos,
                        "order": order,
                        "product": self.pos.db.get_product_by_id(Number(program.discount_line_product_id[0])),
                        "quantity": 1,
                        "price": -price,
                        "is_reward_line": true,
                        "taxes": taxes
                    }];
                })
            }
            var reward_dict = {};
            var lines = self._getPaidOrderLines(orderlines);
            if (program.discount_apply_on === "cheapest_product") {
                var line = self._getCheapestLine(orderlines);
                if (line) {
                    var price_reduce = line.price * (1.0 - line.discount / 100.0)
                    var discount_line_amount = price_reduce * (program.discount_percentage / 100);
                    if (discount_line_amount) {
                        var taxes = line.get_taxes();
                        if (order.fiscal_position) {
                            taxes = [];
                            _.each(line.get_taxes(), function(tax) {
                                var line_tax = line._map_tax_fiscal_position(tax);
                                if (tax.id != line_tax.id) {
                                    taxes.push(tax);
                                }
                            });
                        }
                        var product_id = self.pos.db.get_product_by_id(Number(program.discount_line_product_id[0]))
                        if(product_id && !_.isEmpty(taxes)){
                            product_id.taxes_id = _.map(taxes, "id");
                        }
                        reward_dict[_.map(line.get_taxes(), 'id')] = {
                            "pos": self.pos,
                            "order": order,
                            "product": self.pos.db.get_product_by_id(Number(program.discount_line_product_id[0])),
                            "quantity": 1,
                            "price": -discount_line_amount,
                            "taxes": taxes,
                            "is_reward_line": true
                        };
                    }
                }
            } else if (_.contains(['specific_products', 'on_order'], program.discount_apply_on)) {
                if (program.discount_apply_on === "specific_products") {
                    var free_product_lines = [];
                    _.each(_.map(_.filter(self.pos.coupon_programs, function (coupon_program) {
                        return coupon_program.reward_type === "product" && _.contains(program.discount_specific_product_ids, coupon_program.reward_product_id[0]);
                    }), 'discount_line_product_id'), function (product) {
                        free_product_lines.push(product[0]);
                    });
                    lines = _.filter(lines, function (l) {
                        return _.contains(program.discount_specific_product_ids, l.product.id) || _.contains(free_product_lines, l.product.id);
                    });
                }
                var get_reward_values_discount_percentage_per_line = function (program, line) {
                    return (line.get_unit_price() * (program.discount_percentage / 100) * line.get_quantity());
                };
                _.each(lines, function (line) {
                    var discount_line_amount = get_reward_values_discount_percentage_per_line(program, line);
                    if (discount_line_amount) {
                        if (_.has(reward_dict, _.map(line.get_taxes(), 'id'))) {
                            reward_dict[_.map(line.get_taxes(), 'id')]['price'] -= discount_line_amount;
                        } else {
                            var taxes = line.get_taxes();
                            if (order.fiscal_position) {
                                var fiscal_position_taxes = [];
                                _.each(taxes, function (tax) {
                                    var line_tax = line._map_tax_fiscal_position(tax);
                                    if (tax.id != line_tax.id) {
                                        fiscal_position_taxes.push(tax);
                                    }
                                });
                                taxes = fiscal_position_taxes;
                            }
                            var product_id = self.pos.db.get_product_by_id(Number(program.discount_line_product_id[0]))
                            if(product_id && !_.isEmpty(taxes)){
                                product_id.taxes_id = _.map(taxes, "id");
                            }
                            reward_dict[_.map(line.get_taxes(), 'id')] = {
                                "pos": self.pos,
                                "order": order,
                                "product": self.pos.db.get_product_by_id(Number(program.discount_line_product_id[0])),
                                "quantity": 1,
                                "price": -discount_line_amount,
                                "taxes": taxes,
                                "is_reward_line": true
                            };
                        }
                    }
                });
            }
            return self._computeProgramAmount(program, 'discount_max_amount', self.pos.config.currency_id[0]).then(function (max_amount) {
                if (max_amount > 0) {
                    var amount_already_given = 0;
                    _.each(_.keys(reward_dict), function (val) {
                        var amount_to_discount = amount_already_given + reward_dict[val]["price"];
                        if (Math.abs(amount_to_discount) > max_amount) {
                            reward_dict[val]["price"] = -(max_amount - Math.abs(amount_already_given));
                        }
                        amount_already_given += reward_dict[val]["price"];
                        if (reward_dict[val]["price"] === 0) {
                            delete reward_dict[val];
                        }
                    })
                }
                return _.values(reward_dict);
            })

        },

        _getRewardLines: function () {
            var order = this.pos.get_order();
            return _.filter(order.get_orderlines(), function (line) {
                return line.is_reward_line;
            });
        },

        _getRewardValuesProduct: function (program, result) {
            var self = this;
            var order = this.pos.get_order(), reward_line = {}, reward_product_qty;
            var orderlines = order.get_orderlines();
            reward_line = _.filter(orderlines, function (line) {
                return program.reward_product_id[0] === line.product.id;
            });

            var price_reduce = reward_line[0].price * (1.0 - reward_line[0].discount / 100.0)
            var price_unit = reward_line && price_reduce || 0;

            var valid_products;
            if (self.get_is_auto_apply_promotion()) {
                valid_products = self.get_valid_products_by_program(program.id);
            } else {
                if (result && _.has(result, 'valid_products')) {
                    valid_products = result.valid_products;
                } else {
                    valid_products = [];
                }
            }
            if (_.contains(valid_products, program.reward_product_id[0])) {
                var max_product_qty = _.reduce(_.map(reward_line, 'quantity'), function (length, value) {
                    return length + value;
                }, 0) || 1;
                reward_product_qty = Math.floor(max_product_qty / (program.rule_min_quantity + program.reward_product_quantity));
            } else {
                var filter_valid_qty = [];
                _.each(valid_products, function(valid_product) {
                    var filtered_orderlines = _.filter(orderlines, function (line) {
                        return valid_product === line.product.id;
                    });
                    filter_valid_qty.push(filtered_orderlines[0].quantity);
                });
                var max_product_qty = _.reduce(filter_valid_qty, function(length, quantity){
                    return length + quantity;
                }, 0) || 1;
                reward_product_qty = _.min([max_product_qty, reward_line[0].quantity]);
            }
            var reward_qty = _.min([parseInt(parseInt(max_product_qty / program.rule_min_quantity) * program.reward_product_quantity), reward_product_qty]);
            if(program.reward_product_quantity > reward_qty) {
                reward_qty = program.reward_product_quantity
            }
            var ptaxes_ids = self.pos.db.get_product_by_id(program.reward_product_id[0]).taxes_id;
            var ptaxes_set = {};
            for (var i = 0; i < ptaxes_ids.length; i++) {
                ptaxes_set[ptaxes_ids[i]] = true;
            }
            var taxes = [];
            for (var i = 0; i < self.pos.taxes.length; i++) {
                if (ptaxes_set[self.pos.taxes[i].id]) {
                    taxes.push(self.pos.taxes[i]);
                }
            }

            if (order.fiscal_position) {
                taxes = [];
                var line = _.first(_.filter(orderlines, function(line) { return line.product.id === program.reward_product_id[0]; }));
                if (!_.isUndefined(line)) {
                    _.each(line.get_taxes(), function(tax) {
                        var line_tax = line._map_tax_fiscal_position(tax);
                        if (tax.id != line_tax.id) {
                            taxes.push(tax);
                        }
                    });
                }
            }
            var product_id = self.pos.db.get_product_by_id(Number(program.discount_line_product_id[0]));
            if(product_id && !_.isEmpty(taxes)) {
                product_id.taxes_id = _.map(taxes, "id");
            }
            return Promise.resolve([{
                "pos": self.pos,
                "order": order,
                "product": self.pos.db.get_product_by_id(Number(program.discount_line_product_id[0])),
                "quantity": reward_qty,
                "price": -price_unit,
                "taxes": taxes,
                "is_reward_line": true
            }]);
        },

        _getRewardLineValues: function (program, result) {
            var self = this;
            if (program.reward_type === "discount") {
                return self._getRewardValuesDiscount(program);
            } else if (program.reward_type === "product") {
                return self._getRewardValuesProduct(program, result);
            }
        },

        _createRewardLine: function (program, result) {
            var self = this, def_statement;
            var order = this.pos.get_order();
            return self._getRewardLineValues(program, result).then(function (lines) {
                _.each(lines, function (reward_line) {
                    var disc_line = new models.Orderline({}, reward_line);
                    disc_line.set_is_reward_line(reward_line.is_reward_line);
                    disc_line.set_applicable_reward_taxes(reward_line.taxes);
                    disc_line.set_quantity(reward_line.quantity);
                    disc_line.set_unit_price(reward_line.price);
                    disc_line.price_manually_set = true;
                    if (program && program.promo_code && program.program_type == 'promotion_program' && program.promo_applicability == 'on_current_order' ) {
                        disc_line.set_line_code_promo_program_id(program.id)
                    }
                    return order.add_orderline(disc_line);
                });
            })
        },

        _filter_not_ordered_reward_programs: function (self_programs) {
            var self = this;
            var programs = [];
            for (var i = 0, l = self_programs.length; i < l; i++) {
                var program = self_programs[i];
                if (program.reward_type === "product" && _.isEmpty(_.filter(self.get_orderlines(), function(line){ return line.product.id === program.reward_product_id[0];}))) {
                    continue;
                } else if (program.reward_type === "discount" && program.discount_apply_on === "specific_products" && _.isEmpty(_.filter(self.get_orderlines(), function(line) { return _.contains(program.discount_specific_product_ids, line.product.id); }))) {
                    continue;
                }
                if (!_.contains(programs, program)) {
                    programs.push(program);
                }
            }
            return programs;
        },

        _filter_programs_from_common_rules: function (programs, next_order) {
            var self = this;

            if (!next_order || _.isUndefined(next_order)) {
                programs = self._filterOnMimimumAmount(programs);
            }
            var filter_on_validity_dates = function (programs) {
                return _.filter(programs, function (program) {
                    return program.rule_date_from && program.rule_date_to &&
                        time.auto_str_to_date(program.rule_date_from) <= self.creation_date && time.auto_str_to_date(program.rule_date_to) >= self.creation_date ||
                        !program.rule_date_from || !program.rule_date_to;
                });
            };

            var filter_unexpired_programs = function (programs) {
                return _.filter(programs, function (program) {
                    return program.maximum_use_number === 0 || program.order_count <= program.maximum_use_number;
                });
            };

            var filter_programs_on_partners = function (programs) {
                return _.filter(programs, function (program) {
                    return self.pos.is_valid_partners_pos(program);
                });
            };

            var programs = filter_on_validity_dates(programs);
            var programs = filter_unexpired_programs(programs);
            programs = filter_programs_on_partners(programs);
            if (!next_order || _.isUndefined(next_order)) {
                programs = self._filterProgramsOnProducts(programs);
            }
            var programs_curr_order = _.filter(programs, function (program) {
                return program.promo_applicability === "on_current_order";
            });
            programs = _.filter(programs, function (program) {
                return program.promo_applicability === "on_next_order";
            });
            if (programs_curr_order) {
                programs = _.union(programs, self._filter_not_ordered_reward_programs(programs_curr_order));
            }
            return programs;
        },

        _getApplicablePrograms: function () {
            var self = this;
            var programs = _.filter(self.pos.coupon_programs, function (program) {
                return _.contains(_.map(self._filter_programs_from_common_rules(self.pos.coupon_programs), 'id'), program.id);
            });
            var filter_promo_programs_with_code = function (programs, promo_code) {
                return _.filter(programs, function (program) {
                    program.promo_code_usage === "code_needed" && program.promo_code !== promo_code;
                });
            }

            if (self.get_code_promo_program_id())  {
                var code_promo_program = self.pos.coupon_programs_by_id[self.get_code_promo_program_id()];

                if (code_promo_program && code_promo_program.promo_code) {
                    var programs_by_promo_code = filter_promo_programs_with_code(programs, code_promo_program.promo_code);
                    if (!_.isEmpty(programs_by_promo_code)) {
                        programs = programs_by_promo_code;
                    }
                }
            }

            return programs;
        },

        _getCouponUsedInOrderReference: function(coupon) {
            var order_reference;
            if (!_.isBoolean(coupon.sales_order_id)) {
                order_reference = "Sales order by " + coupon.sales_order_id[1];
            } else if (!_.isBoolean(coupon.pos_order_id)) {
                order_reference = "POS order by " + coupon.pos_order_id[1];
            }
            return order_reference;
        },

        _checkCouponCode: function (order, coupon) {
            var self = this;
            var message;
            var program = self.pos.coupon_programs_by_id[coupon.program_id[0]];
            var partner_id = order.get_client() ? order.get_client().id : 0;
            var applied_coupons = [];
            _.each(self.get_applied_coupons(), function(couponId) {
                applied_coupons.push(self.pos.coupons_by_id[couponId]);
            });
            var applied_programs = [];
            _.each(applied_coupons, function(coupon) {
                applied_programs.push(coupon.program_id[0]);
            });
            var applicable_programs = self._getApplicablePrograms();
            if (_.contains(applied_programs, program.id) || (coupon.state === "used" && coupon.pos_reference == self.get_name())) {
                message = {'error': _t("A Coupon is already applied for the same reward.")};
            } else if (coupon.state === "used" && !_.isUndefined(self._getCouponUsedInOrderReference(coupon))) {
                message = {'error': _.str.sprintf(_t("This coupon %s has been used in %s on %s."), coupon.code, self._getCouponUsedInOrderReference(coupon), field_utils.format.datetime(moment(coupon.write_date)))};
            } else if (coupon.state === "used") {
                message = {'error': _.str.sprintf(_t("This coupon %s has been used either in Sales Order or in POS Order on %s."), coupon.code, field_utils.format.datetime(moment(coupon.write_date)))};
            } else if (coupon.state === "expired" || (coupon.expiration_date && time.auto_str_to_date(coupon.expiration_date) < new Date(order.creation_date.getFullYear(), order.creation_date.getMonth(), order.creation_date.getDate(), 0, 0, 0))) {
                message = {'error': _.str.sprintf(_t("This coupon %s is expired on %s."), coupon.code, field_utils.format.date(moment(coupon.expiration_date)))};
            } else if (coupon.state === "reserved") {
                message = {'error': _.str.sprintf(_t("This coupon %s exists but the origin order is not validated yet."), coupon.code)};
            } else if (program.program_type === "coupon_program" && !self._filterOnMimimumAmount([program]).length) {
                message = {'error': _.str.sprintf(_t("A minimum of %s %s should be purchased to get the reward."), program.rule_minimum_amount, program.currency_id[1])};
            } else if (!program.active) {
                message = {'error': _.str.sprintf(_t("The coupon program for %s is in draft or closed state."), coupon.code)};
            } else if (!order.get_client()) {
                message = {'error': _t("Please select customer.")};
            } else if (coupon.partner_id[0] && coupon.partner_id[0] !== partner_id) {
                message = {'error': _.str.sprintf(_t("Invalid customer, this coupon %s is valid for %s."), coupon.code, coupon.partner_id[1])};
            } else if (self._isGlobalDiscountProgram(program) && !_.isEmpty(self._isGlobalDiscountAlreadyApplied())) {
                message = {'error': _t("Global discounts are not cumulable.")};
            } else if (program.reward_type === "product" && !self._isRewardInOrderLines(order, program).length) {
                message = {'error': _t("The reward products should be in the order lines to apply the discount.")};
            } else if (!self.get_is_valid_partner()) {
                message = {'error': _t("The customer doesn't have access to this reward.")};
            } else if (program.program_type === "coupon_program" && _.isEmpty(self._filterProgramsOnProducts([program]))) {
                message = {'error': _t("You don't have the required product quantities on your order. All the products should be recorded on the order. (Example: You need to have 3 T-shirts on your order if the promotion is 'Buy 2, Get 1 Free').")};
            } else {
                if (_.isEmpty(applicable_programs) || applicable_programs.length && !_.contains(_.map(applicable_programs, 'id'), program.id) && program.promo_applicability === "on_current_order") {
                    message = {'error': _t("At least one of the required conditions is not met to get the reward!")};
                }
            }
            return message;
        },

        _checkPromoCode: function (order, program, coupon_code) {
            var self = this;
            var message;
            var partner_id = order.get_client() ? order.get_client().id : 0;
            var applicable_programs = self._getApplicablePrograms();
            if (program.maximum_use_number !== 0 && program.order_count >= program.maximum_use_number) {
                message = {'error': _.str.sprintf(_t("Promo code %s has been expired."), coupon_code)};
            } else if (!self._filterOnMimimumAmount([program]).length) {
                message = {'error': _.str.sprintf(_t("A minimum of %s %s should be purchased to get the reward."), program.rule_minimum_amount, program.currency_id[1])};
            } else if (program.promo_code && program.promo_code === self.get_applied_promo_code()) {
                message = {'error': _t("The promo code is already applied on this order")};
            } else if (!program.promo_code && _.contains(order.get_no_code_promo_programs(), program.id)) {
                message = {'error': _t("The promotional offer is already applied on this order")};
            } else if (!program.active) {
                message = {'error': _t("Promo code is invalid")};
            } else if ((program.rule_date_from && time.auto_str_to_date(program.rule_date_from) > order.creation_date) || (program.rule_date_to && order.creation_date > time.auto_str_to_date(program.rule_date_to))) {
                message = {'error': _.str.sprintf(_t("Promo code is expired on %s."), field_utils.format.datetime(moment(program.rule_date_to)))};
            } else if (order.get_applied_promo_code() && program.promo_code_usage === "code_needed") {
                message = {'error': _t("Promotionals codes are not cumulative.")};
            } else if (self._isGlobalDiscountProgram(program) && !_.isEmpty(self._isGlobalDiscountAlreadyApplied())) {
                message = {'error': _t("Global discounts are not cumulative.")};
            } else if (program.promo_applicability === "on_current_order" && program.reward_type === "product" && !self._isRewardInOrderLines(order, program).length) {
                message = {'error': _t("The reward products should be in the order lines to apply the discount.")};
            } else if (!order.get_client()) {
                message = {'error': _t("Please select customer.")};
            } else if (!self.get_is_valid_partner()) {
                if (!self.get_is_auto_apply_promotion()) {
                    message = {'error': _("The customer doesn't have access to this reward.")};
                } else {
                    if (!self.get_valid_partner_by_program(program.id)) {
                        message = {'error': _("The customer doesn't have access to this reward.")};
                    }
                }
            } else if (_.isEmpty(self._filterProgramsOnProducts([program]))) {
                message = {'error': _t("You don't have the required product quantities on your order. If the reward is same product quantity, please make sure that all the products are recorded on the order (Example: You need to have 3 T-shirts on your order if the promotion is 'Buy 2, Get 1 Free'.")};
            } else {
                if (_.isEmpty(applicable_programs) || applicable_programs.length && !_.contains(_.map(applicable_programs, 'id'), program.id) && program.promo_applicability === "on_current_order") {
                    message = {'error': _t("At least one of the required conditions is not met to get the reward!")};
                }
            }
            return message;
        },

        applyCoupon: function (coupon_code, result) {
            var self = this;
            var order = this.pos.get_order();
            var orderlines = order.get_orderlines();
            var error_status;
            var valid_program = function() {
                return _.filter(self.pos.coupon_programs, function (program) {
                    return program.promo_code === coupon_code;
                });
            }
            if (self.pos.is_valid_partners_pos(valid_program)) {
                var program = valid_program()[0];
                if (_.isObject(program)) {
                    error_status = self._checkPromoCode(order, program, coupon_code);
                    if (!error_status) {
                        if (program.promo_applicability === "on_next_order") {

                            var generated_coupons = [];
                            _.each(self.get_generated_coupons(), function(couponId) {
                                generated_coupons.push(self.pos.coupons_by_id[couponId])
                            })
                            var generated_coupons_discount_line_product_ids = [];
                            _.each(_.map(_.filter(generated_coupons, function(coupon) { return _.contains(['new', 'reserved'], coupon.state) }),
                                'discount_line_product_id'), function(p) {
                                generated_coupons_discount_line_product_ids.push(p[0]);
                            });

                            if (!_.contains(generated_coupons_discount_line_product_ids, program.discount_line_product_id[0])) {
                                return self._create_reward_coupon(program).then(function(couponId) {
                                    if (!_.contains(self.get_generated_coupons(), couponId)) {
                                        self.set_generated_coupons(couponId);
                                        return self.reload_coupons().then(function(){
                                            return couponId;
                                        });
                                    }
                                    return couponId;
                                });
                            }
                        } else {
                            return self._createRewardLine(program, result).then(function () {
                                order.set_applied_promo_code(coupon_code);
                                order.set_code_promo_program_id(program.id);
                            });
                        }
                    }
                } else {
                    var coupon = self.pos.coupons_by_code[coupon_code];
                    if (_.isObject(coupon)) {
                        var program = self.pos.coupon_programs_by_id[coupon.program_id[0]];
                        var error_status = self._checkCouponCode(order, coupon);
                        if (!error_status) {
                            return self._createRewardLine(program, result).then(function () {
                                return rpc.query({
                                    model: 'sale.coupon',
                                    method: 'write',
                                    args: [coupon.id, {'pos_reference': order.get_name(), 'state': 'used'}]
                                }).then(function(res) {
                                    self.set_applied_coupons(coupon);
                                    self.pos.load_new_coupons([coupon.id]); //**Def
                                })
                            })

                        }
                    } else {
                        var error_status = {'not_found': _.str.sprintf(_t("The code %s is invalid."), coupon_code)};
                    }
                }
                return error_status;
            } else {
                return error_status = {'error': _("Please select customer.")};
            }
        },

        processCoupon: function (coupon_code) {
            var self = this;
            var order = self.pos.get_order();
            var client = self.get_client() ? self.get_client().id : 0;
            return rpc.query({
                model: 'sale.coupon.program',
                method: 'check_pos_coupon',
                args: [coupon_code, order.export_as_JSON(), client]
            }).then(function (result) {
                self.result = result;
                if (result.is_valid_coupon === true) {
                    self.set_program_currency_rate(result.currency_rate);
                    self.set_is_valid_partner(result.is_valid_partner);
                    self.set_valid_products(result.valid_products);
                    var error_status = self.applyCoupon(coupon_code, result);
                    if (_.has(error_status, "error")) {
                        return self.pos.gui.show_popup('error', {
                            title: _t('Oops! Failed to apply coupon.'),
                            body: error_status.error,
                        });
                    } else if (_.has(error_status, "not_found")) {
                        return self.pos.gui.show_popup('error', {
                            title: _t('Oops! Coupon is not valid.'),
                            body: error_status.not_found,
                        });
                    }
                } else {
                    var error_status;
                    var coupon = self.pos.coupons_by_code[coupon_code];
                    if (_.isObject(coupon) || !_.isUndefined(coupon)) {
                        error_status = self._checkCouponCode(order, coupon);
                    } else {
                        error_status = {'not_found': _.str.sprintf(_t("The code %s is invalid."), coupon_code)};
                    }

                    if (_.has(error_status, "error")) {
                        return self.pos.gui.show_popup('error', {
                            title: _t('Oops! Coupon is not valid.'),
                            body: error_status.error,
                        });
                    } else if (_.has(error_status, "not_found")) {
                        return self.pos.gui.show_popup('error', {
                            title: _t('Oops! Coupon is not found.'),
                            body: error_status.not_found,
                        });
                    }
                }
            });
        },

        _get_applicable_no_code_promo_program: function() {
            return this._filter_programs_from_common_rules(_.filter(this.pos.coupon_programs, function(program) { return program.promo_code_usage === "no_code_needed"; }));
        },

        _keep_only_most_interesting_auto_applied_global_discount_program: function(programs) {
            var self = this;
            var globalPrograms = _.filter(programs, function(program) { return self._isGlobalDiscountProgram(program) && program.promo_code_usage === "no_code_needed"; });
            if (_.isEmpty(globalPrograms)) { return programs; };
            return _.difference(programs, _.without(globalPrograms, _.max(globalPrograms, function(program){ return program.discount_percentage; })));
        },

        _get_valid_applied_coupon_program: function() {
            var self = this;

            var applied_coupons = [];
            _.each(self.get_applied_coupons(), function(couponId) {
                applied_coupons.push(self.pos.coupons_by_id[couponId]);
            });

            var applied_coupon_programs = [];
            _.each(_.map(applied_coupons, 'program_id'), function(value) {
                applied_coupon_programs.push(self.pos.coupon_programs_by_id[value[0]]);
            });

            return _.union(self._filter_programs_from_common_rules(_.filter(applied_coupon_programs, function(program) { return program.promo_applicability === "on_next_order"; }), true),
                self._filter_programs_from_common_rules(_.filter(applied_coupon_programs, function(program) { return program.promo_applicability === "on_current_order"; })));

        },

        _get_applied_programs_with_rewards_on_current_order: function() {
            var self = this;

            var applied_coupons = [];
            _.each(self.get_applied_coupons(), function(couponId) {
                applied_coupons.push(self.pos.coupons_by_id[couponId]);
            });

            var applied_coupon_program_ids = [];
            _.each(_.map(applied_coupons, 'program_id'), function(value) {
                applied_coupon_program_ids.push(self.pos.coupon_programs_by_id[value[0]]);
            });

            var code_promo_program_id = self.get_code_promo_program_id();
            var code_promo_program_id_obj = [];
            if (_.isNumber(code_promo_program_id)) {
                code_promo_program_id_obj = [self.pos.coupon_programs_by_id[code_promo_program_id]];
            }

            var no_code_promo_programs = [];

            _.each(self.get_no_code_promo_programs(), function(progamId) {
                no_code_promo_programs.push(self.pos.coupon_programs_by_id[progamId]);
            })

            return _.union(_.filter(no_code_promo_programs, function (p) { return p.promo_applicability === "on_current_order"; }),
                applied_coupon_program_ids, _.filter(code_promo_program_id_obj, function(promo_program) { return promo_program.promo_applicability === "on_current_order"; }));
        },

        _get_applied_programs_with_rewards_on_next_order: function() {
            var self = this;

            var no_code_promo_program_ids = [];
            _.each(this.get_no_code_promo_programs(), function(progamId) {
                no_code_promo_program_ids.push(self.pos.coupon_programs_by_id[progamId]);
            })

            var code_promo_program_id = self.get_code_promo_program_id();
            var code_promo_program_id_obj = [];
            if (_.isNumber(code_promo_program_id)) {
                code_promo_program_id_obj = [self.pos.coupon_programs_by_id[code_promo_program_id]];
            }

            return _.union(_.filter(no_code_promo_program_ids, function(p) { return p.promo_applicability === "on_next_order"; }),
                _.filter(code_promo_program_id_obj, function (p) { return p.promo_applicability === "on_next_order"}));
        },

        _remove_invalid_reward_lines: function() {
            var self = this;
            var applicable_programs = _.union(self._get_applicable_no_code_promo_program(), self._getApplicablePrograms(), self._get_valid_applied_coupon_program());
            applicable_programs = self._keep_only_most_interesting_auto_applied_global_discount_program(applicable_programs);
            var applied_programs = _.union(self._get_applied_programs_with_rewards_on_current_order(), self._get_applied_programs_with_rewards_on_next_order());


            var programs_to_remove = _.difference(_.map(applied_programs, 'id'), _.map(applicable_programs, 'id'));
            var products_to_remove = [];
            _.each(programs_to_remove, function(programId) {
                products_to_remove.push(self.pos.coupon_programs_by_id[programId].discount_line_product_id[0]);
            });

            var applied_programs_discount_line_product_ids = [];
            _.each(_.map(applied_programs, 'discount_line_product_id'), function(p) {
                applied_programs_discount_line_product_ids.push(p[0]);
            });

            // delete reward line coming from an archived coupon (it will never be updated/removed when recomputing the order)
            var invalid_lines = _.filter(self.get_orderlines(), function(line) {
                return line.is_reward_line && !_.contains(applied_programs_discount_line_product_ids, line.product.id);
            })

            // Invalid generated coupon for which we are not eligible anymore ('expired' since it is specific to this SO and we may again met the requirements)
            var generated_coupon_ids = [];
            _.each(self.get_generated_coupons(), function(couponId) {
                generated_coupon_ids.push(self.pos.coupons_by_id[couponId])
            });
            var coupons_to_expire = _.filter(generated_coupon_ids, function(c) {
                return _.contains(products_to_remove, self.pos.coupon_programs_by_id[c.program_id[0]].discount_line_product_id[0]);
            });

            return rpc.query({
                model: 'sale.coupon',
                method: 'write',
                args: [_.map(coupons_to_expire, 'id'), {'state': 'expired'}]
            }).then(function() {
                var coupons_to_remove = [];
                _.each(self.get_applied_coupons(), function(c) {
                    coupons_to_remove.push(self.pos.coupons_by_id[c]);
                });

                coupons_to_remove = _.filter(coupons_to_remove, function(cr) { return _.contains(programs_to_remove, cr.program_id[0]); });

                return rpc.query({
                    model: 'sale.coupon',
                    method: 'write',
                    args: [_.map(coupons_to_remove, 'id'), {'state': 'new'}]
                }).then(function() {
                    if (!_.isEmpty(programs_to_remove)) {
                        self.reset_no_code_promo_programs(programs_to_remove);
                    }
                    self.reset_applied_coupons(coupons_to_remove);

                    _.each(_.filter(self.get_orderlines(), function(line) { return _.contains(products_to_remove, line.product.id); }), function(orderline) {
                        if (!_.contains(_.map(invalid_lines, 'id'), orderline.id)) {
                            invalid_lines.push(orderline);
                        }
                    });

                    _.each(invalid_lines, function(line2remove) {
                        return self.remove_orderline(line2remove);
                    });
                });
            });
        },

        _create_reward_coupon: function(program) {
            var self = this;
            var def = new $.Deferred();

            var coupons = _.filter(self.pos.coupons, function(coupon) {
                return coupon.program_id[0] === program.id &&
                coupon.state === "expired" &&
                (coupon.partner_id && coupon.partner_id[0]) === (self.get_client() ? self.get_client().id : false) &&
                coupon.pos_reference === self.get_name() &&
                coupon.discount_line_product_id[0] === program.discount_line_product_id[0]
            });
            var coupon = coupons[0];
            if (!_.isUndefined(coupon)) {
                def = rpc.query({
                    model: 'sale.coupon',
                    method: 'write',
                    args: [coupon.id, {'state': 'reserved'}]
                }).then(function(res) {
                    if(res === true) {
                        return coupon.id;
                    }
                });
            } else {
                var AlreadyCreatedCoupons = _.filter(self.pos.coupons, function(coupon) {
                    return coupon.program_id[0] === program.id &&
                    coupon.state === "reserved" &&
                    (coupon.partner_id && coupon.partner_id[0]) === (self.get_client() ? self.get_client().id : false) &&
                    coupon.pos_reference === self.get_name() &&
                    coupon.discount_line_product_id[0] === program.discount_line_product_id[0]
                });
                if (_.isEmpty(AlreadyCreatedCoupons)) {
                    def = rpc.query({
                        model: 'sale.coupon',
                        method: 'create',
                        args: [{
                            'program_id': program.id,
                            'state': "reserved",
                            'partner_id': self.get_client() ? self.get_client().id : false,
                            'pos_reference': self.get_name(),
                            'discount_line_product_id': program.discount_line_product_id[0]
                        }]
                    }).then(function(coupon_id) {
                        return coupon_id;
                    });
                }
            }
            return def;
        },

        reload_coupons: function(){
            var self = this;
            return this.pos.load_new_coupons(self.get_generated_coupons());
        },

        _create_new_no_code_promo_reward_lines: function() {
            var self = this;
            var programs = self._get_applicable_no_code_promo_program();
            programs = programs = self._keep_only_most_interesting_auto_applied_global_discount_program(programs);

            var defs = [];
            var def;

            _.each(programs, function(program) {
                var error_status = self._checkPromoCode(self.pos.get_order(), program, false);
                if (!_.has(error_status, 'error')) {
                    if (program.promo_applicability === "on_next_order") {
                        def = self._create_reward_coupon(program).then(function(couponId) {
                            if (!_.contains(self.get_generated_coupons(), couponId)) {
                                self.set_generated_coupons(couponId);
                                return self.reload_coupons().then(function(){
                                    if (!self.get_no_code_promo_programs().includes(program.id)) {
                                        self.set_no_code_promo_programs(program);
                                    }
                                    return couponId;
                                });
                            }
                            if (!self.get_no_code_promo_programs().includes(program.id)) {
                                self.set_no_code_promo_programs(program);
                            }
                            return couponId;
                        });
                        defs.push(def);
                    } else if (!_.contains(_.map(_.map(self.get_orderlines(), 'product'), 'id'), program.discount_line_product_id[0])) {
                        def = self._getRewardLineValues(program, self.result).then(function (lines) {
                            _.each(lines, function(line) {
                                var disc_line = new models.Orderline({}, line);
                                disc_line.set_is_reward_line(line.is_reward_line);
                                disc_line.set_applicable_reward_taxes(line.taxes);
                                disc_line.price_manually_set = true;
                                self.add_orderline(disc_line);
                            });
                            if (!self.get_no_code_promo_programs().includes(program.id)) {
                                self.set_no_code_promo_programs(program);
                            }
                        });
                        defs.push(def);
                    }
                    if (!self.get_no_code_promo_programs().includes(program.id)) {
                        self.set_no_code_promo_programs(program);
                    }
                }
            });
            return $.when.apply($, defs);
        },

        _update_existing_reward_lines: function() {

            var symmetric_difference = function(a, b) {
                _.each(b, function(i) {
                    if ($.inArray(i, a) != -1) {
                        delete a[_.indexOf(a, i)];
                    } else {
                        a.push(i);
                    };
                });
                return _.compact(a);
            };

            var update_line = function(program, lines, value) {
                var lines_to_remove = [];
                if (value.quantity && value.price) {
                    _.each(lines, function(line) {
                        line.set_quantity(value.quantity);
                        line.set_unit_price(value.price);
                    });
                } else {
                    if (program.reward_type !== "free_shipping") {
                        lines_to_remove.push(lines);
                    } else {
                        value.price = 0.0;
                        _.each(lines, function(line) {
                            line.set_quantity(value.quantity);
                            line.set_unit_price(value.price);
                        });
                    }
                }
                return lines_to_remove;
            };

            var self = this;

            _.each(self._get_applied_programs_with_rewards_on_current_order(), function(program) {
                self._getRewardLineValues(program, self.result).then(function (values) {
                    var lines =_.filter(self.get_orderlines(), function(line) { return line.product.id === program.discount_line_product_id[0]; });
                    if (program.reward_type === "discount" && program.discount_type === "percentage") {
                        var lines_to_remove = lines;
                        _.each(values, function(value) {
                            var value_found = false;
                            for (var i = 0; i < lines.length; i++) {
                                if (_.isEmpty(symmetric_difference(_.map(lines[i].get_taxes(), 'id'), _.map(value.taxes, 'id')))) {
                                    value_found = true
                                    lines_to_remove = _.without(lines_to_remove, lines[i]);
                                    lines_to_remove = _.union(lines_to_remove, update_line(program, [lines[i]], value));
                                    // continue in backend
                                    break;
                                };
                            };

                            if (!value_found) {
                                var disc_line = new models.Orderline({}, value);
                                disc_line.set_is_reward_line(value.is_reward_line);
                                disc_line.set_applicable_reward_taxes(value.taxes);
                                disc_line.price_manually_set = true;
                                self.add_orderline(disc_line);
                            };
                        });
                        _.each(lines_to_remove, function (line) {
                            $.when(self.remove_orderline(line)).then(function() {
                                if (!self.get_no_code_promo_programs().includes(program.id)) {
                                    self.set_no_code_promo_programs(program);
                                }
                            });
                        });
                    } else {
                        // update line order to program
                        _.each(update_line(program, lines, values[0]), function (line) {
                            $.when(self.remove_orderline(line)).then(function() {
                                if (!self.get_no_code_promo_programs().includes(program.id)) {
                                    self.set_no_code_promo_programs(program);
                                }
                            });
                        });
                    }
                });
            });
        },

        get_valid_products_on_programs: function() {
            var self = this;
            return rpc.query({
                model: 'sale.coupon.program',
                method: 'get_valid_products_on_programs',
                args: [_.map(self.pos.coupon_programs, 'id'), self.export_as_JSON(), self.get_client() ? self.get_client().id : 0]
            }).then(function (result) {
                self.set_valid_products_by_program(result[0]);
                self.set_valid_partner_by_program(result[1]);
            })
        },

        updatePromotions: function() {
            var self = this;
            self.set_is_auto_apply_promotion(true);
            return self.get_valid_products_on_programs().then(function() {
                return self._remove_invalid_reward_lines().then(function () {
                    return self._create_new_no_code_promo_reward_lines().then(function() {
                        self._update_existing_reward_lines();
                    });
                });
            })
        },

        reset_applied_promo_code_on_remove_line: function(line) {
            var self = this;
            if (self.get_code_promo_program_id()) {
                self.reset_code_promo_program_id();
                self.reset_applied_promo_code();
            }
        },

        reset_applied_coupons_on_remove_line: function(line) {
            // _.isArray(line) && (line = line[0]);
            var self = this;
            if (!_.isEmpty(this.get_applied_coupons())) {
                if (line.get_is_reward_line()) {
                    var coupons_to_reactivate = _.filter(self.get_applied_coupons(), function(couponId) {
                        return self.pos.coupon_programs_by_id[self.pos.coupons_by_id[couponId].program_id[0]].discount_line_product_id[0] === line.product.id;
                    });
                    return rpc.query({
                        model: 'sale.coupon',
                        method: 'write',
                        args: [coupons_to_reactivate, {'state': 'new', 'pos_reference': false}]
                    }).then(function (res) {
                        if (res === true) {
                            // self.reset_applied_coupons(coupons_to_reactivate);
                            return self.pos.load_new_coupons(coupons_to_reactivate).then(function() {

                                self.reset_applied_coupons(coupons_to_reactivate);
                            });
                        }
                    });
                }
            }
        },

        reset_applied_related_programs: function(line) {
            // _.isArray(line) && (line = line[0]);
            var self = this;
            var related_program = _.filter(self.pos.coupon_programs, function(program) { return program.discount_line_product_id[0] === line.product.id; });
            if (!_.isEmpty(related_program)) {
                var programs_to_reset = _.map(related_program, 'id');
                if (!_.isEmpty(programs_to_reset)) {
                    self.reset_no_code_promo_programs(programs_to_reset);
                }
                self.reset_code_promo_program_id();
            }
        },

        remove_orderline: function(line) {
            if (_.isObject(line) || !_.isUndefined(line)) {
                if (line.is_reward_line) {
                    this.reset_applied_promo_code_on_remove_line(line);
                    this.reset_applied_coupons_on_remove_line(line);
                    this.reset_applied_related_programs(line);
                }
            }
            _super_order.remove_orderline.apply(this, arguments);
        },
        init_from_JSON: function (json) {
            _super_order.init_from_JSON.apply(this, arguments);
            this.coupon = json.coupon;
            this.applied_coupons = json.applied_coupons;
            this.applied_promo_code = json.applied_promo_code;
            this.generated_coupons_ids = json.generated_coupons_ids;
            this.code_promo_program_id = json.code_promo_program_id;
            this.no_code_promo_program_ids = json.no_code_promo_program_ids;
        },
        export_as_JSON: function () {
            var json = _super_order.export_as_JSON.call(this);
            json.coupon = this.get_coupon();
            json.applied_coupons = this.pos.db.load('set_applied_coupons', []);
            json.applied_promo_code = this.get_applied_promo_code();
            json.generated_coupons_ids = this.get_generated_coupons();
            json.code_promo_program_id = this.get_code_promo_program_id();
            json.no_code_promo_program_ids = this.get_no_code_promo_programs();
            return json;
        },
    });

    var _super_orderline = models.Orderline.prototype;

    models.Orderline = models.Orderline.extend({
        initialize: function () {
            _super_orderline.initialize.apply(this, arguments);
            this.is_reward_line = this.is_reward_line || false;
            this.applicable_reward_taxes = this.applicable_reward_taxes || [];
            this.line_code_promo_program_id = this.line_code_promo_program_id || false;
        },

        set_is_reward_line: function (is_reward_line) {
            this.is_reward_line = is_reward_line;
        },
        get_is_reward_line: function () {
            return this.is_reward_line;
        },
        set_applicable_reward_taxes: function(taxes) {
            this.applicable_reward_taxes = taxes;
        },
        get_applicable_reward_taxes: function() {
            return this.applicable_reward_taxes;
        },

        get_reward_taxes_str: function() {
            var reward_taxes = this.get_applicable_reward_taxes();
            this.taxes_str = "";
            if (reward_taxes.length === 1) {
                this.taxes_str = " - " + _t("On product with following tax: ") + _.map(reward_taxes, 'name').join(", ");
            } else if (reward_taxes.length > 1) {
                this.taxes_str = " - " + _t("On product with following taxes: ") + _.map(reward_taxes, 'name').join(", ");
            };
            return this.taxes_str;
        },

        // code_promo_program_id
        set_line_code_promo_program_id: function (program_id) {
            this.line_code_promo_program_id = program_id;
        },
        get_line_code_promo_program_id: function () {
            return this.line_code_promo_program_id;
        },
        reset_line_code_promo_program_id: function () {
            this.line_code_promo_program_id = false;
        },

        init_from_JSON: function(json) {
            _super_orderline.init_from_JSON.apply(this, arguments);
            this.is_reward_line = json.is_reward_line;
            this.price_manually_set = json.price_manually_set;
            this.line_code_promo_program_id = json.line_code_promo_program_id;
            this.applicable_reward_taxes = json.applicable_reward_taxes;
            this.taxes_str = json.taxes_str;
        },

        export_as_JSON: function () {
            var json = _super_orderline.export_as_JSON.call(this);
            json.is_reward_line = this.get_is_reward_line();
            json.price_manually_set = this.price_manually_set;
            var reward_taxes = this.get_applicable_reward_taxes();
            json.applicable_reward_taxes = reward_taxes;
            if (this.get_is_reward_line() && (!_.isEmpty(reward_taxes) || !_.isUndefined(reward_taxes))) {
                json.tax_ids = [[6, false, _.map(reward_taxes, function(tax){ return tax.id; })]];
                this.get_product().taxes_id = _.map(reward_taxes, "id")
                json.product_id = this.get_product().id;
                var price_unit = this.get_unit_price() * (1.0 - (this.get_discount() / 100.0));
            }
            json.taxes_str = this.get_reward_taxes_str();
            json.line_code_promo_program_id = this.get_line_code_promo_program_id();
            return json;
        },

    });
    return models;
});