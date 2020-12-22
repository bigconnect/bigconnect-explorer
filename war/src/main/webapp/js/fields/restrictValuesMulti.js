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
    './restrictValues',
    'util/vertex/formatters',
    './withPropertyField',
    './restrictValuesMultiTpl.hbs'
], function(defineComponent, RestrictValues, F, withPropertyField, template) {
    'use strict';

    return defineComponent(RestrictValuesMultiField, withPropertyField);

    function RestrictValuesMultiField() {

        function compare(v1, v2) {
            return v1.toLowerCase().localeCompare(v2.toLowerCase());
        }

        this.defaultAttrs({
            removeSelector: 'ul.values li .remove-value'
        });

        this.after('initialize', function() {
            var self = this;

            this.on('click', {
                removeSelector: onRemoveItemClick
            });

            this.$node.html(template({}));

            var $restrictValues = this.$node.find('.restrict-values');
            RestrictValues.attachTo($restrictValues, {
                property: this.attr.property,
                value: '',
                preventChangeHandler: true,
                placeholderKey: 'field.restrict_values_multi.form.placeholder'
            });
            $restrictValues.on('change', onRestrictValueChange);

            this.setValue(this.attr.value);

            function onRestrictValueChange(event) {
                var value = $(event.target).val();
                if (self.addValue(value)) {
                    $restrictValues.trigger('setValue', null);
                    self.trigger('propertychange', {
                        propertyId: self.attr.property.title,
                        value: self.getValue(),
                        metadata: _.isFunction(self.getMetadata) && self.getMetadata() || {},
                        options: {}
                    });
                }
            }

            function onRemoveItemClick(event) {
                var $item = $(event.target).parent();
                var value = $item.data('value');
                $item.remove();
                self.removeValue(value);
            }
        });

        this.addValue = function(value) {
            if (this.values.indexOf(value) === -1) {
                this.values.push(value);
                return true;
            } else {
                return false;
            }
        };

        this.removeValue = function(value) {
            this.values.splice(this.values.indexOf(value), 1);
            this.trigger('propertychange', {
                propertyId: this.attr.property.title,
                value: this.getValue(),
                metadata: _.isFunction(this.getMetadata) && this.getMetadata() || {},
                options: {}
            });
        };

        this.setValue = function(values) {
            var self = this;
            this.values = [];
            this.$node.find('ul.values').empty();
            values = _.isArray(values) ? values : [values];

            values.sort(compare).forEach(function(value) {
                if (self.addValue(value)) {
                    self.$node.find('ul.values')
                        .append(
                            '<li><div>' + F.vertex.propDisplay(self.attr.property.title, value) +
                            '</div><button class="remove-value remove-icon">x</button></li>');
                    self.$node.find('ul.values li').last().data('value', value);
                }
            });
        };

        this.getValue = function() {
            return this.values.slice(0);
        };

        this.isValid = function(values) {
            return values.length;
        };
    }
});
