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
    'util/vertex/formatters',
    'util/withDataRequest',
    'configuration/plugins/registry'
], function(defineComponent, F, withDataRequest, registry) {
    'use strict';

    return defineComponent(DetailPane, withDataRequest);

    function DetailPane() {

        this.defaultAttrs({
            mapCoordinatesSelector: '.map-coordinates',
            detailTypeContentSelector: '.type-content'
        });

        this.after('initialize', function() {
            this.on('click', {
                mapCoordinatesSelector: this.onMapCoordinatesClicked
            });
            this.on('finishedLoadingTypeContent', this.onFinishedTypeContent);

            this.on(document, 'objectsSelected', this.onObjectsSelected);
            this.on(document, 'selectObjects', this.onSelectObjects);
            this.preventDropEventsFromPropagating();

            this.before('teardown', this.teardownComponents);

            this.$node.html('<div class="type-content"></div>');
        });

        this.onFinishedTypeContent = function() {
            this.$node.removeClass('loading');
        };

        // Ignore drop events so they don't propagate to the graph/map
        this.preventDropEventsFromPropagating = function() {
            this.$node.droppable({ tolerance: 'pointer', accept: '*' });
        };

        this.onMapCoordinatesClicked = function(evt, data) {
            evt.preventDefault();
            var $target = $(evt.target).closest('a');
            this.trigger('mapCenter', $target.data());
        };

        this.onSelectObjects = function(event, data) {
            this.collapsed = !this.$node.closest('.detail-pane').is('.visible');
        };

        this.onObjectsSelected = function(evt, data) {
            var self = this,
                { vertices, edges, options } = data,
                moduleName, moduleData, moduleName2,
                pane = this.$node.closest('.detail-pane');

            if (!vertices.length && !edges.length) {

                this.cancelTransitionTeardown = false;

                return pane.on(TRANSITION_END, function(e) {
                    if (/transform/.test(e.originalEvent && e.originalEvent.propertyName)) {
                        if (self.cancelTransitionTeardown !== true) {
                            self.teardownComponents();
                        }
                        pane.off(TRANSITION_END);
                    }
                });
            }

            this.cancelTransitionTeardown = true;
            this.teardownComponents();
            this.$node.addClass('loading');

            vertices = _.unique(vertices, 'id');
            edges = _.unique(edges, 'id');

            Promise.all([
                Promise.require('detail/item/item'),
                this.collapsed ?
                    new Promise(function(f) {
                        pane.on(TRANSITION_END, function(e) {
                            if (/transform/.test(e.originalEvent && e.originalEvent.propertyName)) {
                                pane.off(TRANSITION_END);
                                f();
                            }
                        });
                    }) :
                    Promise.resolve()
            ]).done(function(results) {
                var Module = results.shift();
                Module.attachTo(self.select('detailTypeContentSelector').teardownAllComponents(), {
                    model: vertices.concat(edges),
                    constraints: ['width'],
                    focus: options.focus
                });
            })
        };

        this.teardownComponents = function() {
            this.select('detailTypeContentSelector').find('*').teardownAllComponents();
            this.select('detailTypeContentSelector').teardownAllComponents().empty();
        }
    }
});
