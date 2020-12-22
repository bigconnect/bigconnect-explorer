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
    'util/withDataRequest',
    'util/popovers/withPopover',
    'd3',
    'colorjs'
], function(
    defineComponent,
    withDataRequest,
    withPopover,
    d3,
    Color) {
    'use strict';

    return defineComponent(TimelineConfig, withPopover, withDataRequest);

    function TimelineConfig() {

        this.defaultAttrs({
            inputSelector: 'input'
        });

        this.before('initialize', function(node, config) {
            config.template = '/workspaces/timeline-config-tpl.hbs';
        });

        this.after('initialize', function() {
            var self = this;

            this.triggerUpdate = _.debounce(this.triggerUpdate.bind(this), 100);

            this.after('setupWithTemplate', function() {
                self.on('ontologyPropertiesChanged', function(e, data) {
                    self.attr.ontologyProperties = data.ontologyProperties;
                })
                self.on(self.popover, 'change', {
                    inputSelector: this.onCheckboxChange
                })
                self.dataRequest('ontology', 'ontology')
                    .done(function(ontology) {
                        self.ontologyConcepts = ontology.concepts;
                        self.ontologyRelationships = ontology.relationships;
                        self.update();
                        self.positionDialog();
                    })
            });
        });

        this.triggerUpdate = function() {
            this.trigger('timelineConfigChanged', {
                config: {
                    properties: this.popover.find('.popover-content input:checked')
                        .toArray()
                        .map(function(input) {
                            return $(input).data('title')
                        })
                }
            });
        };

        this.onCheckboxChange = function(event) {
            var $target = $(event.target),
                checked = $target.is(':checked'),
                title = $target.data('title');

            if (title === 'ALL') {
                this.popover.find('input').not($target).each(function() {
                    this.checked = checked;
                })
            } else {
                if (checked) {
                    this.popover.find('.popover-title input')[0].checked = (
                        this.popover.find('.popover-content input').not(':checked').length === 0
                    );
                } else {
                    this.popover.find('.popover-title input')[0].checked = false;
                }
            }

            this.triggerUpdate();
        };

        this.update = function() {
            var self = this,
                prettyConcepts = function(d) {
                    return _.chain(d.concepts)
                        .map(function(c) {
                            var concept = self.ontologyConcepts.byId[c] || self.ontologyRelationships.byTitle[c];
                            return concept && concept.displayName;
                        })
                        .compact()
                        .sort()
                        .value()
                        .join(', ')
                };

            d3.select(this.popover.find('ul')[0])
                .selectAll('li')
                .data(_.sortBy(this.attr.ontologyProperties, function(p) {
                    return p.property.displayName;
                }))
                .call(function() {
                    this.enter()
                        .append('li')
                        .append('label')
                        .call(function() {
                            this.append('input').attr('type', 'checkbox')
                            this.append('div')
                                .call(function() {
                                    this.append('span').attr('class', 'name')
                                    this.append('span').attr('class', 'subtitle')
                                })
                            this.append('span').attr('class', 'colors')
                        })

                    this.order();

                    this.attr('title', prettyConcepts);
                    this.select('.name').text(function(d) {
                        return d.property.displayName;
                    });
                    this.select('.subtitle')
                        .text(prettyConcepts)
                    this.select('.colors')
                        .selectAll('.color')
                        .data(function(d) {
                            return d.concepts.map(function(c) {
                                var concept = self.ontologyConcepts.byId[c] || self.ontologyRelationships.byTitle[c];
                                return {
                                    color: concept && concept.color,
                                    width: (10 / d.concepts.length) + 'px'
                                };
                            })
                        })
                        .call(function() {
                            this.enter()
                                .append('span').attr('class', 'color')

                            this.exit().remove();
                            this.style('width', function(d) {
                                return d.width;
                            })
                            this.style('background-color', function(d) {
                                if (d.color) {
                                    var processedColor = new Color(d.color).setLightness(0.6).setSaturation(0.5);
                                    return processedColor.toString();
                                }
                                return '#c4c4c4';
                            });
                        })
                    this.select('input')
                        .each(function(d) {
                            if (self.attr.config) {
                                this.checked = _.contains(self.attr.config.properties || [], d.property.title);
                            } else {
                                this.checked = true;
                            }
                        })
                        .attr('data-title', function(d) {
                            return d.property.title;
                        })

                    this.exit().remove();

                    self.popover.find('.popover-title input')[0].checked =
                        self.popover.find('.popover-content input').not(':checked').length === 0;
                })


        }
    }
});
