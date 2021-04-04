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
    'data/web-worker/store/selection/actions',
    'data/web-worker/store/element/actions',
    'data/web-worker/store/product/actions',
    'data/web-worker/store/product/selectors',
    'configuration/plugins/registry'
], function(selectionActions, elementActions, productActions, productSelectors, registry) {
    'use strict';

    return withObjectSelection;

    function defaultNoObjectsOrData(data) {
        var baseObj = {
                vertices: [],
                edges: [],
                vertexIds: {},
                edgeIds: {}
            },
            returnable = _.extend({}, baseObj, data || {});

        returnable.vertexIds = _.indexBy(returnable.vertices, 'id');
        returnable.edgeIds = _.indexBy(returnable.edges, 'id');

        return returnable;
    }

    function withObjectSelection() {

        var selectedObjects,
            previousSelectedObjects,
            GRAPH_SELECTION_THROTTLE = 100;

        this.after('initialize', function() {
            var self = this;
            this.selectedObjectsStack = [];

            this.subscribeForSelection();

            this.setPublicApi('selectedObjects', defaultNoObjectsOrData());

            // Guarantees that we aren't after a selectObjects call but before objectsSelected
            this.currentSelectObjectsPromise = Promise.resolve();
            bcData.selectedObjectsPromise = this.selectedObjectsPromise.bind(this);

            this.on('selectObjects', this.onSelectObjects);
            this.on('focusElements', this.onFocusElements);
            this.on('defocusElements', this.onDefocusElements);
            this.on('deleteSelected', this.onDeleteSelected);
            this.on('edgesLoaded', this.onEdgesLoaded);
            this.on('edgesDeleted', function(event, data) {
                if (selectedObjects && _.findWhere(selectedObjects.edges, { id: data.edgeId })) {
                    if (selectedObjects.edges.length === 1) {
                        this.trigger('selectObjects');
                    } else {
                        selectedObjects.edges = _.reject(selectedObjects.edges, function(e) {
                            return data.edgeId === e.id
                        })
                    }
                }
                this.removeFromStack([data.edgeId]);
            });
            this.on('verticesDeleted', function(event, data) {
                if (selectedObjects) {
                    if (selectedObjects.vertices.length) {
                        var newSelection = _.reject(selectedObjects.vertices, function(v) {
                                return ~data.vertexIds.indexOf(v.id)
                            });
                        if (selectedObjects.vertices.length !== newSelection.length) {
                            this.trigger('selectObjects', {
                                vertices: newSelection
                            });
                        }
                    }
                }
                this.removeFromStack(data.vertexIds);
            });
            this.on('switchWorkspace', function() {
                this.selectedObjectsStack = [];
                this.setPublicApi('selectedObjectsStack');
            });
            this.on('searchTitle', this.onSearchTitle);
            this.on('searchRelated', this.onSearchRelated);
            this.on('addRelatedItems', this.onAddRelatedItems);
            this.on('objectsSelected', this.onObjectsSelected);
        });

        this.subscribeForSelection = function() {
            const selector = state => state.selection.idsByType;

            bcData.storePromise.then((store) => store.observe(selector, (newSelection) => {
                this.trigger('selectObjects', {
                    vertexIds: newSelection.vertices,
                    edgeIds: newSelection.edges,
                    options: newSelection.options,
                    dispatch: false
                });
            }))
        };

        this.displayInfo = function(i18nMessage) {
            this.trigger('displayInformation', {
                message: i18n.apply(null, arguments)
            });
        };

        this.selectedObjectsPromise = function() {
            return this.currentSelectObjectsPromise.then(function() {
                return selectedObjects;
            });
        };

        this.onEdgesLoaded = function(event, data) {
            this.setPublicApi('workspaceEdges', data.edges);
        };

        this.onDeleteSelected = function(event, data) {
            var self = this;

            bcData.storePromise.then(store => {
                var vertexIds = [],
                    product = productSelectors.getProduct(store.getState());

                if (product) {
                    if (data && data.vertexId) {
                        vertexIds = [data.vertexId]
                    } else if (selectedObjects && selectedObjects.vertices.length) {
                        vertexIds = _.pluck(selectedObjects.vertices, 'id')
                    }

                    const extension = _.findWhere(registry.extensionsForPoint('org.bigconnect.workproduct'), {
                        identifier: product.kind
                    });

                    if (extension.storeActions && _.isFunction(extension.storeActions.removeElements)) {
                        store.dispatch(extension.storeActions.removeElements(product.id, { vertexIds }, { undoable: true }));
                    }
                }
            })
        };

        this.onFocusElements = function(event, data) {
            bcData.storePromise.then(store => {
                store.dispatch(elementActions.setFocus(data));
            });
        };

        this.onDefocusElements = function(event, data) {
            bcData.storePromise.then(store => {
                store.dispatch(elementActions.setFocus({ vertexIds: [], edgeIds: [] }));
            });
        };

        /**
         * Trigger this event to select edges or vertices. This will show blue selected
         * background on these elements and open the Element Inspector.
         *
         * @global
         * @event selectObjects
         * @property {object} [data]
         * @property {Array.<string>} [data.vertexIds=[]] The vertexIds to select
         * @property {Array.<string>} [data.edgeIds=[]] The edgeIds to select
         * @property {Array.<object>} [data.vertices=[]] The vertices to select
         * @property {Array.<object>} [data.edges=[]] The edges to select
         * @example <caption>From Flight component</caption>
         * this.trigger('selectObjects', { vertexIds: ['v1'] })
         * @example <caption>From anywhere</caption>
         * $(document).trigger('selectObjects', { edgeIds: ['e1'] })
         */
        this.onSelectObjects = function(event, data) {
            if (data && 'focus' in data) {
                console.warn(`selectObjects event with "focus" should be moved to options object. Support will be removed in future versions, use: this.trigger('selectObjects', { options: { focus: true }})`);
                data.options = { focus: data.focus, ...(data.options || {}) };
            }
            if (!data || data.dispatch !== false) {
                bcData.storePromise.then(store => {
                    var action;
                    if (data) {
                        let payload = {
                            vertices: data.vertexIds,
                            edges: data.edgeIds,
                            options: data.options
                        };
                        if (data.vertices) payload.vertices = _.pluck(data.vertices, 'id');
                        if (data.edges) payload.edges = _.pluck(data.edges, 'id');
                        action = selectionActions.set(payload);
                    } else {
                        action = selectionActions.clear();
                    }
                    store.dispatch(action);
                })
                return;
            }

            var self = this;
            this.currentSelectObjectsPromise = new Promise(function(f) {
                var hasItems = data &&
                        (
                            (data.vertexIds || data.vertices || []).length > 0 ||
                            (data.edgeIds || data.edges || []).length > 0
                        ),
                    promises = [];

                self.dataRequestPromise.done(function(dataRequest) {
                    if (data && data.vertexIds) {
                        if (!_.isArray(data.vertexIds)) {
                            data.vertexIds = [data.vertexIds];
                        }
                        promises.push(
                            dataRequest('vertex', 'store', { vertexIds: data.vertexIds })
                        );
                    } else if (data && data.vertices) {
                        promises.push(Promise.resolve(data.vertices));
                    } else {
                        promises.push(Promise.resolve([]));
                    }

                    if (data && data.edgeIds && data.edgeIds.length) {
                        promises.push(
                            dataRequest('edge', 'store', { edgeIds: data.edgeIds })
                        );
                    } else if (data && data.edges) {
                        promises.push(Promise.resolve(data.edges));
                    } else {
                        promises.push(Promise.resolve([]));
                    }

                    Promise.all(promises)
                        .done(function(result) {
                            var vertices = _.compact(result[0] || []),
                                edges = _.compact(result[1] || []),
                                selectedObjectsToIds = function(obj) {
                                    return {
                                        vertices: _.pluck(obj && obj.vertices || [], 'id'),
                                        edges: _.pluck(obj && obj.edges || [], 'id')
                                    };
                                };

                            if (!edges.length && !vertices.length && hasItems) {
                                self.trigger('objectsSelectedAborted');
                                f();
                                return;
                            }

                            selectedObjects = {
                                vertices: vertices,
                                edges: edges
                            };

                            if (previousSelectedObjects &&
                                selectedObjects &&
                                _.isEqual(
                                    selectedObjectsToIds(previousSelectedObjects),
                                    selectedObjectsToIds(selectedObjects)
                                )) {
                                self.trigger('objectsSelectedAborted');
                                f();
                                return;
                            }

                            self.appendToStack(selectedObjects)
                                .done(function() {
                                    previousSelectedObjects = selectedObjects;

                                    var transformedObjects = defaultNoObjectsOrData(selectedObjects);
                                    self.setPublicApi('selectedObjects', transformedObjects);

                                    var postData = _.chain(selectedObjects)
                                        .clone()
                                        .mapObject(function(value) {
                                            return _.clone(value);
                                        })
                                        .value();
                                    if (data && 'options' in data) {
                                        postData.options = data.options;
                                    } else {
                                        postData.options = {};
                                    }

                                    /**
                                     * Listen for this event to be notified of selection changes
                                     *
                                     * @global
                                     * @event objectsSelected
                                     * @property {object} data
                                     * @property {Array.<object>} data.vertices
                                     * @property {Array.<object>} data.edges
                                     * @property {object} data.options
                                     * @property {object} data.options.focus Used to scroll to sourceInfo of document text
                                     * @example <caption>From Flight</caption>
                                     * this.on(document, 'objectsSelected', function(event, data) {
                                     *     console.log('Selection:', data.vertices, data.edges);
                                     * })
                                     * @example <caption>Anywhere</caption>
                                     * $(document).on('objectsSelected', function(e, data) {
                                     *     console.log('Selection:', data.vertices, data.edges);
                                     * })
                                     */
                                    self.trigger(event.target, 'objectsSelected', postData);
                                    f();
                                });
                        });
                });
            });
        };

        this.onObjectsSelected = function(event, data) {
            var self = this;

            if (data.vertices.length || data.edges.length) {
                require(['util/vertex/urlFormatters'], function(F) {
                    self.trigger('clipboardSet', {
                        text: F.vertexUrl.url(data.vertices.concat(data.edges), bcData.currentWorkspaceId)
                    });
                })
            } else {
                this.trigger('clipboardClear');
            }

            if (window.DEBUG) {
                DEBUG.selectedObjects = data;
            }
        };

        this.onSearchTitle = function(event, data) {
            var self = this,
                vertexId = data.vertexId || (
                    selectedObjects &&
                    selectedObjects.vertices.length === 1 &&
                    selectedObjects.vertices[0].id
                );

            if (vertexId) {
                Promise.all([
                    Promise.require('util/vertex/formatters'),
                    this.dataRequestPromise.then(function(dataRequest) {
                        return dataRequest('vertex', 'store', { vertexIds: vertexId });
                    })
                ]).done(function(results) {
                    var F = results.shift(),
                        vertex = results.shift(),
                        title = F.vertex.title(vertex);

                    self.trigger('searchByParameters', { submit: true, parameters: { q: title }});
                })
            }
        };

        this.onSearchRelated = function(event, data) {
            var self = this;

            Promise.require('util/vertex/formatters')
                .then(function(F) {
                    return F.vertex.getVertexIdsFromDataEventOrCurrentSelection(data, { async: true });
                })
                .then(function(vertexIds) {
                    self.trigger('searchByRelatedEntity', { vertexIds: vertexIds });
                })
        };

        this.onAddRelatedItems = function(event, data) {
            var self = this;

            const outsideGraph = $(event.target).closest('.org-bigconnect-graph').length === 0;
            if (outsideGraph) {
                return;
            }
            if (!bcData.currentWorkspaceEditable) {
                this.displayInfo('graph.workspace.readonly')
                return;
            }

            Promise.require('util/vertex/formatters')
                .then(function(F) {
                    return F.vertex.getVertexIdsFromDataEventOrCurrentSelection(data, { async: true });
                })
                .then(function(vertexIds) {

                    if (vertexIds.length) {
                        Promise.all([
                            Promise.require('util/popovers/addRelated/addRelated'),
                            self.dataRequestPromise.then(function(dataRequest) {
                                return dataRequest('vertex', 'store', { vertexIds: vertexIds })
                            })
                        ]).done(function(results) {
                            var RP = results.shift(),
                                vertex = results.shift();

                            RP.teardownAll();

                            RP.attachTo(event.target, {
                                vertex: vertex,
                                relatedToVertexIds: vertexIds,
                                anchorTo: {
                                    vertexId: vertexIds[0]
                                }
                            });
                        });
                    }
                });
        };

        this.getConfigurationMaxHistory = function() {
            if (!this.configurationPropertiesPromise) {
                this.configurationPropertiesPromise =
                    this.dataRequestPromise
                        .then(function(dataRequest) {
                            return dataRequest('config', 'properties');
                        })
                        .then(function(properties) {
                            return parseInt(properties['detail.history.stack.max'], 10);
                        });
            }

            return this.configurationPropertiesPromise
        };

        this.appendToStack = function(selectedObjects) {
            var self = this,
                currentObjects = defaultNoObjectsOrData(selectedObjects),
                currentVertexIds = _.keys(currentObjects.vertexIds),
                currentEdgeIds = _.keys(currentObjects.edgeIds);

            if (!_.isEmpty(currentVertexIds) || !_.isEmpty(currentEdgeIds)) {
                var multiple = (currentVertexIds.length + currentEdgeIds.length) > 1;

                this.selectedObjectsStack = _.reject(this.selectedObjectsStack, function(stack) {
                    return _.isEqual(stack.vertexIds, currentVertexIds) &&
                           _.isEqual(stack.edgeIds, currentEdgeIds);
                });

                if (this.selectedObjectsStack.length) {
                    _.last(this.selectedObjectsStack).hide = false;
                }

                this.selectedObjectsStack.push({
                    vertexIds: currentVertexIds || [],
                    edgeIds: currentEdgeIds || [],
                    hide: true,
                    multiple: multiple
                });

                return this.updateStack();
            } else {
                return Promise.resolve();
            }
        };

        this.removeFromStack = function(ids) {
            this.selectedObjectsStack.forEach(function(stack) {
                stack.vertexIds = _.difference(stack.vertexIds, ids);
                stack.edgeIds = _.difference(stack.edgeIds, ids);
            });

            return this.updateStack()
        };

        this.updateStack = function() {
            var self = this;

            return Promise.all([
                this.getConfigurationMaxHistory(),
                this.dataRequestPromise
            ]).spread(function(max, dataRequest) {
                var vertexIdsToRequest = _.chain(self.selectedObjectsStack)
                        .filter(function(s) {
                            return s.vertexIds.length === 1;
                        })
                        .map(function(s) {
                            return s.vertexIds[0];
                        })
                        .value();
                var edgeIdsToRequest = _.chain(self.selectedObjectsStack)
                        .filter(function(s) {
                            return s.edgeIds.length;
                        })
                        .map(function(s) {
                            return s.edgeIds;
                        })
                        .flatten()
                        .value();
                var edgesById;

                return (edgeIdsToRequest.length ?
                        dataRequest('edge', 'store', { edgeIds: _.unique(edgeIdsToRequest) }) :
                        Promise.resolve([])
                    ).then(function(edges) {
                        edgesById = _.indexBy(_.compact(edges), 'id');
                        edges.forEach(function(edge) {
                            vertexIdsToRequest.push(edge.outVertexId);
                            vertexIdsToRequest.push(edge.inVertexId);
                        });

                        if (vertexIdsToRequest.length) {
                            return dataRequest('vertex', 'store', { vertexIds: _.unique(vertexIdsToRequest) });
                        }
                        return Promise.resolve([]);
                    }).then(function(vertices) {
                        var verticesById = _.indexBy(_.compact(vertices), 'id');
                        var vertexIds = _.pluck(verticesById, 'id');
                        var removedEdgeIds = [];

                        _.each(edgesById, function(edge) {
                            var hasOutVertex = _.contains(vertexIds, edge.outVertexId);
                            var hasInVertex = _.contains(vertexIds, edge.inVertexId);

                            if (!hasOutVertex || !hasInVertex) {
                                removedEdgeIds.push(edge.id);
                            }
                        });

                        self.checkStackForRemovedEdges(removedEdgeIds);

                        return self.updateStackLabels(verticesById, edgesById)
                            .then(function() {
                                var notHidden = _.reject(self.selectedObjectsStack, function(s) {
                                    return s.hide;
                                });
                                self.setPublicApi('selectedObjectsStack', notHidden.slice(Math.max(0, notHidden.length - max)));
                            });
                    });
            });
        };

        this.checkStackForRemovedEdges = function(edgeIds) {
            this.selectedObjectsStack = _.chain(this.selectedObjectsStack)
                .map(function(stack) {
                    stack.edgeIds = _.difference(stack.edgeIds, edgeIds);

                    var numSelections = stack.edgeIds.length + stack.vertexIds.length;
                    stack.multiple = numSelections > 1;
                    if (numSelections === 0) {
                        stack = null;
                    }

                    return stack;
                })
                .unique(function(stack) {
                    if (stack) {
                        var stackIds = stack.vertexIds.concat(stack.edgeIds);
                        var sortedIds = _.sortBy(stackIds);
                        sortedIds.push(stack.hide);
                        return sortedIds.toString()
                    } else {
                        return '';
                    }
                })
                .compact()
                .value();
        };

        this.updateStackLabels = function(verticesById, edgesById) {
            var self = this;

            return Promise.all([
               Promise.require('util/vertex/formatters'),
               this.dataRequestPromise.then(function(dataRequest) {
                   return dataRequest('ontology', 'relationships')
               })
            ]).spread(function(F, relationships) {
                var notHidden = _.reject(self.selectedObjectsStack, function(s) {
                    return s.hide;
                });

                notHidden.forEach(function(s) {
                    var hadVertexIds = s.vertexIds.length;
                    if (!s.multiple) {
                        s.vertexIds = _.filter(s.vertexIds, function(vertexId) {
                            return vertexId in verticesById;
                        });
                        s.edgeIds = _.filter(s.edgeIds, function(edgeId) {
                            return edgeId in edgesById;
                        });
                    }

                    if (s.vertexIds.length && s.edgeIds.length) {
                        s.title = F.number.pretty(s.vertexIds.length + s.edgeIds.length) + ' items';
                    } else if (hadVertexIds) {
                        if (s.vertexIds.length === 1) {
                            s.title = F.vertex.title(verticesById[s.vertexIds[0]]);
                        } else if (s.vertexIds.length) {
                            s.title = F.number.pretty(s.vertexIds.length) + ' entities';
                        } else {
                            s.hide = true;
                        }
                    } else if (s.edgeIds.length === 1) {
                        var edge = edgesById[s.edgeIds[0]],
                            source = edge && verticesById[edge.outVertexId],
                            target = edge && verticesById[edge.inVertexId],
                            ontologyEdge = edge && relationships.byTitle[edge.label],
                            label = ' → ';
                        if (source && target) {
                            s.title = [
                                F.string.truncate(F.vertex.title(source), 2),
                                F.string.truncate(F.vertex.title(target), 2)
                            ].join(label);
                        } else {
                            s.hide = true;
                        }
                    } else if (s.edgeIds.length) {
                        s.title = F.number.pretty(s.edgeIds.length) + ' relationships';
                    } else {
                        s.hide = true;
                    }
                });
            });
        };
    }
});
