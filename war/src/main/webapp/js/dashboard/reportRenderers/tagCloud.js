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
    'util/requirejs/promise!util/service/ontologyPromise',
    './withRenderer',
    'jqcloud2'
], function(
    defineComponent,
    F,
    ontology,
    withRenderer) {
    'use strict';

    return defineComponent(TagCloud, withRenderer);

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

    function TagCloud() {
        this.processData = function(data) {
            var self = this,
                root = data.root[0],
                buckets = _.map(root.buckets, b => { return {orderedByMe: root.orderedByNestedAgg, ...b}});

            return _.map(buckets, function(bucket) {
                return {
                    text: bucket.name,
                    weight: countFn(bucket),
                    html: {
                        'data-field': bucket.field,
                        'data-label': bucket.name
                    },
                    handlers: {
                        click: function(event) {
                            const $wordNode = $(event.target);
                            self.handleClick({
                                filters: [{
                                    propertyId: $wordNode.attr('data-field'),
                                    predicate: '~',
                                    values: [ $wordNode.attr('data-label') ]
                                }]
                            }, event.target);
                        }
                    }
                }
            })
        }

        this.render = function renderPieChart(d3, node, data, d3tip) {
            var self = this,
                area = node.offsetWidth * node.offsetHeight,
                config = this.attr.reportConfiguration || {},
                limit = config.limit,
                color = config.color;

            $(node).jQCloud('destroy');
            $(node).jQCloud(data, {
                autoResize: true,
                delay: 5,
                fontSize: {
                    from: 0.1,
                    to: 0.03
                }
            })
        }
    }
});
