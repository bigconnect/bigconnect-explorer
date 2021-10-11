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
    'flight/lib/registry',
    '../filters/filters',
    './type.hbs',
    'util/withDataRequest',
    'util/formatters',
    'search/results/resultList',
    './refinements/refinements'
], function(
    registry,
    Filters,
    template,
    withDataRequest,
    F,
    ElementList,
    Refinements
) {
    'use strict';

    var DEFAULT_SEARCH_TYPE = 'Default';

    return withSearch;

    function withSearch() {
        withDataRequest.call(this);

        this.attributes({
            resultsSelector: '.search-results',
            hintSelector: '.search-hint',
            resultsContainerSelector: '.search-results .content .result-list',
            refinementsSelector: '.search-refinements',
            panelRefinementsSelector: '.panel-refinements',
            filtersSelector: '.search-filters',
            resultsPerPageSelector: '#res-per-page'
        });

        this.after('initialize', function() {
            this.render();
            this.currentPage = 1;

            var mainSelf = this;
            this.on(this.select('resultsPerPageSelector'), 'change', function() {
                var resultsPerPage = $(event.target).val()
                mainSelf.trigger(this.select('resultsContainerSelector'), 'changeResultsPerPage', { resultsPerPage: resultsPerPage });
            });

            this.on('searchByParameters', this.onSearchByParameters);
            this.on('listRendered', this.onResultsRendered);
            this.on('searchRequestBegan', () => {
                this.currentPage = 1;
            });

            this.on('searchRequestCompleted', function(event, data) {
                if (data.success && data.result) {
                    var self = this,
                        result = data.result,
                        elements = result.elements,
                        $searchResults = this.select('resultsSelector'),
                        $searchHints = this.select('hintSelector'),
                        $resultsContainer = this.select('resultsContainerSelector')
                            .teardownAllComponents()
                            .empty(),
                        $refinementsContainer = this.select('refinementsSelector')
                            .teardownAllComponents()
                            .empty(),
                        $panelRefinements = this.select('panelRefinementsSelector');

                    $searchResults.find('.total-hits').text('0')
                        .end()
                        .toggle(
                            _.isUndefined(result.totalHits) ?
                                result.elements.length === 0 :
                                result.totalHits === 0
                        );

                    if (result.totalHits === 0) {
                        $searchHints.show();
                        $searchResults.hide();
                        $refinementsContainer.hide();
                        $panelRefinements.hide();
                    } else if (result.totalHits < 0) {
                        $searchHints.hide();
                        $searchResults.find('.total-hits').text("0");
                        $searchResults.show().children('.content').scrollTop(0);
                        $resultsContainer.text(i18n('dashboard.wildcard-disabled'));
                    } else {
                        $searchHints.hide();
                        $searchResults.find('.total-hits').text(result.totalHits);
                        $searchResults.show().children('.content').scrollTop(0);
                        $panelRefinements.show();

                        ElementList.attachTo($resultsContainer, {
                            items: result.elements,
                            usageContext: 'searchresults',
                            nextOffset: result.nextOffset,
                            infiniteScrolling: this.attr.infiniteScrolling,
                            total: result.totalHits,
                            queryParams: result.queryParams
                        });

                        Refinements.attachTo($refinementsContainer, {
                            aggregates: result.aggregates
                        });

                        mainSelf.totalPages = 1;
                        mainSelf.resultsPerPage = $('#res-per-page').val();
                        if(result.totalHits > 0)
                            mainSelf.totalPages = Math.floor((result.totalHits - 1) / mainSelf.resultsPerPage)+1;

                        this.makeResizable($searchResults);
                        $refinementsContainer.show();
                    }
                    this.trigger($searchResults, 'paneResized');
                }
                this.on(document, 'switchWorkspace', () => {
                    this.trigger('clearSearch', { clearMatch: false })
                });
            });
            this.on('clearSearch', function(event, data) {
                this.hideSearchResults();

                var filters = this.select('filtersSelector').find('.content')
                this.trigger(filters, 'clearfilters', data);
            });
            this.on('searchtypeloaded', function(event, data) {
                var filters = this.select('filtersSelector').find('.content')
                this.trigger(filters, 'enableMatchSelection', {
                    match: data.type === DEFAULT_SEARCH_TYPE
                })
            })
        });

        this.onResultsRendered = function(event, data) {
            // display pagination here to avoid screen flicker
            this.renderPages(this.totalPages);
        };

        this.renderPages = function(totalPages) {
            var self = this,
                pagesToDisplay = 10,
                leftRange = Math.floor(pagesToDisplay/2),
                elPrev = $('<li><a href="#">Prev</a></li>')

            if(this.currentPage === 1) {
                elPrev.addClass('disabled');
            }

            elPrev.click(function() {
                if(!elPrev.hasClass('disabled'))
                    self.previousPage();
            });

            var elNext = $('<li><a href="#">Next</a></li>');
            if(this.currentPage === totalPages) {
                elNext.addClass('disabled');
            }

            elNext.click(function() {
                if(!elNext.hasClass('disabled'))
                    self.nextPage();
            });

            var elpagination = $('.std.pagination');
            elpagination.append(elPrev);

            var startPage = this.currentPage - leftRange;
            if(startPage < 1){
                startPage = 1;
            }
            var endPage = startPage + pagesToDisplay;
            if(endPage > totalPages){
                endPage = totalPages;
            }

            for(var i = startPage; i <= endPage; i++) {
                var elPage = $(`<li page="${i}'"><a href="#">${i}</a></li>`);
                if(i === this.currentPage)
                    elPage.addClass('active');

                if(i !== this.currentPage) {
                    elPage.click(function () {
                        var selectedPage = $(this).attr('page');
                        self.changePage(parseInt(selectedPage));
                    });
                }

                elpagination.append(elPage);
            }

            elpagination.append(elNext);

        };

        this.previousPage = function() {
            this.changePage(this.currentPage-1);
        };

        this.nextPage = function() {
            this.changePage(this.currentPage+1);
        };

        this.changePage = function(page) {
            this.currentPage = page;
            this.trigger(this.select('resultsContainerSelector'), 'changePage', { page: this.currentPage });
        }

        this.onSearchByParameters = function(event, data) {
            var filtersNode = this.select('filtersSelector').find('.content')
            event.stopPropagation();
            if ($(event.target).is(filtersNode)) return;
            filtersNode.trigger(event.type, data);
        };

        this.render = function() {
            this.$node.html(template({}));

            this.hideSearchResults();

            this.on('filtersLoaded', function() {
                this.trigger('searchtypeloaded', { type: this.attr.searchType });
            });

            var filters = this.select('filtersSelector');
            Filters.attachTo(filters.find('.content'), {
                supportsHistogram: this.attr.supportsHistogram === true,
                supportsSorting: this.attr.supportsSorting !== false,
                searchType: this.attr.searchType,
                match: this.searchOptions && this.searchOptions.match || 'vertex'
            });

            $('[data-toggle="tooltip"]').tooltip();
        };

        this.hideSearchResults = function() {
            this.select('hintSelector')
                .show();
            this.select('resultsSelector')
                .hide();
            this.select('resultsContainerSelector')
                .teardownAllComponents()
                .empty();
            this.select('refinementsSelector')
                .teardownAllComponents()
                .empty()
                .hide();
            this.select('panelRefinementsSelector').hide();
            this.trigger(document, 'paneResized');
        };

        this.makeResizable = function(node) {
            var self = this;

            // Add splitbar to search results
            return node.resizable({
                handles: 'e',
                minWidth: 200,
                maxWidth: 350,
                resize: function() {
                    self.trigger(document, 'paneResized');
                }
            });
        };
    }
});
