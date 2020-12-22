
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
    '../store',
    '../util/ajax',
    '../store/element/actions-impl'
], function(store, ajax, elementActions) {
    'use strict';

    function propertyUrl(elementType, property) {
        return '/' + elementType + '/' +
            (property.name === ONTOLOGY_CONSTANTS.PROP_COMMENT_ENTRY ? 'comment' : 'property');
    }

    function indexElementProperties(element) {
        if (element) {
            element.propertiesByName = element.properties ? _.groupBy(element.properties, 'name') : {};
        }
    }

    registerStoreListenerAndFireVerticesUpdated();

    return {
        updateElement(workspaceId, element) {
            if (arguments.length === 1) {
                element = workspaceId;
                workspaceId = store.getStore().getState().workspace.currentId;
            }
            store.getStore().dispatch(
                elementActions.updateElement(workspaceId, element)
            );
        },

        putSearchResults(elements) {
            if (!_.isEmpty(elements)) {
                store.getStore().dispatch(elementActions.putSearchResults(elements))
            }
        },

        indexSearchResultsProperties(results) {
            const { elements = [], referencedElements = [] } = results;
            if (elements) {
                elements.forEach(indexElementProperties)
            }
            if (referencedElements) {
                referencedElements.forEach(indexElementProperties)
            }
            return results;
        },

        indexElementProperties,

        createStoreAccessorOrDownloader: (type) => (options) => {
            const key = type + 'Ids';
            const resultKey = type === 'vertex' ? 'vertices' : 'edges';
            const state = store.getStore().getState();
            const workspaceId = state.workspace.currentId;
            const elements = state.element[workspaceId];
            const returnSingular = !_.isArray(options[key]);
            const elementIds = returnSingular ? [options[key]] : options[key];

            var toRequest = elementIds;
            if (elements) {
                toRequest = _.reject(toRequest, id => id in elements[resultKey]);
            }

            return (
                toRequest.length ?
                ajax('POST', `/${type}/multiple`, { [key]: toRequest }) :
                Promise.resolve({[resultKey]:[]})
            ).then(function(result) {
                const results = result[resultKey];

                if (results.length) {
                    store.getStore().dispatch(elementActions.update({ [resultKey]: results, workspaceId }));
                }

                if (elements) {
                    const existing = _.pick(elements[resultKey], elementIds)
                    return Object.values(existing).concat(results)
                }
                return results;
            }).then(function(ret) {
                return returnSingular && ret.length ? ret[0] : ret;
            })
        },

        vertexPropertyUrl: function(property) {
            return propertyUrl('vertex', property);
        },

        edgePropertyUrl: function(property) {
            return propertyUrl('edge', property);
        }
    };

    function registerStoreListenerAndFireVerticesUpdated() {
        const redux = store.getStore();
        var previousElements, previousElementsWorkspaceId;
        redux.subscribe(function() {
            const state = redux.getState();
            const workspaceId = state.workspace.currentId;
            const newElements = state.element[workspaceId];
            const workspaceChanged = workspaceId !== previousElementsWorkspaceId;

            if (previousElements && !workspaceChanged && newElements !== previousElements) {
                ['vertices', 'edges'].forEach(function(type) {
                    const updated = [];
                    const deleted = [];
                    _.each(newElements[type], (el, id) => {
                        if (id in previousElements[type] && el !== previousElements[type][id]) {
                            if (el === null) {
                                deleted.push(id);
                            } else {
                                updated.push(el);
                            }
                        } else if (!(id in previousElements[type]) && el != null) {
                            updated.push(el);
                        }
                    })

                    if (updated.length) {
                        dispatchMain('rebroadcastEvent', {
                            eventName: `${type}Updated`,
                            data: {
                                [type]: updated
                            }
                        })
                    }
                    if (deleted.length) {
                        let fire = (data) => {
                            dispatchMain('rebroadcastEvent', { eventName: `${type}Deleted`, data })
                        }
                        if (type === 'vertices') {
                            fire({ vertexIds: deleted });
                        } else {
                            deleted.forEach(id => fire({ edgeId: id }));
                        }
                    }
                })
            }
            previousElements = newElements;
            previousElementsWorkspaceId = workspaceId;
        });
    }
});
