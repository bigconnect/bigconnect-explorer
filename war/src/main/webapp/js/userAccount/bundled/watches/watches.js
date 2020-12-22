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
    './watches.hbs',
    'configuration/admin/utils/withFormHelpers',
    'util/formatters',
    'd3',
    'util/withDataRequest'
], function(
    defineComponent,
    template,
    withFormHelpers,
    F,
    d3,
    withDataRequest) {
    'use strict';

    return defineComponent(Watches, withDataRequest, withFormHelpers);

    function Watches() {
        this.defaultAttrs({
            headerSelector: 'section.collapsible h1',
            deleteSelector: '.btn-danger'
        });


        this.after('initialize', function() {
            var self = this;

            this.on('click', {
                headerSelector: this.onToggleGroup,
                deleteSelector: this.onDelete
            });
            this.on(document, 'watchUpdated', this.onWatchUpdate);

            this.$node.html(template());

            this.loadEntries();
        });

        this.onToggleGroup = function(event) {
            var $section = $(event.target).closest('.collapsible');

            if ($section.hasClass('expanded')) {
                return $section.removeClass('expanded');
            } else {
                return $section.addClass('expanded');
            }
        }

        this.onWatchUpdate = function() {
            this.loadEntries();
        }

        this.loadEntries = function() {
            var self = this;

            this.dataRequest('watchlist', 'list')
                .then(this.renderEntries.bind(this))
                .catch(this.showError.bind(this, 'Error loading entries'))
                .finally(function() {
                    self.$node.find('.badge').remove();
                })
        }

        this.onDelete = function(event) {
            var button = $(event.target),
                rowKey = button.data('rowKey');

            button.closest('li').addClass('show-hover-items');

            this.handleSubmitButton(button,
                this.dataRequest('watchlist', 'delete', rowKey)
                    .then(this.loadEntries.bind(this))
                    .catch(this.showError.bind(this, 'Error deleting entry'))
            );
        };

        this.renderEntries = function(result) {
            var $list = this.$node.find('ul'),
                self = this;

            if (result.entries.length === 0) {
                return $list.empty().html('<li class="nav-header">No Entries</li>');
            }

            d3.select($list.empty().get(0))
                .selectAll('li.entry')
                .data(
                    _.chain(result.entries)
                        .groupBy('propertyName')
                        .pairs()
                        .sortBy(function(pair) {
                            return pair[0].toLowerCase();
                        })
                        .value()
                )
                .call(function() {
                    this.enter()
                        .append('section').attr('class', 'collapsible has-badge-number')
                        .call(function() {
                            this.append('h1')
                                .call(function() {
                                    this.append('span').attr('class', 'badge');
                                    this.append('strong');
                                })
                            this.append('div').append('ul').attr('class', 'nav nav-pills nav-stacked inner-list');
                        });

                    this.select('h1 strong').text(function(d) {
                        return 'Property: '+d[0];
                    });
                    this.select('.badge').text(function(d) {
                        return F.number.pretty(d[1].length);
                    });
                    this.select('div > ul.inner-list')
                        .selectAll('li.entry')
                        .data(function(d) {
                            return d[1];
                        })
                        .call(function() {
                            this.enter()
                                .append('li')
                                .attr('class', 'entry')
                                .call(function() {
                                    this.append('a')
                                        .text((d) => d.elementTitle)
                                        .attr('data-row-key', (d) => d.id)
                                        .on('click', (d) => {
                                            self.trigger('selectObjects', {
                                                vertexIds: [d.elementId],
                                                edgeIds: []
                                            });
                                        });

                                    this.append('button')
                                        .attr('class', 'btn btn-danger btn-xs btn-raised')
                                        .text('Delete')
                                        .attr('data-row-key', (d) => d.id);
                                });
                        })
                        .exit().remove();
                })
                .exit().remove();
        };
    }
});
