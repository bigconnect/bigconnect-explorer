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
    'configuration/admin/utils/withFormHelpers',
    'util/formatters',
    'util/withDataRequest',
    'util/withCollapsibleSections',
    'configuration/plugins/registry',
    'beautify',
    './template.hbs',
], function(
    defineComponent,
    withFormHelpers,
    F,
    withDataRequest,
    withCollapsibleSections,
    registry,
    beautify,
    template) {
    'use strict';

    return defineComponent(UIExtensionList, withDataRequest, withFormHelpers, withCollapsibleSections);

    function UIExtensionList() {

        this.after('initialize', function() {
            this.$node.html(template({}));
            this.renderPlugins();
        });

        this.renderPlugins = function() {
            var $node = this.$node.find('.admin-plugin-list'),
                $list = $node.empty().text('Se incarca...');

            Promise.all([
                Promise.require('d3'),
                this.dataRequest('extensionRegistry', 'get')
            ]).done(function(results) {
                var d3 = results.shift(),
                    webWorkerRegistry = _.mapObject(results.shift(), function(e) {
                        e.webWorker = true;
                        return e;
                    })

                d3.select($list.empty().get(0))
                    .selectAll('section.collapsible')
                    .data(
                        _.chain({})
                        .extend(registry.extensionPointDocumentation())
                        .extend(webWorkerRegistry)
                        .pairs()
                        .tap(function(list) {
                            if (list.length === 0) {
                                $node.text('No extensions found')
                            }
                        })
                        .sortBy(function(pair) {
                            return pair[0].toLowerCase();
                        })
                        .sortBy(function(pair) {
                            return pair[1].webWorker ? 1 : 0
                        })
                        .value()
                    )
                    .call(function() {
                        this.enter()
                            .append('section').attr('class', 'collapsible has-badge-number')
                            .call(function() {
                                this.append('h1').attr('class', 'collapsible-header')
                                    .call(function() {
                                        this.append('strong');
                                    })
                                this.append('div').attr('class', 'ui-extension-body')
                                    .call(function() {
                                        this.append('p')
                                        this.append('a')
                                            .attr('target', 'ext-docs')
                                            .attr('class', 'external-link')
                                            .text(function(d) { return 'External Documentation'; })

                                        this.append('div').attr('class', 'collapsible val')
                                            .call(function() {
                                                this.append('a')
                                                    .attr('class', 'collapsible-header validation-function')
                                                    .text(function(d) { return 'Validation Function'; })
                                                    .attr('title', 'Registered extensions must pass validation')
                                                this.append('div')
                                                    .append('pre').style('font-size', '75%').attr('class', 'validation-function-body')
                                            })
                                        this.append('div').attr('class', 'collapsible reg registered-extensions')
                                            .call(function() {
                                                this.append('a')
                                                    .attr('class', 'collapsible-header')
                                                this.append('div')
                                                    .append('ol').attr('class', 'inner-list ui-extension-list');
                                            })
                                    })
                            });

                        this.select('h1 strong').text(function(d) {
                            return d[0] + (d[1].webWorker ? ' (webworker)' : '') + ' (' +F.number.pretty(d[1].registered.length) + ')';
                        });
                        this.select('p').html(function(d) {
                            return d[1].description;
                        })
                        this.select('a.external-link')
                            .attr('title', function(d) {
                                return 'Open external documentation for ' + d[0];
                            })
                            .style('display', function(d) {
                                if (!d[1].externalDocumentationUrl) {
                                    return 'none'
                                }
                            })
                            .attr('href', function(d) {
                                return d[1].externalDocumentationUrl;
                            })
                        this.select('pre').text(function(d) {
                            return beautify.js_beautify(d[1].validator, {
                                /*eslint camelcase:0 */
                                indent_size: 2,
                                wrap_line_length: 80
                            })
                        })
                        this.select('.reg').style('display', function(d) {
                                if (d[1].registered.length === 0) return 'none';
                            })
                            .select('.collapsible-header')
                            .text(function(d) {
                                return F.string.plural(d[1].registered.length, 'Plugin') + ' Registered';
                            })
                        this.select('ol.inner-list')
                            .selectAll('li')
                            .data(function(d) {
                                return d[1].registered.map(replaceFunctions);
                                function replaceFunctions(object) {
                                    if (_.isString(object) && (/^FUNCTION/).test(object)) {
                                        return beautify.js_beautify(object.substring('FUNCTION'.length).toString(), { indent_size: 2});
                                    } else if (_.isArray(object)) {
                                        return _.map(object, replaceFunctions);
                                    } else if (_.isObject(object)) {
                                        return _.mapObject(object, replaceFunctions);
                                    }
                                    return object;
                                }
                            })
                            .call(function() {
                                this.enter()
                                    .append('li')
                                    .append('a').style('white-space', 'pre')

                                this.select('a')
                                    .text(function(d) {
                                        return JSON.stringify(d, null, 2).replace(/\\n/g, '\n');
                                    })
                            });

                    })
                    .exit().remove();
            });
        };

    }
});
