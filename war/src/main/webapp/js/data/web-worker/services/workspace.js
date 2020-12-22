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
 * Routes for workspace (case)
 *
 * @module services/workspace
 * @see module:dataRequest
 */
define([
    '../util/ajax',
    '../store',
    '../store/workspace/actions-impl',
    '../store/element/selectors',
    '../store/product/selectors',
    '../util/queue'
], function(ajax, storeHelper, workspaceActions, elementSelectors, productSelectors, queue) {
    'use strict';

    const { getStore } = storeHelper;

    /**
     * @alias module:services/workspace
     */
    var api = {

        /**
         * Get the current sandboxed unpublished changes in workspace
         *
         * @param {string} [workspaceId]
         */
        diff: function(workspaceId) {
            var workspaces = getStore().getState().workspace;
            return ajax('GET', '/workspace/diff', {
                workspaceId: workspaceId || workspaces.currentId
            });
        },

        getOrCreate: function() {
            var workspaces = getStore().getState().workspace;
            return (workspaces.currentId ? api.get() : Promise.reject())
                .catch(function() {
                    return api.all()
                        .then(function(workspaces) {
                            var workspace = _.findWhere(workspaces, { sharedToUser: false });
                            if (workspace) {
                                return api.get(workspace.workspaceId);
                            }
                            return api.create();
                        });
                });
        },

        all: function() {
            var workspaces = getStore().getState().workspace;
            if (workspaces.allLoaded) {
                return Promise.resolve(sort(Object.values(workspaces.byId)));
            } else {
                return ajax('GET', '/workspace/all')
                    .then(function(result) {
                        getStore().dispatch(workspaceActions.setAll({ workspaces: result.workspaces }));
                        return sort(result.workspaces);
                    })
            }

            function sort(workspaces) {
                return _.sortBy(workspaces, function(w) {
                    return w.title.toLowerCase();
                });
            }
        },

        get: function(workspaceId) {
            var workspaces = getStore().getState().workspace;
            return ajax('GET', '/workspace', {
                workspaceId: workspaceId || workspaces.currentId
            }).tap(workspace => {
                getStore().dispatch(workspaceActions.update({ workspace }))
            });
        },

        'delete': function(workspaceId) {
            return ajax('DELETE', '/workspace', {
                workspaceId: workspaceId
            })
                .tap(() => {
                    getStore().dispatch(workspaceActions.deleteWorkspace({ workspaceId }))
                })
        },

        current: function(workspaceId) {
            var workspaces = getStore().getState().workspace;
            return Promise.resolve(workspaces.byId[workspaceId || workspaces.currentId]);
        },

        histogramValues: function(property) {
            const store = getStore();
            const state = store.getState();
            const workspaceId = state.workspace.currentId;
            const elements = state.element[workspaceId];
            const productId = state.product.workspaces[workspaceId].selected;
            const product = productId && state.product.workspaces[workspaceId].products[productId];

            if (!product) {
                throw new Error('No Product to calculate timeline')
            }

            const getExtendedData = () => {
                if (product.extendedData) {
                    return Promise.resolve(productSelectors.getElementIdsInProduct(state));
                }
                let unsubscribe = () => {};
                return new Promise(function(fulfill) {
                    unsubscribe = store.observe((nextState, prevState) => {
                        if (!prevState || prevState.product.workspaces !== nextState.product.workspaces) {
                            const product = productId && nextState.product.workspaces[workspaceId].products[productId];
                            if (product.extendedData && product.extendedData.vertices && product.extendedData.edges) {
                                fulfill(productSelectors.getElementIdsInProduct(nextState));
                            }
                        }
                    })
                }).tap(unsubscribe);
            }
            const getElements = ({ vertices, edges }) => {
                const check = (elementsState) => {
                    const ret = {
                        vertices: _.compact(Object.keys(vertices).map(id => elementsState.vertices[id])),
                        edges: _.compact(Object.keys(edges).map(id => elementsState.edges[id]))
                    }
                    if (ret.vertices.length === Object.keys(vertices).length
                        && ret.edges.length === Object.keys(edges).length) {
                        return ret;
                    }
                }
                const result = check(elements);
                if (result) {
                    return result;
                } else {
                    let unsubscribe = () => {};
                    return new Promise(function(fulfill) {
                        var previous = state.element[state.workspace.currentId];
                        unsubscribe = store.observe(elementSelectors.getElements, (newElements) => {
                            let result = check(elements);
                            if (result) {
                                fulfill(result);
                            }
                        })
                    }).tap(unsubscribe);
                }
            }
            const getOntology = () => Promise.require('data/web-worker/services/ontology').then(o => o.ontology());

            return Promise.all([
                getExtendedData().then(getElements),
                (property.title === 'ALL_DATES' ? getOntology() : Promise.resolve())
            ])
                    .spread(function({ vertices, edges }, ontology) {
                        var ontologyConcepts = ontology && ontology.concepts,
                            ontologyRelationships = ontology && ontology.relationships,
                            ontologyProperties = ontology && ontology.properties,
                            foundOntologyProperties = [],
                            foundYPropertiesByConcept = {},
                            values = _.chain(vertices.concat(edges))
                                .compact()
                                .map(function(v) {
                                    var isEdge = ('label' in v && 'inVertexId' in v && 'outVertexId' in v),
                                        conceptProperty = !isEdge && _.findWhere(v.properties, { name: ONTOLOGY_CONSTANTS.PROP_CONCEPT_TYPE}),
                                        conceptPropertyIri = isEdge ? v.label : (
                                            conceptProperty && conceptProperty.value || ONTOLOGY_CONSTANTS.THING_CONCEPT
                                        ),
                                        properties = ontologyProperties ?
                                            _.filter(v.properties, function(p) {
                                                var ontologyProperty = ontologyProperties.byTitle[p.name],
                                                    matched = ontologyProperty && ontologyProperty.dataType === property.dataType && ontologyProperty.userVisible !== false;

                                                if (matched) {
                                                    var found = _.find(foundOntologyProperties, function(f) {
                                                        return f.property.title === ontologyProperty.title;
                                                    });
                                                    if (found) {
                                                        if (conceptPropertyIri &&
                                                            found.concepts.indexOf(conceptPropertyIri) === -1) {
                                                            found.concepts.push(conceptPropertyIri);
                                                        }
                                                    } else {
                                                        foundOntologyProperties.push({
                                                            property: ontologyProperty,
                                                            concepts: conceptPropertyIri ? [conceptPropertyIri] : []
                                                        });
                                                    }
                                                }

                                                return matched;
                                            }) :
                                            _.where(v.properties, { name: property.title }),
                                        ontologyByType = isEdge ?
                                            ontologyRelationships && ontologyRelationships.byTitle :
                                            ontologyConcepts && ontologyConcepts.byId,
                                        parentTypeField = isEdge ? 'parentIri' : 'parentConcept',
                                        concept = ontologyByType[conceptPropertyIri],
                                        eligibleYTypes = 'double integer currency number'.split(' '),
                                        foundYProperties = conceptPropertyIri && foundYPropertiesByConcept[conceptPropertyIri];

                                    if (conceptPropertyIri && !foundYProperties) {
                                        foundYProperties = [];
                                        while (concept) {
                                            for (var i = 0; i < concept.properties.length; i++) {
                                                var p = ontologyProperties.byTitle[concept.properties[i]];
                                                if (p && p.userVisible !== false && ~eligibleYTypes.indexOf(p.dataType)) {
                                                    foundYProperties.push(p);
                                                }
                                            }
                                            concept = concept.parentConcept && ontologyByType[concept[parentTypeField]];
                                        }

                                        v.properties.forEach(function(prop) {
                                            if (!_.findWhere(foundYProperties, { title: prop.name })) {
                                                var p = ontologyProperties.byTitle[prop.name];
                                                if (p && p.userVisible !== false && ~eligibleYTypes.indexOf(p.dataType)) {
                                                    foundYProperties.push(p);
                                                }
                                            }
                                        });

                                        foundYPropertiesByConcept[conceptPropertyIri] = foundYProperties;
                                    }

                                    var yValues = {};
                                    if (foundYProperties && foundYProperties.length) {
                                        _.each(v.properties, function(p) {
                                            _.each(foundYProperties, function(prop) {
                                                if (p.name === prop.title) {
                                                    if (!yValues[p.name]) yValues[p.name] = [];
                                                    yValues[p.name].push(p.value);
                                                }
                                            })
                                        })
                                    }

                                    return _.map(properties, function(p) {
                                        var ontologyProperty = ontologyProperties && ontologyProperties.byTitle[p.name],
                                            base = {
                                                conceptIri: conceptPropertyIri,
                                                propertyIri: ontologyProperty && ontologyProperty.title,
                                                value: p.value,
                                                yValues: yValues
                                            };

                                        base[isEdge ? 'edgeId' : 'vertexId'] = v.id;
                                        return base;
                                    })
                                })
                                .flatten(true)
                                .compact()
                                .sortBy('value')
                                .value();

                        _.each(values, function(v) {
                            var isDateOnlyProperty = _.some(ontologyProperties.byDataType.date, {
                                    title: v.propertyIri,
                                    displayType: 'dateOnly'
                                });

                            if (isDateOnlyProperty) {
                               v.value += (new Date(v.value).getTimezoneOffset() * 60000);
                            }
                        });

                        return { values: values, foundOntologyProperties: foundOntologyProperties };
                    })
        },

        save: queue(function(workspaceId, changes) {
            if (arguments.length === 1) {
                changes = workspaceId;
                workspaceId = publicData.currentWorkspaceId;
            }

            var allChanges = _.extend({}, {
                userUpdates: [],
                userDeletes: []
            }, changes || {});

            return ajax('POST', '/workspace/update', {
                workspaceId: workspaceId,
                data: JSON.stringify(allChanges)
            }).then(function(workspace) {
                getStore().dispatch(workspaceActions.update({ workspace }))
                return { saved: true, workspace };
            });
        }),

        publish: function(changes) {
            return ajax('POST', '/workspace/publish', {
                publishData: JSON.stringify(changes)
            });
        },

        undo: function(changes) {
            return ajax('POST', '/workspace/undo', {
                undoData: JSON.stringify(changes)
            });
        },

        create: function(options) {
            return ajax('POST', '/workspace/create', options)
                .tap(workspace => {
                    getStore().dispatch(workspaceActions.update({ workspace }))
                })
        }
    };

    return api;
})
