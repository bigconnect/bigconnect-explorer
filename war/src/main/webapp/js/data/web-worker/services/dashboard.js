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
 * Routes for dashboards and dashboard cards/items
 *
 * @module services/dashboard
 * @see module:dataRequest
 */
define([
    '../util/ajax',
    './storeHelper'
], function(ajax, storeHelper) {
    'use strict';

    /**
     * @alias module:services/dashboard
     */
    return {

        requestData: function(endpoint, params) {
            return ajax('GET', endpoint, params);
        },

        postData: function(endpoint, params) {
            return ajax('POST', endpoint, params)
                .then(storeHelper.indexSearchResultsProperties);
        },

        /**
         * Get list of all dashboards (without extendedData)
         */
        dashboards: function() {
            return ajax('GET', '/dashboard/all')
                .then(function(result) {
                    return result.dashboards.map(function(dashboard) {
                        dashboard.items = dashboard.items.map(function(item) {
                            if (item.configuration) {
                                try {
                                    item.configuration = JSON.parse(item.configuration);
                                } catch(e) {
                                    console.error(e);
                                }
                            }
                            return item;
                        })
                        return dashboard;
                    })
                })
        },

        /**
         * Remove an item from a dashboard
         *
         * @param {string} itemId
         */
        dashboardItemDelete: function(itemId) {
            return ajax('DELETE', '/dashboard/item', {
                dashboardItemId: itemId
            });
        },

        /**
         * Create a new dashboard
         *
         * @param {object} [options]
         * @param {string} [options.title='Untitled'] The title of the new dashboard
         * @param {Array.<object>} [options.items=[]] List of item configurations
         * to add to new dashboard
         */
        dashboardNew: function(options) {
            var params = {};
            if (options && options.title) {
                params.title = options.title;
            }
            if (options && options.items) {
                params.items = options.items.map(function(item) {
                    var mapped = _.extend({}, item);
                    if (mapped.configuration) {
                        mapped.configuration = JSON.stringify(mapped.configuration);
                    }
                    return JSON.stringify(mapped);
                })
            }
            return ajax('POST', '/dashboard', params);
        },

        /**
         * Update dashboard
         *
         * @param {object} params
         */
        dashboardUpdate: function(params) {
            return ajax('POST', '/dashboard', params);
        },

        /**
         * Update item on dashboard
         *
         * @param {object} item The configuration to update
         * @param {string} item.id
         * @param {string} item.extensionId
         * @param {string} item.title
         * @param {object} [item.configuration={}]
         */
        dashboardItemUpdate: function(item) {
            return ajax('POST', '/dashboard/item', {
                dashboardItemId: item.id,
                extensionId: item.extensionId,
                title: item.title,
                configuration: JSON.stringify(item.configuration || {})
            });
        },

        /**
         * Create new dashboard item
         *
         * @param {string} dashboardId
         * @param {object} item The new item configuration
         * @param {string} item.id
         * @param {string} item.extensionId
         * @param {string} [item.title]
         * @param {object} [item.configuration={}]
         */
        dashboardItemNew: function(dashboardId, item) {
            if (!dashboardId) throw new Error('dashboardId required if new item');

            var params = {
                dashboardId: dashboardId
            };
            if ('title' in item) {
                params.title = item.title;
            }
            if (item.configuration) {
                params.configuration = JSON.stringify(item.configuration);
            }
            if ('extensionId' in item) {
                params.extensionId = item.extensionId;
            }
            return ajax('POST', '/dashboard/item', params);
        }
    };
});
