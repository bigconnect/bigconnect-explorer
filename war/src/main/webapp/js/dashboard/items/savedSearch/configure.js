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
            { value: '', name: i18n('dashboard.savedsearches.limit.none')},
            { value: '1', name: i18n('dashboard.savedsearches.limit.1')},
            { value: '5', name: i18n('dashboard.savedsearches.limit.5')},
            { value: '10', name: i18n('dashboard.savedsearches.limit.10')},
            { value: '25', name: i18n('dashboard.savedsearches.limit.25')}
        ];

    return defineComponent(SavedSearchConfig, withDataRequest);

    function serializeSortField(sortField) {
        if (sortField) {
            return sortField.field + ':' + sortField.direction;
        }
    }

    function SavedSearchConfig() {

        this.defaultAttrs({
            searchSelector: 'select.search',
            aggregationSectionSelector: 'section.aggregation',
            limitSelector: '.limit select'
        });

        this.after('initialize', function() {
            var self = this;

            this.on('change', {
                searchSelector: this.onChangeSearch,
                limitSelector: this.onChangeLimit
            });
            this.on('sortFieldsUpdated', this.onSortFieldsUpdated);
            this.on('aggregationsUpdated', this.onAggregationsUpdated);
            this.on('statisticsForAggregation', this.onStatisticsForAggregation);

            this.aggregations = this.getAggregations();
            this.sortFields = this.getSortFields();
            this.limit = this.getLimit();

            this.render()
                .then(this.updateAggregationVisibility.bind(this, true))
                .then(function() {
                    self.trigger('positionDialog');
                })
        });

        this.onStatisticsForAggregation = function(event, data) {
            var configuration = this.attr.item.configuration,
                searchId = configuration.searchId,
                params = _.omit(configuration.searchParameters, 'aggregations'),
                paramsWithStats = _.extend(params, {
                    size: 0,
                    aggregations: [{
                        type: 'statistics',
                        field: data.aggregation.field,
                        name: 'field'
                    }].map(JSON.stringify)
                })

            return this.dataRequest('search', 'run', searchId, paramsWithStats)
                .then(function(r) {
                    if (r && r.aggregates) {
                        $(event.target).trigger('aggregationStatistics', {
                            success: true,
                            statistics: _.extend({
                                field: data.aggregation.field
                            }, r.aggregates.field)
                        })
                    } else throw new Error('No aggregates');
                })
                .catch(function() {
                    $(event.target).trigger('aggregationStatistics', {
                        success: false
                    });
                })
        };

        this.onAggregationsUpdated = function(event, data) {
            let previousAggregations = this.aggregations;
            if (_.isEqual(previousAggregations, data.aggregations)) return;

            this.aggregations = data.aggregations;
            this.$node.find('.sort,.limit').toggle(this.aggregations.length === 0);

            if (this.aggregations.length) {
                this.attr.item.configuration.report = {
                    endpoint: '/search/run',
                    endpointParameters: {
                        id: this.attr.item.configuration.searchId,
                        size: 0,
                        aggregations: this.aggregations
                            .map(function(aggregation) {
                                if (aggregation.isDate) {
                                    aggregation.interval = aggregation.interval + 'M';
                                    delete aggregation.isDate;
                                }
                                return aggregation;
                            })
                            .map(JSON.stringify)
                    }
                }
            } else if (!previousAggregations) return;

            this.checkToTrigger(true);
        };

        this.onSortFieldsUpdated = function(event, data) {
            this.sortFields = data.sortFields;
            this.checkToTrigger(true);
        };

        this.checkToTrigger = function(changed) {
            if (_.isEmpty(this.aggregations) && !this.sortFields && !changed) return;

            var item = this.attr.item,
                aggregations = this.aggregations;

            if (!_.isEmpty(aggregations)) {
                item.configuration.searchParameters = {
                    aggregations: aggregations.map(JSON.stringify)
                }
            } else {
                delete item.configuration.report;
                item.configuration.searchParameters = {
                    sort: _.compact((this.sortFields || []).map(serializeSortField))
                }
                if (this.limit) {
                    item.configuration.searchParameters.size = this.limit;
                }
            }
            this.triggerChange();
        };

        this.updateAggregationVisibility = function(preventTrigger) {
            var self = this,
                searchId = this.attr.item.configuration.searchId,
                searchUrl = searchId ? this.searchesById[searchId].url : null,
                conceptId = searchId ? this.searchesById[searchId].parameters.conceptType : null;

            // aggregations not supported for cypher queries
            if(searchUrl && searchUrl.indexOf('cypher') == -1) {
                return Promise.require('dashboard/items/savedSearch/aggregation').then(function (Aggregation) {
                    const node = self.select('aggregationSectionSelector');

                    let aggregations;
                    if (self.aggregations) {
                        aggregations = self.aggregations.map(a => ({...a}));
                    }

                    node.toggle(!!self.attr.item.configuration.searchId);
                    Aggregation.attachTo(node.teardownComponent(Aggregation), {
                        aggregations
                    });

                    if (conceptId) {
                        node.trigger('filterProperties', {conceptId});
                    }
                    var aggregation = _.first(self.aggregations);
                    return self.updateAggregationDependents(aggregation && aggregation.type, preventTrigger);

                });
            }
        };

        this.render = function() {
            var self = this;
            this.$node.html(template({ loading: true }));

            return this.dataRequest('search', 'all')
                .then(function(searches) {
                    self.searchesById = _.indexBy(searches, 'id');

                    var config = self.attr.item.configuration;

                    self.$node.html(template({
                        searches: searches.map(function(search) {
                            var selected = false;
                            if (search.id === config.searchId) {
                                selected = true;
                            }
                            return _.extend({}, search, {
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
            var searchParameters = this.attr.item.configuration.searchParameters;
            if (searchParameters && searchParameters.size) {
                return searchParameters.size;
            }
        };

        this.getSortFields = function() {
            var sortRegex = /^(.*):(ASCENDING|DESCENDING)$/,
                searchParameters = this.attr.item.configuration.searchParameters;
            if (searchParameters && _.isArray(searchParameters.sort)) {
                return _.chain(searchParameters.sort)
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

        this.getAggregations = function() {
            var searchParameters = this.attr.item.configuration.searchParameters;
            if (searchParameters && searchParameters.aggregations && searchParameters.aggregations.length) {
                return searchParameters.aggregations.map(JSON.parse)
            }
        }

        this.updateAggregationDependents = function(type, preventTrigger) {
            var self = this,
                item = this.attr.item,
                searchId = this.attr.item.configuration.searchId,
                conceptId = searchId ? this.searchesById[searchId].parameters.conceptType : null;

            if (type) {
                if (item.configuration.searchParameters) {
                    delete item.configuration.searchParameters.sort;
                    delete item.configuration.searchParameters.size;
                }
                this.sortFields = null;
                this.limit = null;
                this.$node.find('.sort, .limit').hide();
            } else {
                this.$node.find('.agg').hide();
                this.$node.find('.limit select').val(this.limit && this.limit || '')
                    .closest('.limit').show();

                Promise.all([
                    this.dataRequest('ontology', 'properties'),
                    Promise.require('search/sort')
                ]).spread(function(properties, Sort) {
                    var node = self.$node.find('.sort').show(),
                        sortFieldsNode = node.find('.sort-fields');

                    Sort.attachTo(sortFieldsNode.teardownComponent(Sort), {
                        sorts: self.sortFields
                    });

                    if (conceptId) {
                        sortFieldsNode.trigger('filterProperties', { conceptId });
                    }
                });
                this.aggregationField = null;
                if (item.configuration.searchParameters) {
                    delete item.configuration.searchParameters.aggregations;
                }
                delete this.attr.item.configuration.report;
                if (preventTrigger !== true) {
                    this.triggerChange();
                }

                return Promise.all([
                    this.dataRequest('ontology', 'properties'),
                    Promise.require('search/sort')
                ]).spread(function(properties, Sort) {
                    var node = self.$node.find('.sort').show();

                    Sort.attachTo(node.find('.sort-fields').teardownComponent(Sort), {
                        sorts: self.sortFields
                    })
                });
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
            if (!this.attr.item.configuration.searchParameters) {
                this.attr.item.configuration.searchParameters = {};
            }

            if (val) {
                this.limit = parseInt(val, 10);
                this.attr.item.configuration.searchParameters.size = this.limit;
            } else {
                this.limit = null;
                delete this.attr.item.configuration.searchParameters.size;
            }
            this.checkToTrigger(true);
        };

        this.onChangeSearch = function(event) {
            var searchId = $(event.target).val(),
                item = this.attr.item;

            item.configuration.searchId = searchId;
            this.setTitle(this.searchesById[searchId]);
            this.updateAggregationVisibility(true);
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
