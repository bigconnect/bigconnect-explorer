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
    './withSearch',
    'util/formatters'
], function(
    defineComponent,
    withSearch,
    F) {
    'use strict';

    var SEARCH_RESULTS_PER_PAGE = 10,
        SearchComponent = defineComponent(SearchTypeDefault, withSearch);

    SearchComponent.savedSearchUrl = '/vertex/search';

    return SearchComponent;

    function SearchTypeDefault() {

        this.attributes({
            infiniteScrolling: false,
            searchType: 'Default',
            supportsSorting: true
        });

        this.after('initialize', function() {
            this.currentFilters = {};

            this.on('filterschange', function(event, data) {
                data.setAsteriskSearchOnEmpty = true;
            })
            this.on('querysubmit', this.onQuerySubmit);
            this.on('queryupdated', this.onQueryUpdated);
            this.on('clearSearch', this.onClearSearch);
            this.on('infiniteScrollRequest', this.onInfiniteScrollRequest);
        });

        this.onClearSearch = function() {
            if (this.currentRequest && this.currentRequest.cancel) {
                this.currentRequest.cancel();
                this.currentRequest = null;
            }
            this.trigger('setCurrentSearchForSaving');
        };

        this.processPropertyFilters = function() {
            var propertyFilters = this.currentFilters.propertyFilters,
                promise = propertyFilters && propertyFilters.length ?
                    this.dataRequest('ontology', 'properties') :
                    Promise.resolve();

            return promise.then(function(ontologyProperties) {
                if (ontologyProperties) {
                    // Coerce currency properties to strings
                    propertyFilters.forEach(function(f) {
                        var ontologyProperty = ontologyProperties.byTitle[f.propertyId];
                        if (ontologyProperty && ontologyProperty.dataType === 'currency') {
                            if (_.isArray(f.values)) {
                                f.values = f.values.map(function(v) {
                                    return String(v);
                                });
                            }
                        }
                    })
                }
            });
        };

        this.onQueryUpdated = function(event, data) {
            var self = this;
            this.currentQuery = data.value;
            this.currentFilters = data.filters;
            this.currentRefinements = data.refinements;
			this.logicalSourceString = data.logicalSourceString;

            this.processPropertyFilters().done(function() {
                var options = {
                    query: data.value,
                    conceptFilter: data.filters.conceptFilter,
                    propertyFilters: data.filters.propertyFilters,
                    otherFilters: data.filters.otherFilters,
                    edgeLabelFilter: data.filters.edgeLabelFilter,
                    sort: data.filters.sortFields,
                    matchType: data.filters.matchType,
                    logicalSourceString: data.logicalSourceString,
                    refinements: data.refinements,
                };
                self.triggerUpdatedSavedSearchQuery(options);
            })
        };

        this.triggerUpdatedSavedSearchQuery = function(options) {
            var self = this;

            return this.dataRequest('vertex', 'queryForOptions', options)
                .then(function(query) {
                    var parameters = _.omit(query.parameters, 'size', 'offset');
                    if (parameters.q && parameters.filter) {
                        self.trigger('setCurrentSearchForSaving', {
                            url: query.originalUrl,
                            parameters: parameters
                        });
                    } else {
                        self.trigger('setCurrentSearchForSaving');
                    }
                });
        }

        this.onQuerySubmit = function(event, data) {
            var self = this,
                query = data.value;

            this.currentQuery = data.value;
            this.currentFilters = data.filters;
            this.currentRefinements = data.refinements;
			this.logicalSourceString = data.logicalSourceString;
            this.forExport = data.forExport;
            this.processPropertyFilters().then(function() {
                self.trigger('searchRequestBegan');
                var pageSize = $('#res-per-page').val();
                $('ul.pagination').empty();

                let reqPromise = self.triggerRequest(
                    query,
                    self.currentFilters.propertyFilters,
                    self.currentRefinements,
                    self.currentFilters.matchType,
                    self.currentFilters.conceptFilter,
                    self.currentFilters.edgeLabelFilter,
                    self.currentFilters.otherFilters,
                    self.currentFilters.sortFields,
                    {
                        offset: 0,
                        size: pageSize
                    },
					self.logicalSourceString,
                    self.forExport
                );
                if (!reqPromise) {
                    return;
                }
                reqPromise.then(function(result) {
                        var unknownTotal = false,
                            verticesLength = result.elements.length;

                        if (!('totalHits' in result)) {
                            unknownTotal = true;
                            result.totalHits = verticesLength;
                        } else if (result.totalHits > verticesLength && verticesLength === 0) {
                            // totalHits includes deleted items so show no results
                            // if no vertices returned and hits > 0
                            result.totalHits = 0;
                        }

                        switch (self.currentFilters.matchType) {
                            case 'vertex': result.vertices = result.elements; break;
                            case 'edge': result.edges = result.elements; break;
                        }

                        result.queryParams = {
                            query: query,
                            propertyFilters: self.currentFilters.propertyFilters,
                            refinements: self.currentRefinements,
                            conceptFilter: self.currentFilters.conceptFilter,
                            edgeLabelFilter: self.currentFilters.edgeLabelFilter,
                            otherFilters: self.currentFilters.otherFilters,
                            paging: {
                                offset: 0,
                                size: '50000' //Maximum size for ES
                            },
                            sort: self.currentFilters.sortFields,
                            matchType: self.currentFilters.matchType,
                            fetchReferencedElements: false,
                            includeFacets: false,
                            logicalSourceString: self.logicalSourceString
                        };

                        self.trigger('searchRequestCompleted', {
                            success: true,
                            result: result,
                            message: i18n('search.types.default.hits.' +
                                (
                                    unknownTotal && result.totalHits >= (result.nextOffset - 1) ? 'unknown' :
                                    result.totalHits === 0 ? 'none' :
                                    result.totalHits === 1 ? 'one' :
                                    'many'
                                ),
                                F.number.prettyApproximate(result.totalHits))
                        });
                    }, function() {
                        self.trigger('searchRequestCompleted', { success: false, error: i18n('search.query.invalid') });
                    })
                    .done()
            });
        };

        this.triggerRequest = function(
            query,
            propertyFilters,
            refinements,
            matchType,
            conceptFilter,
            edgeLabelFilter,
            otherFilters,
            sortFields,
            paging,
			logicalSourceString,
            forExport
        ) {
            if (this.currentRequest && this.currentRequest.cancel) {
                this.currentRequest.cancel();
                this.currentRequest = null;
            }

            if (paging && !paging.size) {
                paging.size = SEARCH_RESULTS_PER_PAGE;
            }

            var options = {
                    query: query,
                    propertyFilters: propertyFilters,
                    refinements: refinements,
                    conceptFilter: conceptFilter,
                    edgeLabelFilter: edgeLabelFilter,
                    otherFilters: otherFilters,
                    paging: paging,
                    sort: sortFields,
                    matchType: matchType,
                    fetchReferencedElements: true,
                    includeFacets: true,
					logicalSourceString: logicalSourceString,
                    forExport: forExport
                };
            if (forExport) {
                this.currentRequest = this.dataRequest.apply(
                    this, ['vertex', 'exportRawSearch'].concat([options])
                )

                return null;
            } else {
                this.triggerUpdatedSavedSearchQuery(options);

                this.currentRequest = this.dataRequest.apply(
                    this, ['vertex', 'search'].concat([options])
                )

                return this.currentRequest;
            }
        };

        this.onInfiniteScrollRequest = function(event, data) {
            var query = this.currentQuery,
                self = this;

            this.triggerRequest(
                query,
                this.currentFilters.propertyFilters,
                this.currentRefinements,
                this.currentFilters.matchType,
                this.currentFilters.conceptFilter,
                this.currentFilters.edgeLabelFilter,
                this.currentFilters.otherFilters,
                this.currentFilters.sortFields,
                data.paging,
				self.logicalSourceString,
                false
            ).then(function(results) {
                var unknownTotal = false,
                    verticesLength = results.elements.length;

                if (!('totalHits' in results)) {
                    unknownTotal = true;
                    results.totalHits = verticesLength;
                } else if (results.totalHits > verticesLength && verticesLength === 0) {
                    // totalHits includes deleted items so show no results
                    // if no vertices returned and hits > 0
                    results.totalHits = 0;
                }

                self.trigger('searchRequestCompleted', {
                    success: true,
                    result: results,
                    message: i18n('search.types.default.hits.' +
                        (
                            unknownTotal && result.totalHits >= (results.nextOffset - 1) ? 'unknown' :
                                results.totalHits === 0 ? 'none' :
                                    results.totalHits === 1 ? 'one' :
                                        'many'
                        ),
                        F.number.prettyApproximate(results.totalHits))
                });
                })
                .catch(function() {
                    trigger({ success: false });
                })
        };

    }
});
