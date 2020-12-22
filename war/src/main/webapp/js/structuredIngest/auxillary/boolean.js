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
    'structuredIngest/templates/auxillary/boolean.hbs'
], function(
    defineComponent,
    template) {
    'use strict';

    var BLANK_OPTIONS = [
            { value: '', display: 'Skip' },
            { value: 'true', display: 'True' },
            { value: 'false', display: 'False' }
        ],
        SPLIT_REGEX = /\s*,\s*/

    return defineComponent(BooleanAuxillary);

    function process(strlist) {
        var a = _.isArray(strlist) ? strlist : (strlist || '').split(SPLIT_REGEX);
        return a.join(', ');
    }

    function BooleanAuxillary() {

        this.defaultAttrs({
            inputSelector: 'input',
            selectSelector: 'select'
        });

        this.after('initialize', function() {
            var hints = this.attr.mapping.hints;
            this.$node.html(template({
                trueValues: process(hints.trueValues || 'yes, y, true, 1'),
                falseValues: process(hints.falseValues || 'no, n, false, 0'),
                blank: BLANK_OPTIONS.map(function(o) {
                    o.selected = false;
                    if ('defaultValue' in hints) {
                        o.selected = (o.value === 'true') === hints.defaultValue;
                    }
                    return o;
                })
            }));

            this.on('change', {
                selectSelector: this.triggerChange
            });

            this.on('change keyup paste', {
                inputSelector: this.triggerChange
            });

            this.triggerChange();
        });

        this.onChange = function() {
        };

        this.triggerChange = function() {
            var self = this;

            this.trigger('addAuxillaryData', _.tap({
                trueValues: this.$node.find('input.true').val().split(SPLIT_REGEX),
                falseValues: this.$node.find('input.false').val().split(SPLIT_REGEX)
            }, function(d) {
                var blank = self.$node.find('select.blank').val();
                if (blank) {
                    d.defaultValue = blank === 'true';
                }
            }));
        };

    }
});
