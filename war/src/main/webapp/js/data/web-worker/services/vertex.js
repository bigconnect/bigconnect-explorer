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
 * Routes for vertices
 *
 * @module services/vertex
 * @see module:dataRequest
 */
define([
    '../util/ajax',
    './storeHelper'
], function(ajax, storeHelper) {
    'use strict';

    /**
     * @alias module:services/vertex
     */
    var api = {

        queryForOptions: function(options) {
            var params = {},
                q = _.isUndefined(options.query.query) ?
                    options.query :
                    options.query.query,
                matchType = options.matchType || 'vertex',
                url = options.forExport ? '/vertex/export-raw-search' : '/' + matchType + '/search',
                originalUrl = url;

            if (options.includeFacets) {
                params.includeFacets = true;
            }

            if (options.conceptFilter && matchType === 'vertex') {
                if (_.isArray(options.conceptFilter)) {
                    params.conceptTypes = JSON.stringify(options.conceptFilter);
                } else {
                    params.conceptType = options.conceptFilter
                }
            }
            if (options.edgeLabelFilter
                && (matchType === 'edge' || (options.otherFilters && (options.otherFilters.relatedToVertexIds || options.otherFilters.similarToVertexIds)))) {
                if (_.isArray(options.edgeLabelFilter)) {
                    params.edgeLabels = JSON.stringify(options.edgeLabelFilter);
                } else {
                    params.edgeLabel = options.edgeLabelFilter
                }
            }
            if (options.paging) {
                if (options.paging.offset) params.offset = options.paging.offset;
                if (options.paging.size) params.size = options.paging.size;
            }
            if (!_.isEmpty(options.sort)) {
                params.sort = options.sort.map(function(sort) {
                    return [sort.field, sort.direction.toUpperCase()].join(':');
                });
            }

            if (q) {
                params.q = q;
            }

            params.fetchReferencedElements = options.fetchReferencedElements;

            if (options.otherFilters) {
                _.each(options.otherFilters, function(value, key, options) {
                    if (key === 'url') {
                        url = value;
                        delete options.url;
                    } else if (_.isString(value) && !value) {
                        delete options[key];
                    }
                });
                _.extend(params, options.otherFilters);
            }

            params.filter = JSON.stringify(options.propertyFilters || []);
            params.refinement = JSON.stringify(options.refinements || []);
			params.logicalSourceString = options.logicalSourceString;

			if (!_.isUndefined(options.fetchHints)) {
                params.fetchHints = options.fetchHints;
            }
            if (!_.isUndefined(options.actionType)) {
                params.actionType = options.actionType;
            }
            if (!_.isUndefined(options.longRunning)) {
                params.longRunning = options.longRunning;
            }

            return Promise.resolve({
                url: url,
                originalUrl: originalUrl,
                parameters: params
            });
        },

        search: function(options) {
            return api.queryForOptions(options)
                .then(function(query) {
                    return ajax('POST', query.url, query.parameters);
                })
                .then(storeHelper.indexSearchResultsProperties)
                .tap(function({ elements, referencedElements }) {
                    if (options.disableResultCache !== true) {
                        if (referencedElements) {
                            storeHelper.putSearchResults(referencedElements)
                        }
                        storeHelper.putSearchResults(elements)
                    }
                })
        },

        exportRawSearch: function(options) {
            return api.queryForOptions(options)
                .then(function(query) {
                    return ajax('POST', query.url, query.parameters);
                })
        },

        'geo-search': function(lat, lon, radius) {
            return ajax('GET', '/vertex/geo-search', {
                lat: lat,
                lon: lon,
                radius: radius
            });
        },

        findPath: function(options) {
            return ajax('GET', '/vertex/find-path', options);
        },

        /**
         * Get history of vertex (property changes, etc)
         *
         * @param {string} vertexId
         * @param {boolean} withVisibility
         */
        history: function(vertexId, withVisibility) {
            return ajax('GET', '/vertex/history', {
                graphVertexId: vertexId,
                withVisibility: withVisibility
            });
        },

        /**
         * Get history for single property
         *
         * @param {string} vertexId
         * @param {object} property
         * @param {string} property.name
         * @param {string} property.key
         * @param {object} [options]
         */
        propertyHistory: function(vertexId, property, options) {
            return ajax('GET', '/vertex/property/history', _.extend(
                {},
                options || {},
                {
                    graphVertexId: vertexId,
                    propertyName: property.name,
                    propertyKey: property.key
                }
            ));
        },

        details: function(vertexId) {
            return ajax('GET', '/vertex/details', { vertexId: vertexId });
        },

        /**
         * @see module:services/vertex.store
         * @function
         */
        multiple: storeHelper.createStoreAccessorOrDownloader('vertex'),

        /**
         * Get vertex properties
         *
         * @param {string} vertexId
         */
        properties: function(vertexId) {
            return ajax('GET', '/vertex/properties', {
                graphVertexId: vertexId
            });
        },

        propertyDetails: function(vertexId, name, key, visibility) {
            return ajax('GET', '/vertex/property/details', {
                vertexId: vertexId,
                propertyName: name,
                propertyKey: key,
                visibilitySource: visibility || ''
            });
        },

        propertyValue: function(vertexId, name, key) {
            return ajax('GET->HTML', '/vertex/property', {
                graphVertexId: vertexId,
                propertyName: name,
                propertyKey: key
            });
        },

        /**
         * Get connected edges to vertex
         *
         * @param {string} id
         * @param {object} [options]
         * @param {object} [options.offset]
         * @param {object} [options.size]
         * @param {object} [options.edgeLabel]
         * @param {object} [options.direction]
         */
        edges: function(vertexId, options) {
            var parameters = {
                graphVertexId: vertexId
            };
            if (options) {
                if (options.offset) parameters.offset = options.offset;
                if (options.size) parameters.size = options.size;
                if (options.edgeLabel) parameters.edgeLabel = options.edgeLabel;
                if (options.direction) parameters.direction = options.direction;
            }

            return ajax('GET', '/vertex/edges', parameters)
                .then(function(response) {
                    if (response.relationships) {
                        response.relationships.forEach(function(relationship) {
                            storeHelper.indexElementProperties(relationship.relationship);
                            storeHelper.indexElementProperties(relationship.vertex);
                        });
                    }
                    return response;
                });
        },

        /**
         * Delete a vertex (sandboxed)
         *
         * @param {string} vertexId
         */
        'delete': function(vertexId) {
            return ajax('DELETE', '/vertex', {
                graphVertexId: vertexId
            })
        },

        /**
         * Check if the vertices exist (in current workspace)
         *
         * @param {Array.<string>} vertexIds
         */
        exists: function(vertexIds) {
            return ajax(vertexIds.length > 1 ? 'POST' : 'GET', '/vertex/exists', {
                vertexIds: vertexIds
            });
        },

        /**
         * Delete a property
         *
         * @param {string} vertexId
         * @param {object} property
         * @param {string} property.name
         * @param {string} property.key
         */
        deleteProperty: function(vertexId, property) {
            var url = storeHelper.vertexPropertyUrl(property);
            return ajax('DELETE', url, {
                graphVertexId: vertexId,
                propertyName: property.name,
                propertyKey: property.key
            })
        },

        /**
         * Get text property in HTML format
         *
         * @param {string} vertexId
         * @param {string} propertyKey
         * @param {string} propertyName
         */
        'highlighted-text': function(vertexId, propertyKey, propertyName) {
            return ajax('GET->HTML', '/vertex/highlighted-text', {
                graphVertexId: vertexId,
                propertyKey: propertyKey,
                propertyName: propertyName
            });
        },

        /**
         * Get text property raw
         *
         * @param {string} vertexId
         * @param {string} propertyKey
         * @param {string} propertyName
         */
        'text': function(vertexId, propertyKey, propertyName) {
            return ajax('GET->HTML', '/vertex/text', {
                graphVertexId: vertexId,
                propertyKey: propertyKey,
                propertyName: propertyName
            });
        },

        related: function(vertexIds, options) {
            return ajax('POST', '/vertex/find-related', {
                graphVertexIds: vertexIds,
                limitEdgeLabel: options.limitEdgeLabel,
                limitParentConceptId: options.limitParentConceptId
            });
        },

        /**
         * Get the vertexIds from the cache or request multiple vertices if they aren't yet cached.
         *
         * @function
         * @param {object} obj
         * @param {Array.<string>} obj.vertexIds
         * @return {Array.<object>} vertices
         * @example
         * dataRequest('vertex', 'store', {
         *    vertexIds: ['v1', 'v2']
         * }).then(function(vertices) {
         *     // ...
         * })
         */
        store: function(options) {
            return api.multiple(options);
        },

        uploadImage: function(vertexId, file) {
            return ajax('POST', '/vertex/upload-image?' +
                'graphVertexId=' + encodeURIComponent(vertexId), file);
        },

        /**
         * Create new vertex
         *
         * @param {object} justification
         * @param {string} [justification.justificationText]
         * @param {string} [justification.sourceInfo]
         * @param {string} conceptType
         * @param {string} visibilitySource
         */
        create: function(justification, conceptType, visibilitySource, geolocation, vertexTitle) {
            if(!geolocation) {
                geolocation = { lon: 0, lat: 0};
            }

            return ajax('POST', '/vertex/new', _.tap({
                conceptType: conceptType,
                visibilitySource: visibilitySource,
                title: vertexTitle,
                lat: geolocation.lat,
                lon: geolocation.lon
            }, function(data) {
                if (justification.justificationText) {
                    data.justificationText = justification.justificationText;
                } else if (justification.sourceInfo) {
                    data.sourceInfo = JSON.stringify(justification.sourceInfo);
                }
            }));
        },

        importFiles: function(files, conceptValue, visibilitySource, title) {
            var formData = new FormData();

            _.forEach(files, function(f) {
                formData.append('file', f);
                if (_.isString(visibilitySource)) {
                    formData.append('visibilitySource', visibilitySource);
                }
                if (_.isString(conceptValue)) {
                    formData.append('conceptId', conceptValue);
                }
                if (_.isString(title)) {
                    formData.append('title', title);
                }
            });

            if (_.isArray(conceptValue)) {
                _.forEach(conceptValue, function(v) {
                    formData.append('conceptId', v);
                });
            }

            if (_.isArray(title)) {
                _.forEach(title, function(v) {
                    formData.append('title', v);
                });
            }

            return ajax('POST', '/vertex/import', formData);
        },

        importFileString: function(content, conceptValue, visibilitySource) {
            var formData = new FormData();

            formData.append('file', new Blob([content.string], {
                type: content.type
            }), 'untitled.' + (content.type === 'text/html' ? 'html' : 'txt'));
            if (_.isString(visibilitySource)) {
                formData.append('visibilitySource', visibilitySource);
            }
            if (_.isString(conceptValue)) {
                formData.append('conceptId', conceptValue);
            }

            return ajax('POST', '/vertex/import', formData);
        },

        /**
         * Set visibility on an vertex
         *
         * @param {string} vertexId
         * @param {string} visibilitySource
         */
        setVisibility: function(vertexId, visibilitySource) {
            return ajax('POST', '/vertex/visibility', {
                graphVertexId: vertexId,
                visibilitySource: visibilitySource
            }).tap(storeHelper.updateElement);
        },

        /**
         * Set visibility on a property
         *
         * @param {string} vertexId
         * @param {object} property
         * @param {string} property.visibilitySource
         * @param {string} property.oldVisibilitySource
         * @param {string} property.key
         * @param {string} property.name
         */
        setPropertyVisibility: function(vertexId, property) {
            return ajax('POST', '/vertex/property/visibility', {
                graphVertexId: vertexId,
                newVisibilitySource: property.visibilitySource,
                oldVisibilitySource: property.oldVisibilitySource,
                propertyKey: property.key,
                propertyName: property.name
            })
        },

        /**
         * Change/add property
         *
         * @param {string} vertexId
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
        setProperty: function(vertexId, property, optionalWorkspaceId) {
            var url = storeHelper.vertexPropertyUrl(property);
            return ajax('POST', url, _.tap({
                 graphVertexId: vertexId,
                 propertyName: property.name,
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
                if (_.isObject(property.value)) {
                    params.values = property.value;
                } else {
                    params.value = property.value;
                }
            })).tap(storeHelper.updateElement);
        },

        resolveTerm: function(params) {
            return ajax('POST', '/vertex/resolve-term', params);
        },

        unresolveTerm: function(params) {
            return ajax('POST', '/vertex/unresolve-term', params);
        },
        deleteTerm: function(params) {
            return ajax('POST', '/vertex/delete-term', params);
        },

		editText:  function(params) {
            return ajax('POST', '/vertex/edit-text', params);
        },
        resolveDetectedObject: function(params) {
            return ajax('POST', '/vertex/resolve-detected-object', params);
        },

        unresolveDetectedObject: function(params) {
            return ajax('POST', '/vertex/unresolve-detected-object', params);
        },

        requeue: function(vertexId) {
            return ajax('GET', '/vertex/requeue', { vertexId });
        },

        unresolveTermMentions: function(vertexId) {
            return ajax('POST', '/vertex/unresolve-all-terms', { vertexId });
        }

    };

    return api;
});
