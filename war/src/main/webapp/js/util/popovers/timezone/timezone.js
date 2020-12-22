
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
    '../withPopover',
    'util/formatters',
    'jstz'
], function(
    defineComponent,
    withPopover,
    F,
    jstz) {
    'use strict';

    return defineComponent(Timezone, withPopover);

    function Timezone() {

        this.defaultAttrs({
            toggleSelector: '.toggle'
        });

        this.before('initialize', function(node, config) {
            var localTimezone = jstz.determine().name(),
                timezone = config.timezone || (config.timezone = localTimezone);

            config.template = 'timezone/template';
            config.localTimezone = localTimezone;

            this.after('setupWithTemplate', function() {
                var self = this;

                this.on(this.popover, 'click', {
                    toggleSelector: this.onToggle
                });

                var timezoneToInfo = {};
                this.popover.find('input').val(timezone).typeahead({
                    items: 10000,
                    source: _.chain(jstz.olson.timezones)
                            .keys()
                            .map(function(p) {
                                var components = p.split(','),
                                    offsetMinutes = parseInt(components[0], 10),
                                    name = jstz.olson.timezones[p];

                                timezoneToInfo[name] = {
                                    selected: timezone === name,
                                    name: name,
                                    offset: F.timezone.offsetDisplay(offsetMinutes),
                                    dst: components.length >= 2 && components[1] === '1'
                                };
                                return name;
                            })
                            .value(),
                    matcher: function(name) {
                        if (!this.query) {
                            return true;
                        }
                        if (this.query === timezone) {
                            return true;
                        }

                        return Object.getPrototypeOf(this).matcher.apply(this, arguments);
                    },
                    highlighter: function(name) {
                        var info = timezoneToInfo[name];
                        return '<span class="offset">' + info.offset + '</span>' +
                            '<header title="' + info.name + '">' +
                                name + (info.dst ? ' *' : '') +
                            '</header>';
                    },
                    updater: function(name) {
                        self.trigger('selectTimezone', {
                            name: name
                        });
                        self.teardown();
                    }
                });
                var input = this.popover.find('input'),
                    typeahead = input.data('typeahead');

                typeahead.lookup = function(event) {
                        var items;

                        this.query = this.$element.val();

                        items = $.isFunction(this.source) ?
                            this.source(this.query, $.proxy(this.process, this)) :
                            this.source;

                        return items ? this.process(items) : this
                    };
                typeahead.process = function(items) {
                        var self = this;

                        items = $.grep(items, function(item) {
                            return self.matcher(item)
                        });

                        this.render(items.slice(0)).show();

                        var selected = _.find(this.$menu.find('li').toArray(), function(i) {
                            return $(i).data('value') === timezone;
                        });
                        if (selected) {
                            _.defer(function() {
                                $(selected).addClass('active').get(0).scrollIntoView();
                            });
                        }

                        return this;
                    };

                typeahead.lookup().show();
                typeahead.$element[0].select();
                this.typeahead = typeahead;
                this.positionDialog();
            });
        });

        this.onToggle = function(e) {
            e.stopPropagation();

            var button = $(e.target),
                content = button.closest('.popover-content').toggleClass('show-source'),
                tz = this.attr.sourceTimezone;

            this.trigger('selectTimezone', {
                name: tz,
                shiftTime: true
            });
            this.teardown();
        };
    }
});
