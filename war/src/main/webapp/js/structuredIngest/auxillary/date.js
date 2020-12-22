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
    'structuredIngest/templates/auxillary/date.hbs',
    'moment',
    'util/formatters'
], function(
    defineComponent,
    template,
    moment,
    F) {
    'use strict';

    return defineComponent(DateAuxillary);

    function formats(dateOnly, selected) {
        var now = moment(),
            dateTimes = [
                { js: 'YYYY-MM-DD HH:mm', java: 'yyyy-dd-MM HH:mm' },
                { js: 'YYYY-MM-DDTHH:mm', java: 'yyyy-dd-MM\'T\'HH:mm' },
                { js: 'M/D/YYYY h:mm a', java: 'M/d/yyyy h:mm a' }
            ],
            datesOnly = [
                { js: 'YYYY-MM-DD', java: 'yyyy-dd-MM' },
                { js: 'M/D/YYYY', java: 'M/d/yyyy' },
                { js: 'M-D-YYYY', java: 'M-d-yyyy' },
                { js: 'D-M-YYYY', java: 'D-M-yyyy' }
            ];

        return (dateOnly ? datesOnly : dateTimes).map(function(f, i) {
            return {
                format: f.java,
                example: now.format(f.js),
                selected: selected ? (f.java === selected) : i === 0
            }
        })
    }

    function DateAuxillary() {

        this.defaultAttrs({
            inputSelector: 'input',
            formatSelector: 'input.format',
            timezoneSelector: 'input.timezone',
            selectSelector: 'select'
        });

        this.after('initialize', function() {
            const f = formats(this.attr.property.displayType ? this.attr.property.displayType === 'dateOnly' : false, this.attr.mapping.hints.format);
            const timezones = _.mapObject(F.timezone.list(), ({ offsetDisplay, dst }, timezone) => (
                `${offsetDisplay} ${timezone}${dst ? '*' : ''}`
            ));

            this.$node.html(template({
                timezones,
                formats: f,
                format: this.attr.mapping.hints.format || f[0].format
            }));

            this.select('timezoneSelector').val(this.attr.mapping.hints.timezone || F.timezone.currentTimezone().name);

            this.on('change keyup paste', {
                inputSelector: this.onChange
            })
            this.on('change', {
                selectSelector: this.onSelectChange
            })
            this.$node.find('input').trigger('change');

        });

        this.onSelectChange = function() {
            this.select('formatSelector').val(
                this.select('selectSelector').val()
            );
            this.onChange();
        }

        this.onChange = function() {
            this.trigger('addAuxillaryData', {
                format: this.select('formatSelector').val(),
                timezone: this.select('timezoneSelector').val()
            });
        }

    }
});

