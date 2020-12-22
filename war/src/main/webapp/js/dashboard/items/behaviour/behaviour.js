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
    'util/withDataRequest'
], function(defineComponent, withDataRequest) {
    'use strict';

    return defineComponent(Behaviour, withDataRequest);

    function Behaviour() {

        this.attributes({
            resultsContainerSelector: '.element-list',
            item: null
        });

        this.after('initialize', function() {
            this.on('infiniteScrollRequest', this.onInfiniteScrollRequest);

            this.loadSearch();
        });

        this.loadSearch = function() {
            const item = this.attr.item;
            if (item.configuration.behaviourId) {
                this.dataRequest('behaviour', 'getById', this.attr.item.configuration.behaviourId)
                    .then((search) => {
                        this.off('refreshData', this.loadSearch);
                        this.on('refreshData', this.loadSearch);
                        this.loadItems();
                    })
                    .catch((e) => {
                        item.configuration.behaviourId = '';
                        this.trigger('configurationChanged', {
                            item: item,
                            extension: this.attr.extension
                        });
                    });
            } else {
                this.setConfiguring();
            }
        };

        this.loadItems = function() {
            var self = this,
                config = this.attr.item.configuration,
                limitResults = config.behaviourParameters && _.isNumber(config.behaviourParameters.size);

            this.$node.text('Loading...');
            this.dataRequest('behaviour', 'run', config.behaviourId, config.behaviourParameters)
                .then(function(results) {
                    if (results.elements.length) {
                        require(['util/element/list'], function(List) {
                            List.attachTo($('<div>').appendTo(self.$node.empty().css('overflow', 'auto')), {
                                edges: results.elements,
                                vertices: results.elements,
                                infiniteScrolling: !limitResults && (results.elements.length < results.totalHits),
                                nextOffset: results.nextOffset
                            })
                        })
                    } else {
                        self.$node.html('<i>No results</i>');
                    }
                })
                .catch(function(error) {
                    console.error(error);
                    self.trigger('showError');
                })
        }

        this.setConfiguring = function() {
            const self = this;

            this.select('resultsContainerSelector').teardownAllComponents();
            this.$node
                .css('overflow', 'inherit')
                .html(
                    $('<a>')
                        .text('Configure behaviour...')
                        .on('click', function() {
                            self.trigger('configureItem');
                        })
                );
        }

        this.onInfiniteScrollRequest = function(event, data) {
            var trigger = this.trigger.bind(this,
                this.select('resultsContainerSelector'),
                'addInfiniteItems'
            );
            var options = _.extend({}, this.attr.item.configuration.behaviourParameters, data.paging)

            this.dataRequest('behaviour', 'run',
                this.attr.item.configuration.behaviourId,
                options
            )
                .then(function(results) {
                    if (results) {
                        trigger({
                            success: true,
                            items: results.elements,
                            total: results.totalHits,
                            nextOffset: results.nextOffset
                        })
                    }
                })
                .catch(function() {
                    trigger({success: false});
                })
        };
    }
});
