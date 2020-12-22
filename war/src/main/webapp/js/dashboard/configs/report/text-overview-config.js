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
    'd3',
    './text-overview-config-tpl.hbs'
], function(
    defineComponent,
    d3,
    template) {
    'use strict';

    var LIMITS = [
            { value: '', display: i18n('dashboard.text-overview.limits.none') },
            { value: '1', display: 1 },
            { value: '2', display: 2 },
            { value: '5', display: 5 },
            { value: '~', display: i18n('dashboard.text-overview.limits.other') }
        ],
        noColorDefault = 'white';

    return defineComponent(TextOverviewConfig);

    function TextOverviewConfig() {

        this.attributes({
            item: null,
            extension: null,
            limitSelector: 'select',
            limitOtherSelector: 'input',
            colorPickerSelector: '.color-picker li'
        })

        this.after('initialize', function() {
            var self = this,
                config = this.getConfiguration();

            this.on('change', {
                limitSelector: this.onChangeLimit,
                limitOtherSelector: this.onChangeOtherLimit
            });

            this.on('click', {
                colorPickerSelector: this.onPickColor
            });

            this.on('keyup', {
                limitOtherSelector: this.onChangeOtherLimit
            });

            if (!config.color) {
                config.color = noColorDefault;
            }
            this.$node.html(template({
                showOther: this.isOther(config.limit),
                currentLimit: config.limit,
                colors: _.chain(d3.scale.category10().range())
                    .map(function(c) {
                        return { color: c, noColor: false };
                    })
                    .tap(function(colors) {
                        colors.push({ color: noColorDefault, noColor: true })
                    })
                    .map(function(c) {
                        var match = config.color === c.color;
                        return _.extend({ selected: match }, c);
                    })
                    .value(),
                limits: LIMITS.map(function(l) {
                    return _.extend({
                        selected: (self.isOther(config.limit) && l.value === '~') ||
                            String(config.limit) === l.value
                    }, l);
                })
            }));
        });

        this.getConfiguration = function() {
            var config = this.attr.item.configuration,
                key = 'org-bigconnect-text-overview';

            if (!config[key]) {
                config[key] = {};
            }

            return config[key];
        };

        this.onPickColor = function(event) {
            var color = $(event.target).data('color');

            event.stopPropagation();

            this.getConfiguration().color = color;
            this.triggerChange();
        };

        this.isOther = function(limit) {
            return Boolean(limit && (
                limit === '~' ||
                _.every(LIMITS, function(l) {
                    return l.value !== String(limit);
                })
            ));
        };

        this.onChangeOtherLimit = function(event) {
            var other = parseInt($(event.target).val(), 10);

            if (!isNaN(other)) {
                this.getConfiguration().limit = other;
                if (event.type === 'change' || (event.type === 'keyup' && event.which === 13)) {
                    this.triggerChange();
                }
            }
        };

        this.onChangeLimit = function(event) {
            var newLimit = $(event.target).val(),
                showOther = this.isOther(newLimit),
                config = this.getConfiguration();

            this.select('limitOtherSelector')
                .val(config.limit)
                .toggle(showOther);
            if (showOther) {
                return;
            }

            if (newLimit) {
                config.limit = parseInt(newLimit, 10);
            } else {
                delete config.limit;
            }

            this.triggerChange();
        };

        this.triggerChange = function() {
            this.trigger('configurationChanged', {
                extension: this.attr.extension,
                item: this.attr.item
            });
        };

    }
});
