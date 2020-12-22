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
    '../actions',
    '../../util/ajax',
    '../element/actions-impl',
    '../element/selectors',
    '../workspace/actions-impl',
    '../selection/actions-impl',
    './selectors',
    'configuration/plugins/registry'
], function(actions, ajax, elementActions, elementSelectors, workspaceActions, selectionActions, selectors, registry) {
    actions.protectFromMain();

    const api = {
        get: ({productId, invalidate = false, includeExtended = true }) => (dispatch, getState) => {
            const state = getState();
            const workspaceId = state.workspace.currentId;
            const { products } = state.product.workspaces[workspaceId];
            const product = products[productId];
            let request;

            const options = { productId, includeExtended };
            if (includeExtended) {
                options.params = {
                    includeVertices: true,
                    includeEdges: true
                }
            }

            if (!invalidate && product) {
                if (!product.extendedData && includeExtended) {
                    request = ajax('GET', '/product', options);
                }
            } else if (invalidate || !product) {
                request = ajax('GET', '/product', options);
            }

            if (request) {
                request.then(function(product) {
                    dispatch(api.update(product));

                    if (includeExtended) {
                        const { vertices, edges } = product.extendedData;
                        const vertexIds = Object.keys(vertices);
                        const edgeIds = Object.keys(edges);
                        const includeAncillary = _.any(vertices, ({ancillary}) => ancillary === true)

                        dispatch(elementActions.get({ workspaceId, vertexIds, edgeIds, includeAncillary }));
                    }
                })
            }
        },

        updateNeedsLayout: ({productId, needsLayout}) => (dispatch, getState) => {
            const state = getState();
            const workspaceId = state.workspace.currentId;

            dispatch({
                type: 'PRODUCT_NEEDS_LAYOUT',
                payload: { workspaceId, productId, needsLayout }
            })
        },

        previewChanged: ({ productId, workspaceId, md5 }) => (dispatch, getState) => dispatch({
            type: 'PRODUCT_PREVIEW_UPDATE',
            payload: { productId, md5, workspaceId }
        }),

        changedOnServer: ({ productId, workspaceId }) => (dispatch, getState) => {
            const state = getState();

            if (state.product.workspaces[workspaceId]) {
                dispatch(api.get({
                        productId,
                        invalidate: true,
                        includeExtended: selectors.getSelectedId(state) === productId
                    }));
            }
        },

        setInteracting: ({ interactingIds }) => ({
            type: 'PRODUCT_SET_INTERACTING',
            payload: { interactingIds }
        }),

        update: (product) => ({
            type: 'PRODUCT_UPDATE',
            payload: {
                product
            }
        }),

        updatePreview: ({ productId, dataUrl }) => (dispatch, getState) => {
            const state = getState();
            const workspaceId = state.workspace.currentId;
            ajax('POST', '/product', { productId, preview: dataUrl })
                .then(product => {
                    const { previewMD5: md5 } = product;
                    dispatch(api.previewChanged({ productId, workspaceId, md5 }));
                })
        },

        updateLocalData: ({productId, key, value}) => (dispatch, getState) => {
            const state = getState();
            const workspaceId = state.workspace.currentId;

            dispatch({
                type: 'PRODUCT_UPDATE_LOCAL_DATA',
                payload: {
                    workspaceId, productId, key, value
                }
            });
        },

        updateExtendedData: ({ productId, key, value, undoable }) => (dispatch, getState) => {
            const state = getState();
            const workspaceId = state.workspace.currentId;
            const params = {
                extendedData: {}
            };
            params.extendedData[key] = value;
            const oldValue = state.product.workspaces[workspaceId].products[productId].extendedData[key];

            dispatch({
                type: 'PRODUCT_UPDATE_EXTENDED_DATA',
                payload: {
                    workspaceId,
                    productId,
                    key,
                    value
                }
            });

            ajax('POST', '/product', {productId, params})
                .catch((e) => {
                    dispatch({
                        type: 'PRODUCT_UPDATE_EXTENDED_DATA',
                        payload: {
                            workspaceId,
                            productId,
                            key,
                            oldValue
                        }
                    });
                });
        },

        updateViewport: ({ productId, pan, zoom }) => (dispatch, getState) => dispatch({
            type: 'PRODUCT_UPDATE_VIEWPORT',
            payload: {
                productId,
                viewport: { pan, zoom },
                workspaceId: getState().workspace.currentId
            }
        }),

        selectAll: ({ productId }) => (dispatch, getState) => {
            const state = getState(),
                workspaceId = state.workspace.currentId,
                product = state.product.workspaces[workspaceId].products[productId];

            const vertices = Object.keys(product.extendedData.vertices).filter(id => {
                return !product.extendedData.vertices[id].ancillary
            });

            dispatch(selectionActions.set({
                selection: {
                    vertices,
                    edges: Object.keys(product.extendedData.edges)
                }
            }));
        },

        list: (initial) => function handler(dispatch, getState) {
            const { productId: initialProductId, workspaceId: initialWorkspaceId } = initial;

            let workspaceId = getState().workspace.currentId;

            if (!workspaceId) {
                _.delay(handler, 250, dispatch, getState);
                return
            }

            Promise.try(() => {
                if (initialWorkspaceId && initialWorkspaceId !== workspaceId) {
                    return dispatch(workspaceActions.setCurrent({ workspaceId: initialWorkspaceId }))
                }
            }).then(() => {
                const state = getState();
                const workspaceId = state.workspace.currentId;
                const workspaceProduct = state.product.workspaces[workspaceId];
                if (!workspaceProduct || (!workspaceProduct.loaded && !workspaceProduct.loading)) {
                    dispatch({ type: 'PRODUCT_LIST', payload: { loading: true, loaded: false, workspaceId } });
                    ajax('GET', '/product/all', {
                        workspaceId
                    }).then(({types, products}) => {
                        dispatch({type: 'PRODUCT_UPDATE_TYPES', payload: { types }});
                        dispatch({type: 'PRODUCT_LIST', payload: { workspaceId, loading: false, loaded: true, products }});
                        if (initialProductId) {
                            dispatch(api.select({ productId: initialProductId }))
                        }
                    })
                }
            })
        },

        create: ({title, kind}) => (dispatch, getState) => {
            const products = selectors.getProducts(getState());

            ajax('POST', '/product', { title, kind })
                .then(product => {
                    dispatch(api.update(product));
                    dispatch(api.select({ productId: product.id }))
                })
        },

        delete: ({ productId }) => (dispatch) => {
            return ajax('DELETE', '/product', { productId })
                .then(() => dispatch(api.remove(productId)));
        },

        updateTitle: ({ productId, title }) => (dispatch, getState) => {
            const state = getState();
            const workspaceId = state.workspace.currentId;
            const product = state.product.workspaces[workspaceId].products[productId];
            const { kind } = product;

            dispatch({
                type: 'PRODUCT_UPDATE_TITLE',
                payload: { productId, loading: true, workspaceId }
            });
            ajax('POST', '/product', { title, kind, productId })
                .then(result => {
                    dispatch({
                        type: 'PRODUCT_UPDATE_TITLE',
                        payload: { loading: false, productId, workspaceId, title }
                    })
                });
        },

        updateExporting: ({ productId, exporting }) => (dispatch, getState) => {
            const state = getState();
            const workspaceId = state.workspace.currentId;
            dispatch({
                type: 'PRODUCT_EXPORT',
                payload: { productId, exporting: exporting, workspaceId }
            });
        },

        remove: (productId) => (dispatch, getState) => {
            const state = getState();
            const workspaceId = state.workspace.currentId;
            const { products, selected } = state.product.workspaces[workspaceId];
            const product = products[productId];
            if (product) {
                dispatch({
                    type: 'PRODUCT_REMOVE',
                    payload: { productId, workspaceId }
                });
                if (productId === selected) {
                    dispatch(api.select({ productId }));
                }
            }
        },

        select: ({ productId }) => (dispatch, getState) => {
            const state = getState();
            const workspaceId = state.workspace.currentId;

            if (!productId) {
                const nextProduct = _.first(selectors.getProducts(state));
                if (nextProduct) {
                    productId = nextProduct.id;
                }
            }

            dispatch({
                type: 'PRODUCT_SELECT',
                payload: { workspaceId, productId }
            });
            pushSocketMessage({ type: 'setActiveProduct', data: { workspaceId, productId } });
        }

    };

    return api;
});
