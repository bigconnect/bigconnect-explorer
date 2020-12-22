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
    'colorjs',
    './withRenderer'
], function(
    defineComponent,
    F,
    colorjs,
    withRenderer) {
    'use strict';

    return defineComponent(TextOverview, withRenderer);

    function countFn(d) {
        if (d.orderedByMe && d.value && d.value.nestedResults) {
            var nestedValues = _.values(d.value.nestedResults);
            if (nestedValues.length > 0)
                return nestedValues[0].value;
            else
                return d.value.count;
        } else
            return d.value.count;
    }

    function nameFn(d) {
        return d.name;
    }

    function TextOverview() {

        this.processData = function(data) {
            var buckets = [],
                root = data.root[0];

            if (root.orderedByNestedAgg) {
                buckets = _.map(root.buckets, b => { return {orderedByMe: true, ...b}});
            } else {
                buckets = _.sortBy(root.buckets, countFn).reverse();
            }

            return root.orderedByNestedAgg ? buckets : buckets.reverse();
        };

        this.render = function renderTextOverview(d3, node, data, d3tip) {
            var self = this,
                area = node.offsetWidth * node.offsetHeight,
                config = this.attr.reportConfiguration || {},
                limit = config.limit,
                color = config.color;

            if (limit) {
                data = data.slice(0, parseInt(limit, 10));
            }

            d3.select(node)
                .selectAll('ul')
                .data([1])
                .call(function() {
                    this.enter().append('ul').attr('class', 'text-overview');
                    this.selectAll('li')
                        .data(data)
                        .call(function() {
                            this.enter().append('li').attr('class', 'clickable')
                                .call(function() {
                                    this.append('h1')
                                    this.append('h2')
                                })
                            this.exit().remove();

                            this.order()
                                .on('click', function(d) {
                                    self.handleClick({
                                        filters: [{
                                            propertyId: d.field,
                                            predicate: 'equal',
                                            values: [nameFn(d)]
                                        }]
                                    });
                                })
                                .classed('light', colorjs(color || 'white').getLuminance() > 0.5)
                                .style('background-color', color || 'white')
                            this.select('h1').text(function(d) {
                                return (d.format || d3.format(','))(countFn(d));
                            });
                            this.select('h2')
                                .text(self.displayName)
                                .attr('title', self.displayName)
                        });
                })
                .each(function() {
                    this.style.fontSize = '100%';
                    var areas = _.toArray(this.querySelectorAll('li')).map(function(li) {
                            var dim = li.getBoundingClientRect();
                            return (dim.width * 1.125) * (dim.height * 1.125);
                        }),
                        used = d3.sum(areas),
                        percent = Math.floor(Math.sqrt(area / used) * 100);

                    self.tryPercent(node, this, percent);
                })
        };

        this.tryPercent = function(node, container, percent) {
            container.style.fontSize = percent + '%';

            if (container.scrollHeight > node.offsetHeight) {
                _.defer(this.tryPercent.bind(this, node, container, percent * 0.95));
            }
        };
    }
});
