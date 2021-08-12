/*
 * This file is part of the BigConnect project.
 *
 * Copyright (c) 2013-2020 MWARE SOLUTIONS SRL
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation with the addition of the
 * following permission added to Section 15 as permitted in Section 7(a):
 * FOR ANY PART OF THE COVERED WORK IN WHICH THE COPYRIGHT IS OWNED BY
 * MWARE SOLUTIONS SRL, MWARE SOLUTIONS SRL DISCLAIMS THE WARRANTY OF
 * NON INFRINGEMENT OF THIRD PARTY RIGHTS
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 * You should have received a copy of the GNU Affero General Public License
 * along with this program; if not, see http://www.gnu.org/licenses or write to
 * the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
 * Boston, MA, 02110-1301 USA, or download the license from the following URL:
 * https://www.gnu.org/licenses/agpl-3.0.txt
 *
 * The interactive user interfaces in modified source and object code versions
 * of this program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU Affero General Public License.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the BigConnect software without
 * disclosing the source code of your own applications.
 *
 * These activities include: offering paid services to customers as an ASP,
 * embedding the product in a web application, shipping BigConnect with a
 * closed source product.
 */
define([
    'flight/lib/component',
    'util/formatters',
    './withPropertyField',
    './dateRelativeTpl.hbs'
], function(
    defineComponent,
    F,
    withPropertyField,
    template) {
    'use strict';

    // Mapping to java.util.Calendar constants
    var UNITS_TIME = {
          second: 13,
          minute: 12,
          hour: 10,
          day: 5,
          week: 3,
          month: 2,
          year: 1
        },
        UNITS = _.omit(UNITS_TIME, 'second', 'minute', 'hour');

    return defineComponent(DateRelative, withPropertyField);

    function makeNumber(v) {
        return parseInt(v, 10);
    }

    function DateRelative() {

        this.defaultAttrs({
            amountSelector: '.amount',
            unitSelector: '.unit',
            pastPresentSelector: '.past-or-present'
        });

        this.after('initialize', function() {
            var self = this;

            this.displayTime = this.attr.property.displayType !== 'dateOnly' && this.attr.property.dataType !== 'localDate';
            this.$node.html(template({
                units: this.getUnits()
            }));

            _.defer(function() {
                self.select('amountSelector').focus();
            })
        });

        this.calculateRelativeDate = function(value) {
            var now = new Date();

            switch (value.unit) {
                case UNITS.second:
                    now.setSeconds(now.getSeconds() + value.amount);
                    break;
                case UNITS.minute:
                    now.setMinutes(now.getMinutes() + value.amount);
                    break;
                case UNITS.hour:
                    now.setHours(now.getHours() + value.amount);
                    break;
                case UNITS.day:
                    now.setDate(now.getDate() + value.amount);
                    break;
                case UNITS.week:
                    now.setDate(now.getDate() + value.amount * 7);
                    break;
                case UNITS.month:
                    now.setMonth(now.getMonth() + value.amount);
                    break;
                case UNITS.year:
                    now.setFullYear(now.getFullYear() + value.amount);
                    break;
            }

            return now.getTime();
        };

        this.getValue = function() {
            var amount = makeNumber($.trim(this.select('amountSelector').val())),
                past = makeNumber($.trim(this.select('pastPresentSelector').val())),
                value = {
                    unit: makeNumber($.trim(this.select('unitSelector').val()))
                };

            if (!isNaN(amount) && !isNaN(past)) {
                value.amount = amount * past;

                var date = this.calculateRelativeDate(value);
                if (this.displayTime) {
                    value._date = F.date.dateStringServer(date) + ' ' + F.date.timeStringServer(date);
                } else {
                    value._date = F.date.dateStringServer(date);
                }
            }

            return value;
        };

        this.setValue = function(value) {
            var inFuture = value && !isNaN(value.amount) && value.amount >= 0,
                defaultUnit = this.displayTime ? UNITS_TIME.hour : UNITS.day;

            this.select('amountSelector')
                .val((!value || isNaN(value.amount)) ? '' : Math.abs(value.amount));
            this.select('unitSelector')
                .val((!value || isNaN(value.unit)) ? defaultUnit : value.unit);
            this.select('pastPresentSelector')
                .val(inFuture ? '1' : '-1');
        };

        this.isValid = function(value) {
            return value &&
                _.isNumber(value.unit) &&
                !isNaN(value.unit) &&
                _.isNumber(value.amount) &&
                !isNaN(value.amount);
        };

        this.getUnits = function() {
            return _.chain(this.displayTime ? UNITS_TIME : UNITS)
                .map(function(value, key) {
                    return {
                        display: i18n('field.date.relative.unit.' + key),
                        value: value,
                        selected: false
                    }
                })
                .sortBy('value')
                .value();
        };

    }
});
