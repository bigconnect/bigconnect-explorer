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
    './configureTpl.hbs',
    'require'
], function(
    defineComponent,
    withDataRequest,
    template,
    require) {
    'use strict';

    var LIMITS = [
        { value: '', name: 'Default' },
        { value: '1', name: '1' },
        { value: '5', name: '5' },
        { value: '10', name: '10' },
        { value: '25', name: '25' }
    ];

    return defineComponent(BehaviourConfig, withDataRequest);

    function serializeSortField(sortField) {
        if (sortField) {
            return sortField.field + ':' + sortField.direction;
        }
    }

    function BehaviourConfig() {

        this.defaultAttrs({
            searchSelector: 'select.search',
            limitSelector: '.limit select'
        });

        this.after('initialize', function() {
            var self = this;
            this.on('change', {
                searchSelector: this.onChangeSearch,
                limitSelector: this.onChangeLimit
            });
            this.on('sortFieldsUpdated', this.onSortFieldsUpdated);

            this.sortFields = this.getSortFields();
            this.limit = this.getLimit();

            this.render()
                .then(function() {
                    self.trigger('positionDialog');
                })
        });

        this.onSortFieldsUpdated = function(event, data) {
            this.sortFields = data.sortFields;
            this.checkToTrigger(true);
        };

        this.checkToTrigger = function(changed) {
            if (!this.sortFields && !changed) return;

            var item = this.attr.item;

            delete item.configuration.report;
            item.configuration.behaviourParameters = {
                sort: _.compact((this.sortFields || []).map(serializeSortField))
            }
            if (this.limit) {
                item.configuration.behaviourParameters.size = this.limit;
            }

            this.triggerChange();
        };

        this.render = function() {
            var self = this;
            this.$node.html(template({ loading: true }));

            return this.dataRequest('behaviour', 'all')
                .then(function(behaviours) {
                    self.behavioursById = _.indexBy(behaviours, 'id');

                    var config = self.attr.item.configuration;

                    self.$node.html(template({
                        searches: behaviours.map(function(behaviour) {
                            var selected = false;
                            if (behaviour.id === config.behaviourId) {
                                selected = true;
                            }
                            return _.extend({}, behaviour, {
                                selected: selected
                            })
                        }),
                        limits: LIMITS.map(function(l) {
                            return _.extend({}, l, {
                                selected: l.value === String(self.limit)
                            })
                        })
                    }));
                })
        };

        this.getLimit = function(event) {
            var behaviourParameters = this.attr.item.configuration.behaviourParameters;
            if (behaviourParameters && behaviourParameters.size) {
                return behaviourParameters.size;
            }
        };

        this.getSortFields = function() {
            var sortRegex = /^(.*):(ASCENDING|DESCENDING)$/,
                behaviourParameters = this.attr.item.configuration.behaviourParameters;
            if (behaviourParameters && _.isArray(behaviourParameters.sort)) {
                return _.chain(behaviourParameters.sort)
                    .map(function(sort) {
                        var match = sort.match(sortRegex);
                        if (match && match.length === 3) {
                            return {
                                field: match[1],
                                direction: match[2]
                            };
                        }
                    })
                    .compact()
                    .value();
            }
        };

        this.attachPropertySelection = function(node, options) {
            if (!options) {
                options = {};
            }
            return Promise.all([
                this.dataRequest('ontology', 'properties'),
                Promise.require('util/ontology/propertySelect')
            ]).done(function(results) {
                var properties = results.shift(),
                    FieldSelection = results.shift();

                node.teardownComponent(FieldSelection);
                FieldSelection.attachTo(node, {
                    selectedProperty: options.selected && properties.byTitle[options.selected] || null,
                    properties: properties.list,
                    showAdminProperties: true,
                    placeholder: options.placeholder || ''
                });
            });
        };

        this.setTitle = function(search) {
            var title = this.attr.extension.title;
            if (search) {
                title += ': ' + search.name;
            }

            if (this.attr.item.title === this.attr.item.configuration.initialTitle) {
                this.attr.item.title = title;
                this.trigger('cardTitleChanged', { title: title });
            }

            this.attr.item.configuration.initialTitle = title;
        };

        this.onChangeLimit = function(event) {
            var val = $(event.target).val();
            if (!this.attr.item.configuration.behaviourParameters) {
                this.attr.item.configuration.behaviourParameters = {};
            }

            if (val) {
                this.limit = parseInt(val, 10);
                this.attr.item.configuration.behaviourParameters.size = this.limit;
            } else {
                this.limit = null;
                delete this.attr.item.configuration.behaviourParameters.size;
            }
            this.checkToTrigger(true);
        };

        this.onChangeSearch = function(event) {
            var behaviourId = $(event.target).val(),
                item = this.attr.item;

            item.configuration.behaviourId = behaviourId;
            this.setTitle(this.behavioursById[behaviourId]);

            this.checkToTrigger(true);
        };

        this.triggerChange = function() {
            this.trigger('configurationChanged', {
                extension: this.attr.extension,
                item: this.attr.item
            });
        };

    }
});
