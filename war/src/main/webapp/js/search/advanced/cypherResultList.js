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
    './cypherResultList.hbs',
    'search/results/resultList'
], function(
    defineComponent,
    template,
    ElementList
) {
    'use strict';

    return defineComponent(cypherResults);

    function cypherResults() {
        this.defaultAttrs({
            resultsContainerSelector: '.search-results .result-list',
            refinementsSelector: '.search-refinements',
            totalHitsSelector: '.search-results .total-hits',
            queryTimeSelector: '.search-results .query-time',
            resultsPerPageSelector: '#cy-res-per-page'
        });

        this.after('initialize', function() {
            this.$node.html(template({}));

            var $resultsContainer = this.select('resultsContainerSelector'),
                $totalResultsContainer = this.select('totalHitsSelector'),
                $queryTimeContainer = this.select('queryTimeSelector'),
                from = parseInt((this.attr.currentPage-1) * this.attr.resultsPerPage),
                to = from + parseInt(this.attr.resultsPerPage);

            $totalResultsContainer.text(from+" to "+to);
            $queryTimeContainer.text(Math.round(this.attr.totalTime/1000)+"s");

            ElementList.attachTo($resultsContainer, {
                items: this.attr.items,
                usageContext: 'searchresults',
                nextOffset: 0,
                infiniteScrolling: false,
                total: this.attr.total
            });

            this.select('resultsPerPageSelector').val(this.attr.resultsPerPage);
            this.renderPages(this.attr.items.length);

            var self = this;
            this.select('resultsPerPageSelector').change(function() {
               const newValue = self.select('resultsPerPageSelector').val();
               self.attr.onChangeResultsPerPage(newValue);
            });
        });

        this.renderPages = function(totalItems) {
            var self = this,
                elPrev = $('<li><a href="#">Prev</a></li>')

            if(this.attr.currentPage == 1) {
                elPrev.addClass('disabled');
            }

            elPrev.click(function() {
                if(!elPrev.hasClass('disabled'))
                    self.previousPage();
            });

            var elNext = $('<li><a href="#">Next</a></li>');
            if(totalItems < this.attr.resultsPerPage) {
                elNext.addClass('disabled');
            }

            elNext.click(function() {
                if(!elNext.hasClass('disabled'))
                    self.nextPage();
            });

            var elpagination = $('.cy.pagination');
            elpagination.append(elPrev);
            elpagination.append(elNext);
        }

        this.previousPage = function() {
            this.changePage(this.attr.currentPage-1);
        };

        this.nextPage = function() {
            this.changePage(this.attr.currentPage+1);
        };

        this.changePage = function(page) {
            this.attr.onChangePage(page);
        }
    }
});
