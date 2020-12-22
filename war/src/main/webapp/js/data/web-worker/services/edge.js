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
 * Routes for edges
 *
 * @module services/edge
 * @see module:dataRequest
 */
define([
    '../util/ajax',
    './storeHelper',
    'require'
], function(ajax, storeHelper, require) {
    'use strict';

    /**
     * @alias module:services/edge
     */
    var api = {

        /**
         * Create an edge
         *
         * @param {object} options
         */
        create: function(options) {
            return ajax('POST', '/edge/create', options);
        },

        /**
         * Delete an edge (sandboxed)
         *
         * @param {string} edgeId
         */
        'delete': function(edgeId) {
            return ajax('DELETE', '/edge', {
                edgeId: edgeId
            });
        },

        /**
         * Check if the edge(s) exists (in current workspace)
         *
         * @param {Array.<string>} edgeIds
         */
        exists: function(edgeIds) {
            return ajax(edgeIds.length > 1 ? 'POST' : 'GET', '/edge/exists', {
                edgeIds: edgeIds
            });
        },

        /**
         * Get edge properties
         *
         * @param {string} edgeId
         */
        properties: function(edgeId) {
            return ajax('GET', '/edge/properties', {
                graphEdgeId: edgeId
            });
        },

        propertyDetails: function(edgeId, propertyName, propertyKey, visibilitySource = '') {
            return ajax('GET', '/edge/property/details', {
                edgeId,
                propertyName,
                propertyKey,
                visibilitySource
            });
        },

        /**
         * Set visibility on a property
         *
         * @param {string} edgeId
         * @param {object} property
         * @param {string} property.visibilitySource
         * @param {string} property.oldVisibilitySource
         * @param {string} property.key
         * @param {string} property.name
         */
        setPropertyVisibility: function(edgeId, property) {
            return ajax('POST', '/edge/property/visibility', {
                graphEdgeId: edgeId,
                newVisibilitySource: property.visibilitySource,
                oldVisibilitySource: property.oldVisibilitySource,
                propertyKey: property.key,
                propertyName: property.name
            })
        },

        /**
         * Change/add property
         *
         * @param {string} edgeId
         * @param {object} property
         * @param {string} property.visibilitySource
         * @param {string} property.justificationText
         * @param {string} property.value
         * @param {string} property.name
         * @param {string} [property.key]
         * @param {object} [property.metadata]
         * @param {object} [property.sourceInfo]
         * @param {string} [workspaceId]
         */
        setProperty: function(edgeId, property, optionalWorkspaceId) {
            var url = storeHelper.edgePropertyUrl(property);
            return ajax('POST', url, _.tap({
                 edgeId: edgeId,
                 propertyName: property.name,
                 value: property.value,
                 visibilitySource: property.visibilitySource,
                 oldVisibilitySource: property.oldVisibilitySource
            }, function(params) {
                if (property.sourceInfo) {
                    params.sourceInfo = JSON.stringify(property.sourceInfo);
                } else if (property.justificationText) {
                    params.justificationText = property.justificationText;
                }
                if (!_.isUndefined(property.key)) {
                    params.propertyKey = property.key;
                }
                if (property.metadata) {
                    params.metadata = JSON.stringify(property.metadata)
                }
                if (optionalWorkspaceId) {
                    params.workspaceId = optionalWorkspaceId;
                }
            })).tap(storeHelper.updateElement);
        },

        /**
         * Delete a property
         *
         * @param {string} edgeId
         * @param {object} property
         * @param {string} property.name
         * @param {string} property.key
         */
        deleteProperty: function(edgeId, property) {
            var url = storeHelper.edgePropertyUrl(property);
            return ajax('DELETE', url, {
                edgeId: edgeId,
                propertyName: property.name,
                propertyKey: property.key
            })
        },

        details: function(edgeId) {
            return ajax('GET', '/edge/details', { edgeId: edgeId });
        },

        /**
         * Get history of edge (property changes, etc)
         *
         * @param {string} edgeId
         * @param {boolean} withVisibility
         */
        history: function(edgeId, withVisibility) {
            return ajax('GET', '/edge/history', {
                graphEdgeId: edgeId,
                withVisibility: withVisibility
            });
        },

        /**
         * Get history for single property
         *
         * @param {string} edgeId
         * @param {object} property
         * @param {string} property.name
         * @param {string} property.key
         * @param {object} [options]
         */
        propertyHistory: function(edgeId, property, options) {
            return ajax('GET', '/edge/property/history', _.extend(
                {},
                options || {},
                {
                    graphEdgeId: edgeId,
                    propertyName: property.name,
                    propertyKey: property.key
                }
            ));
        },

        /**
         * @see module:services/edge.store
         * @function
         */
        multiple: storeHelper.createStoreAccessorOrDownloader('edge'),

        /**
         * Get the edgeIds from the cache or request multiple edges
         * if they aren't yet cached.
         *
         * @function
         * @param {object} obj
         * @param {Array.<string>} obj.edgeIds
         * @return {Array.<object>} edges
         * @example
         * dataRequest('edge', 'store', {
         *    edgeIds: ['e1', 'e2']
         * }).then(function(edges) {
         *     // ...
         * })
         */
        store: function(options) {
            return api.multiple(options);
        },

        /**
         * Set visibility on an edge
         *
         * @param {string} edgeId
         * @param {string} visibilitySource
         */
        setVisibility: function(edgeId, visibilitySource) {
            return ajax('POST', '/edge/visibility', {
                graphEdgeId: edgeId,
                visibilitySource: visibilitySource
            }).tap(storeHelper.updateElement);
        },
		
		requeue: function(edgeId) {
            return ajax('GET', '/edge/requeue', { edgeId: edgeId });
        }
    };

    return api;
});
