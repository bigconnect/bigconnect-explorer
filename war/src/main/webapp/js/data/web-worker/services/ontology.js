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
 * Get the current ontology. Includes:
 *
 * * Concepts: Vertex types
 * * Properties: Properties for elements
 * * Relationships: Edges
 *
 * @module services/ontology
 * @see module:dataRequest
 */
define([
    '../util/ajax',
    '../store',
    'configuration/plugins/registry'
], function(ajax, store, registry) {
    'use strict';

    /**
     * @undocumented
     */
    registry.documentExtensionPoint('org.bigconnect.ontology',
        'Ignore some ontology warnings',
        function(e) {
            return _.isArray(e.ignoreColorWarnings);
        }
    );

    var PARENT_CONCEPT = ONTOLOGY_CONSTANTS.THING_CONCEPT,
        ROOT_CONCEPT = ONTOLOGY_CONSTANTS.ROOT_CONCEPT;

    var ontologyReady = function(s) {
        return s &&
            s.ontology &&
            publicData.currentWorkspaceId &&
            s.ontology[publicData.currentWorkspaceId] &&
            !_.isEmpty(s.ontology[publicData.currentWorkspaceId].concepts) &&
            !_.isEmpty(s.ontology[publicData.currentWorkspaceId].properties) &&
            !_.isEmpty(s.ontology[publicData.currentWorkspaceId].relationships);
    };

    var warnOnce = _.memoize(function() {
        console.warn.apply(console, arguments);
    }, function() {
        return arguments.length === 2 ? arguments[1] : arguments[0];
    });

    var subscribeToClear = _.once(function() {
        var _store = store.getStore();
        var selectOntology = function(state) {
            return state.workspace.currentId && state.ontology && state.ontology[state.workspace.currentId];
        };

        _store.observe(selectOntology, function(current, previous) {
            if (previous && current) {
                _.defer(api.clearMemoizedValues);
            }
        });
    });

    var getOntology = function() {
        return store.getOrWaitForNestedState(function(s) {
            subscribeToClear();
            return JSON.parse(JSON.stringify(s.ontology[publicData.currentWorkspaceId]));
        }, ontologyReady)
    };

    var extensions = registry.extensionsForPoint('org.bigconnect.ontology');

    /**
     * @alias module:services/ontology
     */
    var api = {

        clearMemoizedValues: function() {
            Object.keys(api).forEach(function(key) {
                var obj = api[key];
                if (_.isFunction(obj) && 'cache' in obj) {
                    obj.cache = {};
                }
            });
            dispatchMain('dataRequestFastPassClear', {
                paths: [
                    'ontology/ontology',
                    'ontology/properties',
                    'ontology/relationships'
                ]
            });
        },

        /**
             * All ontology objects: concepts, properties, relationships
             *
             * The result is cached so only first call makes a request to server.
             *
             * @function
             */
            ontology: _.memoize(function() {
                return Promise.all([
                    api.concepts(),
                    api.properties(),
                    api.relationships()
                ]).then(function(results) {
                    var concepts = results.shift(),
                        properties = results.shift(),
                        relationships = results.shift();

                    return {
                        concepts: concepts,
                        properties: properties,
                        relationships: relationships
                    };
                })
            }),

            /**
             * Ontology properties
             *
             * @function
             */
            properties: _.memoize(function() {
                return getOntology()
                    .then(function(ontology) {
                        return {
                            list: _.sortBy(_.values(ontology.properties), 'displayName'),
                            byTitle: ontology.properties,
                            byDataType: _.groupBy(ontology.properties, 'dataType'),
                            byDependentToCompound: _.chain(ontology.properties)
                                .filter(function(p) {
                                    return 'dependentPropertyIris' in p;
                                })
                                .map(function(p) {
                                    return p.dependentPropertyIris.map(function(iri) {
                                        return [iri, p.title];
                                    })
                                })
                                .flatten(true)
                                .object()
                                .value()
                        };
                    });
            }),

            /**
             * Return properties by element type
             *
             * @function
             * @param {string} type Either 'vertex' or 'edge'
             * @returns {Array.<object>}
             */
            propertiesByDomainType: _.memoize(function(type) {
                return getOntology()
                    .then(function(ontology) {
                        if (type === 'extended-data') {
                            return _.chain(ontology.properties)
                                .pluck('tablePropertyIris')
                                .compact()
                                .flatten()
                                .uniq()
                                .map(function(propertyName) {
                                    if (!ontology.properties[propertyName]) {
                                        console.error('could not find extended-data property: ' + propertyName);
                                        return null;
                                    }
                                    return ontology.properties[propertyName];
                                })
                                .compact()
                                .value();
                        }

                        var items = (type === 'concept' || type === 'vertex') ? ontology.concepts : ontology.relationships;

                        return _.chain(items)
                            .pluck('properties')
                            .compact()
                            .flatten()
                            .uniq()
                            .map(function(propertyName) {
                                return ontology.properties[propertyName]
                            })
                            .value();
                    });
            }),

            /**
             * Properties given edgeId
             *
             * @function
             * @param {string} id
             */
            propertiesByRelationship: _.memoize(function(relationshipId) {
                return api.ontology()
                    .then(function(ontology) {
                        var propertyIds = [],
                            collectPropertyIds = function(rId) {
                                var relation = ontology.relationships.byId[rId],
                                properties = relation && relation.properties,
                                parentId = relation && relation.parentIri;

                                if (properties && properties.length) {
                                    propertyIds.push.apply(propertyIds, properties);
                                }
                                if (parentId) {
                                    collectPropertyIds(parentId);
                                }
                            };

                        collectPropertyIds(relationshipId);

                        var properties = _.chain(propertyIds)
                            .uniq()
                            .map(function(pId) {
                                return ontology.properties.byTitle[pId];
                            })
                            .value();

                        return {
                            list: _.sortBy(properties, 'displayName'),
                            byTitle: _.pick(ontology.properties, propertyIds)
                        };
                    });
            }),

            /**
             * Properties given conceptId
             *
             * @function
             * @param {string} id
             */
            propertiesByConceptId: _.memoize(function(conceptId) {
                return getOntology()
                    .then(function(ontology) {
                        var propertyIds = [],
                            collectPropertyIds = function(conceptId) {
                                var concept = ontology.concepts[conceptId],
                                properties = concept && concept.properties,
                                parentConceptId = concept && concept.parentConcept;

                                if (properties && properties.length) {
                                    propertyIds.push.apply(propertyIds, properties);
                                }
                                if (parentConceptId) {
                                    collectPropertyIds(parentConceptId);
                                }
                            };

                        collectPropertyIds(conceptId);

                        var properties = _.chain(propertyIds)
                            .uniq()
                            .map(function(pId) {
                                return ontology.properties[pId];
                            })
                            .value();

                        return {
                            list: _.sortBy(properties, 'displayName'),
                            byTitle: _.pick(ontology.properties, propertyIds)
                        };
                    });
            }),

            /**
             * Ontology concepts
             *
             * @function
             */
            concepts: _.memoize(function() {
                var clsIndex = 0;

                return getOntology()
                    .then(function(ontology) {
                        return {
                            entityConcept: buildTree(
                                ontology.concepts,
                                ontology.concepts[PARENT_CONCEPT]
                            ),
                            forAdmin: _.chain(ontology.concepts)
                                .filter(onlyEntityConcepts.bind(null, ontology.concepts, true))
                                .map(addFlattenedTitles.bind(null, ontology.concepts, true))
                                .sortBy('flattenedDisplayName')
                                .value(),
                            byId: _.chain(ontology.concepts)
                                .map(addFlattenedTitles.bind(null, ontology.concepts, false))
                                .indexBy('id')
                                .value(),
                            byClassName: _.indexBy(ontology.concepts, 'className'),
                            byTitle: _.chain(ontology.concepts)
                                .filter(onlyEntityConcepts.bind(null, ontology.concepts, false))
                                .map(addFlattenedTitles.bind(null, ontology.concepts, false))
                                .sortBy('flattenedDisplayName')
                                .value()
                        };
                    });

                function buildTree(concepts, root) {
                    var groupedByParent = _.groupBy(concepts, 'parentConcept'),
                        ignoreColorWarnings = _.chain(extensions)
                            .pluck('ignoreColorWarnings')
                            .flatten()
                            .unique()
                            .value(),
                        findChildrenForNode = function(node) {
                            node.className = 'conceptId-' + (clsIndex++);
                            node.children = groupedByParent[node.id] || [];
                            node.children = node.children.map(function(child) {
                                if (!child.glyphIconHref) {
                                    child.glyphIconHref = node.glyphIconHref;
                                }
                                if (!child.glyphIconSelectedHref) {
                                    child.glyphIconSelectedHref = node.glyphIconSelectedHref;
                                }
                                if (child.userVisible !== false && child.id === child.displayName) {
                                    warnOnce('Concept displayName is same as IRI', child.id)
                                }
                                if (!child.color) {
                                    if (node.color) {
                                        child.color = node.color;
                                    } else {
                                        child.color = 'rgb(0, 0, 0)';
                                    }
                                }
                                return findChildrenForNode(child);
                            });
                            return node;
                        };

                    return findChildrenForNode(root);
                }

                function onlyEntityConcepts(conceptsById, includeThing, concept) {
                    var parentConceptId = concept.parentConcept,
                        currentParentConcept = null;

                    while (parentConceptId) {
                        currentParentConcept = conceptsById[parentConceptId];
                        if (!currentParentConcept) {
                            console.error('Could not trace concept\'s lineage to ' + PARENT_CONCEPT +
                                ' could not find ' + parentConceptId, concept);
                            return false;
                        }
                        if (currentParentConcept.id === PARENT_CONCEPT) {
                            return true;
                        }
                        parentConceptId = currentParentConcept.parentConcept;
                    }

                    return includeThing && concept.id === PARENT_CONCEPT;
                }

                function addFlattenedTitles(conceptsById, includeThing, concept) {
                    var parentConceptId = concept.parentConcept,
                        currentParentConcept = null,
                        parents = [];

                    while (parentConceptId) {
                        currentParentConcept = conceptsById[parentConceptId];
                        if (includeThing) {
                            if (currentParentConcept.id === ROOT_CONCEPT) break;
                        } else {
                            if (currentParentConcept.id === PARENT_CONCEPT) break;
                        }
                        parents.push(currentParentConcept);
                        parentConceptId = currentParentConcept.parentConcept;
                    }

                    parents.reverse();
                    var leadingSlashIfNeeded = parents.length ? '/' : '',
                        flattenedDisplayName = _.pluck(parents, 'displayName')
                            .join('/') + leadingSlashIfNeeded + concept.displayName,
                        indent = flattenedDisplayName
                            .replace(/[^\/]/g, '')
                            .replace(/\//g, '&nbsp;&nbsp;&nbsp;&nbsp;');

                    return _.extend({}, concept, {
                        flattenedDisplayName: flattenedDisplayName,
                        ancestors: _.pluck(parents, 'id'),
                        indent: indent
                    });
                }
            }),

            /**
             * Ontology relationships
             *
             * @function
             */
            relationships: _.memoize(function() {
                return Promise.all([api.concepts(), getOntology()])
                    .then(function(results) {
                        var concepts = results.shift(),
                            ontology = results.shift(),
                            conceptIriIsVisible = function(iri) {
                                var concept = concepts.byId[iri];
                                return concept && concept.userVisible !== false;
                            },
                            list = _.chain(ontology.relationships)
                                .filter(function(r) {
                                    return _.some(r.domainConceptIris, conceptIriIsVisible) &&
                                        _.some(r.rangeConceptIris, conceptIriIsVisible)
                                })
                                .sortBy('displayName')
                                .value(),
                            out = { groupedByRelated: {} };

                         return {
                            list: list,
                            byId: ontology.relationships,
                            byTitle: ontology.relationships,
                            groupedBySourceDestConcepts: conceptGrouping(concepts, list, out),
                            groupedByRelatedConcept: out.groupedByRelated
                        };
                    });

                // Calculates cache with all possible mappings from source->dest
                // including all possible combinations of source->children and
                // dest->children
                function conceptGrouping(concepts, relationships, out) {
                    var groupedByRelated = out.groupedByRelated;
                    var groups = {},
                        addToAllSourceDestChildrenGroups = function(r, source, dest) {
                            var key = genSourceDestKey(source, dest);

                            if (!groups[key]) {
                                groups[key] = [];
                            }
                            if (!groupedByRelated[source]) {
                                groupedByRelated[source] = {};
                            }
                            if (!groupedByRelated[dest]) {
                                groupedByRelated[dest] = {};
                            }

                            groups[key].push(r);
                            groupedByRelated[source][dest] = true;
                            groupedByRelated[dest][source] = true;

                            var destConcept = concepts.byId[dest]
                            if (destConcept && destConcept.children) {
                                destConcept.children.forEach(function(c) {
                                    addToAllSourceDestChildrenGroups(r, source, c.id);
                                })
                            }

                            var sourceConcept = concepts.byId[source]
                            if (sourceConcept && sourceConcept.children) {
                                sourceConcept.children.forEach(function(c) {
                                    addToAllSourceDestChildrenGroups(r, c.id, dest);
                                });
                            }
                        };

                    relationships.forEach(function(r) {
                        r.domainConceptIris.forEach(function(source) {
                            r.rangeConceptIris.forEach(function(dest) {
                                addToAllSourceDestChildrenGroups(r, source, dest);
                            });
                        });
                        
                    });

                   out.groupedByRelated = _.mapObject(groupedByRelated, function(obj, key) {
                        return _.keys(obj);
                    });

                    return groups;
                }
            }),

            /**
             * Get the valid relationships between concepts
             *
             * @function
             * @param {string} source Source concept IRI
             * @param {string} target Target concept IRI
             */
            relationshipsBetween: _.memoize(function(source, dest) {
                return api.relationships()
                    .then(function(relationships) {
                        var key = genSourceDestKey(source, dest);

                        return _.chain(relationships.groupedBySourceDestConcepts[key] || [])
                            .uniq(function(r) {
                                return r.title
                            })
                            .sortBy('displayName')
                            .value()
                    });
            }, genSourceDestKey),

            clearCache: function() {
                api.clearMemoizedValues();
                return api.ontology().then(function(ontology) {
                    return ontology;
                })
            }
        };

    return api;

    function genSourceDestKey(source, dest) {
        return [source, dest].join('>');
    }
});
