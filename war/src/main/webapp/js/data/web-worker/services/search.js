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

/**
 * Routes for running searches, and saved searches.
 *
 * @module services/search
 * @see module:dataRequest
 */
define(['../util/ajax'], function(ajax) {
    'use strict';

    /**
     * @alias module:services/search
     */
    var api = {

        /**
         * Get saved searches optionally filtered
         * by search url
         *
         * @param {string} urlFilter Limit searches to those of this URL
         */
        all: function(urlFilter) {
            var bcFilter = /^\/(?:vertex|element|edge)\/search$/;
            return ajax('GET', '/search/all')
                .then(function(result) {
                    return _.chain(result.searches)
                        .filter(function(search) {
                            if (urlFilter) {
                                if (bcFilter.test(urlFilter)) {
                                    return bcFilter.test(search.url);
                                }
                                return search.url === urlFilter;
                            }
                            return true;
                        })
                        .sortBy(function(search) {
                            return search.name.toLowerCase();
                        })
                        .value();
                })
        },

        /**
         * Save a search
         *
         * @param {object} query
         * @param {string} query.url The url to invoke for saved search
         * @param {object} query.parameters The search parameters valid for the
         * url
         * @param {object} [query.id] If updating previous
         * @param {object} [query.name] The name of search
         * @param {boolean} [query.global=false] If this is global search
         * _Requires special privilege_
         * @example
         * dataRequest('search', 'save', {
         *     url: 'element/search',
         *     name: 'My new Search',
         *     parameters: {
         *         q: 'Search text'
         *     }
         * }).then(function(s) { console.log('saved'); })
         */
        save: function(query) {
            var toFix = [],
                params = query.parameters;

            if (params) {
                _.each(params, function(value, name) {
                    if (_.isArray(value)) {
                        toFix.push(name);
                    }
                });
                toFix.forEach(function(name) {
                    if (!(/\[\]$/).test(name)) {
                        params[name + '[]'] = params[name];
                        delete params[name];
                    }
                });
            }
            return ajax('POST', '/search/save', query);
        },

        /**
         * Delete a search
         *
         * @param {string} id
         */
        delete: function(queryId) {
            return ajax('DELETE->HTML', '/search', {
                id: queryId
            });
        },

        /**
         * Get search object
         *
         * @param {string} id
         */
        get: function(queryId) {
            return ajax('GET', '/search', {
                id: queryId
            });
        },

        /**
         * Execute a search and get results
         *
         * Optionally accepts new parameters that take precedent over saved
         * ones.
         *
         * @param {string} id
         * @param {object} [overrideSearchParameters={}] Allows overriding or
         * adding criteria to saved search
         */
        run: function(queryId, otherParams) {
            return ajax('GET', '/search/run', _.extend({}, otherParams || {}, {
                id: queryId
            }));
        },

        execCypherQuery: function(q, size, offset) {
            return ajax('POST', '/search/cypher', { code: q, size, offset })
        }

    };

    return api;
});
