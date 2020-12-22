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
    './timeline-tpl.hbs',
    'util/withDataRequest',
    'util/popovers/withElementScrollingPositionUpdates',
    'require'
], function(
    defineComponent,
    template,
    withDataRequest,
    withElementScrollingPositionUpdates,
    require) {
    'use strict';

    return defineComponent(Timeline, withDataRequest, withElementScrollingPositionUpdates);

    function Timeline() {

        this.defaultAttrs({
            timelineConfigSelector: '.timeline-config',
            timelineFitSelector: '.timeline-fit'
        });

        this.before('teardown', function() {
            if (this.Histogram) {
                this.$node.children('.timeline-svg-container').teardownComponent(this.Histogram);
            }
        })

        this.after('initialize', function() {
            var self = this;

            this.on('updateHistogramExtent', this.onUpdateHistogramExtent);
            this.on('timelineConfigChanged', this.onTimelineConfigChanged);

            this.ontologyPropertiesPromise = new Promise(function(fulfill) {
                self.on('ontologyPropertiesRenderered', function(event, data) {
                    self.foundOntologyProperties = data.ontologyProperties;
                    self.select('timelineConfigSelector').trigger('ontologyPropertiesChanged', {
                        ontologyProperties: self.foundOntologyProperties
                    });
                    fulfill();
                });
            });

            this.on('click', {
                timelineConfigSelector: this.onTimelineConfigToggle,
                timelineFitSelector: this.onFitTimeline
            });

            this.$node.on(TRANSITION_END, _.once(this.render.bind(this)));
        });

        this.onFitTimeline = function() {
            this.$node.children('.timeline-svg-container').trigger('fitHistogram');
        };

        this.onTimelineConfigChanged = function(event, data) {
            this.config = data.config;
            this.$node.children('.timeline-svg-container').trigger('propertyConfigChanged', {
                properties: data.config.properties
            });
        };

        this.onTimelineConfigToggle = function(event) {
            var self = this,
                $target = $(event.target),
                shouldOpen = $target.lookupAllComponents().length === 0;

            require(['./timeline-config'], function(TimelineConfig) {

                self.ontologyPropertiesPromise.done(function() {
                    if (shouldOpen) {
                        TimelineConfig.teardownAll();
                        TimelineConfig.attachTo($target, {
                            config: self.config,
                            ontologyProperties: self.foundOntologyProperties
                        });
                    } else {
                        $target.teardownComponent(TimelineConfig);
                    }
                })
            });
        };

        this.onUpdateHistogramExtent = function(event, data) {
            this.trigger('selectObjects', {
                vertexIds: data.vertexIds,
                edgeIds: data.edgeIds,
                options: {
                    fromHistogram: true
                }
            })
        };

        this.render = function() {
            var self = this;

            this.$node.html(template({}));

            Promise.all([
                Promise.require('fields/histogram/histogram'),
                this.dataRequest('ontology', 'properties'),
            ]).spread(function(Histogram, ontologyProperties) {
                self.Histogram = Histogram;
                Histogram.attachTo(self.$node.children('.timeline-svg-container'), {
                    noDataMessageDetailsText: i18n('timeline.no_data_details'),
                    includeYAxis: true
                });
            })
        }

    }
});
