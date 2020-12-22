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
    'data/web-worker/store/actions',
    'data/web-worker/store/product/actions-impl',
    'data/web-worker/store/product/selectors',
    'data/web-worker/store/element/selectors',
    'data/web-worker/store/element/actions-impl',
    'data/web-worker/store/selection/actions-impl',
    'data/web-worker/util/ajax'
], function(
        actions,
        productActions,
        productSelectors,
        elementSelectors,
        elementActions,
        selectionActions,
        ajax) {

    actions.protectFromMain();

    const api = {
        dropElements: ({ productId, elements, undoable }) => (dispatch, getState) => {
            const state = getState();
            const workspaceId = state.workspace.currentId;
            const { vertexIds, edgeIds } = elements;
            const fetchEdgeIds = [];
            const edgeVertexIds = [];

            if (edgeIds && edgeIds.length) {
                edgeIds.forEach(edgeId => {
                    const edge = state.element[workspaceId].edges[edgeId];
                    if (edge) {
                        edgeVertexIds.push(edge.inVertexId, edge.outVertexId);
                    } else {
                        fetchEdgeIds.push(edgeId);
                    }
                });
            }

            var edges = fetchEdgeIds.length ? (
                ajax('POST', '/edge/multiple', { edgeIds: fetchEdgeIds })
                    .then(({ edges }) => {
                        return _.flatten(edges.map(e => [e.inVertexId, e.outVertexId])).concat(edgeVertexIds);
                    })
                ) : Promise.resolve([]);

            edges.then((result) => {
                const product = productSelectors.getProductsById(getState())[productId];
                const existing = product.extendedData ? Object.keys(product.extendedData.vertices) : [];
                const combined = _.without(_.uniq(result.concat(edgeVertexIds, vertexIds)), ..._.pluck(existing, 'id'));

                if (!combined.length) return;

                let undoPayload = {};
                if (undoable) {
                    undoPayload = {
                        undoScope: productId,
                        undo: {
                            productId,
                            elements: { vertexIds: combined }
                        },
                        redo: {
                            productId,
                            elements
                        }
                    };
                }

                dispatch({
                    type: 'PRODUCT_MAP_ADD_ELEMENTS',
                    payload: {
                        workspaceId,
                        productId,
                        vertexIds: combined,
                        ...undoPayload
                    }
                });

                ajax('POST', '/product/map/vertices/update', {
                    productId,
                    updates: _.object(combined.map(id => [id, {}]))
                }).then(() => {
                    dispatch(elementActions.get({ workspaceId, vertexIds: combined }));
                })
                dispatch(productActions.select({ productId }));
            })
        },

        redoDropElements: ({ productId, elements: productElements }) => (dispatch, getState) => {
            const state = getState();
            const elements = elementSelectors.getElements(state);
            let validElements;
            const authorizedElements = _.mapObject(productElements, (eles, type) => (
                _.pick(eles[type], (productEle, id) => {
                    if (elements[type][id]) {
                        validElements = true;
                        return true;
                    } else {
                        return false;
                    }
                })
            ));

            if (validElements) {
                return api.dropElements({ productId, authorizedElements })
            }

        },

        setElementData: ({ productId, elements, undoable }) => (dispatch, getState) => {
            const state = getState();
            const workspaceId = state.workspace.currentId;
            const product = productSelectors.getProductsById(state)[productId];
            const existing = product.extendedData ? Object.keys(product.extendedData.vertices) : [];
            const combined = _.without(elements.vertexIds, ..._.pluck(existing, 'id'));

            let undoPayload = {};
            if (undoable) {
                undoPayload = {
                    undoScope: productId,
                    undo: {
                        productId,
                        elements: { vertexIds: combined }
                    },
                    redo: {
                        productId,
                        elements
                    }
                };
            }

            dispatch({
                type: 'PRODUCT_MAP_ADD_ELEMENTS',
                payload: {
                    workspaceId,
                    productId,
                    elements,
                    ...undoPayload
                }
            });
        },

        removeElements: ({ productId, elements, undoable }) => (dispatch, getState) => {
            const state = getState();
            const workspaceId = state.workspace.currentId;
            const workspace = state.workspace.byId[workspaceId];
            if (workspace.editable && elements && elements.vertexIds && elements.vertexIds.length) {
                let undoPayload = {};
                if (undoable) {
                    undoPayload = {
                        undoScope: productId,
                        undo: {
                            productId,
                            elements
                        },
                        redo: {
                            productId,
                            elements
                        }
                    };
                }

                dispatch({
                    type: 'PRODUCT_MAP_REMOVE_ELEMENTS',
                    payload: {
                        elements,
                        productId,
                        workspaceId,
                        ...undoPayload
                    }
                });
                dispatch(selectionActions.remove({
                    selection: { vertices: elements.vertexIds }
                }));

                if (elements.vertexIds.length) {
                    ajax('POST', '/product/map/vertices/remove', { productId, vertexIds: elements.vertexIds })
                }
            }
        },

        setLayerOrder: ({ productId, layerOrder }) => (dispatch, getState) => {
            const state = getState();
            const workspaceId = state.workspace.currentId;
            const workspace = state.workspace.byId[workspaceId];
            const product = state.product.workspaces[workspaceId].products[productId];

            const layerExtendedData = product.extendedData && product.extendedData['org-bigconnect-map-layers'];


            if (workspace.editable) {
                dispatch(productActions.updateExtendedData({
                    key: 'org-bigconnect-map-layers',
                    value: { ...layerExtendedData, layerOrder },
                    productId
                }));
            }
        }
    };

    return api;
})

