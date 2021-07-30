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
    './doubleTpl.hbs',
    'duration-js',
    'util/parsers',
    'util/vertex/formatters',
    './withPropertyField',
    './withHistogram'
], function(defineComponent, template, Duration, P, F, withPropertyField, withHistogram) {
    'use strict';

    return defineComponent(DurationField, withPropertyField, withHistogram);

    function toSeconds(v) {
        try {
            var allValid = _.every(v.trim().split(/\s+/), function(n) {
                return P.number.isValidWithUnits(n);
            });

            if (allValid) {
                return Duration.parse(v).milliseconds() / 1000.0;
            } else {
                return NaN;
            }
        } catch(e) {
            return NaN;
        }
    }

    function DurationField() {

        this.after('initialize', function() {
            this.attr.placeholder = i18n('field.double.displaytype.duration.placeholder');

            this.$node
                .html(template(this.attr))
                .find('input').attr('pattern', '^([\\d.]+[wdhms]+[\\s,;:]*)+$');
        });

        this.setValue = function(value) {
            this.select('inputSelector').val(F.number.duration(value));
        };

        this.getValue = function() {
            return toSeconds(this.select('inputSelector').val().trim());
        };

        this.isValid = function(value) {
            var name = this.attr.property.title;
            return _.isNumber(value) && !isNaN(value) && F.vertex.singlePropValid(value, name);
        };

        this.getMetadata = function() {
            var currentVal = this.getValue();
            if (currentVal && !isNaN(currentVal)) {
                return { [ONTOLOGY_CONSTANTS.PROP_INPUT_PRECISION]: 0 };
            }
            return null;
        };
    }
});
