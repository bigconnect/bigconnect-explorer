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
define(['reselect', '../element/selectors'], function(reselect, elementSelectors) {
    const { createSelector } = reselect;

    const getWorkspaceId = (state) => state.workspace.currentId;

    const getSelection = (state) => state.selection.idsByType;

    const getFocused = (state) => state.element.focusing;

    const getProductWorkspaces = (state) => state.product.workspaces;

    const getProductTypes = (state) => state.product.types || [];

    const getInteracting = (state) => state.product.interacting;

    const getProductState = createSelector([getWorkspaceId, getProductWorkspaces], (workspaceId, productWorkspaces) => {
        return productWorkspaces[workspaceId];
    })

    const getPreviewHashesById = createSelector([getProductState], (productState) => {
        return productState ? productState.previewHashes : {};
    })

    const getProductsById = createSelector([getProductState], (productState) => {
        return productState ? productState.products : {};
    })

    const getViewportsByProductId = createSelector([getProductState], (productState) => {
        return productState && productState.viewports || {};
    })

    const getNeedsLayout = createSelector([getProductState], (productState) => {
        return (productState && productState.needsLayout) || {};
    })

    const getProducts = createSelector([getProductsById], (productsById) => {
        return _.chain(productsById)
            .values()
            .sortBy('id')
            .sortBy('title')
            .sortBy('kind')
            .value()
    });

    const getSelectedId = createSelector([getProductState], (productState) => {
        return productState ? productState.selected : null
    });

    const getViewport = createSelector([getViewportsByProductId, getSelectedId], (viewports, productId) => {
        return productId ? viewports[productId] : null
    })

    const getProduct = createSelector([getProductsById, getSelectedId], (productsById, productId) => {
        return productId ? productsById[productId] : null;
    })

    const getPreviewHash = createSelector([getPreviewHashesById, getSelectedId], (previewHashes, productId) => {
        return productId ? previewHashes[productId] : null;
    })

    const getElementIdsInProduct = createSelector([getProduct], (product) => {
        if (product && product.extendedData) {
            const elementIds = { vertices: product.extendedData.vertices, edges: product.extendedData.edges };
            return _.mapObject(elementIds, (elements) => _.pick(elements, e => e.unauthorized !== true));
        } else {
            return { vertices: {}, edges: {} };
        }
    });

    const getElementsInProduct = createSelector([getElementIdsInProduct, elementSelectors.getElements], (elementIds, elements) => {
        const { vertices, edges } = elementIds;
        return {
            vertices: _.pick(elements.vertices, Object.keys(vertices)),
            edges: _.pick(elements.edges, Object.keys(edges))
        };
    })

    const getSelectedElementsInProduct = createSelector([getSelection, getElementIdsInProduct], (selection, elementIds) => {
        const { vertices, edges } = elementIds;
        return {
            vertices: _.indexBy(_.intersection(selection.vertices, Object.keys(vertices))),
            edges: _.indexBy(_.intersection(selection.edges, Object.keys(edges)))
        };
    });

    const getFocusedElementsInProduct = createSelector([getFocused, getElementIdsInProduct], (focusing, elementIds) => {
        const { vertices, edges } = elementIds;
        const focused = {
            vertices: {},
            edges: {},
            isFocusing: false
        };
        Object.keys(vertices).forEach(vertexId => {
            if (vertexId in focusing.vertexIds) {
                focused.vertices[vertexId] = true;
                focused.isFocusing = true;
            }
        });
        Object.keys(edges).forEach(edgeId => {
            if (edgeId in focusing.edgeIds) {
                focused.edges[edgeId] = true;
                focused.isFocusing = true;
            }
        })
        return focused;
    });

    const getStatus = createSelector([getProductState], (productState) => {
        return productState ? _.pick(productState, 'loading', 'loaded', 'exporting') : { loading: false, loaded: false, exporting: false }
    })

    return {
        getStatus,
        getSelectedId,
        getProduct,
        getViewport,
        getProducts,
        getPreviewHash,
        getProductsById,
        getPreviewHashesById,
        getProductTypes,
        getInteracting,
        getElementIdsInProduct,
        getElementsInProduct,
        getSelectedElementsInProduct,
        getFocusedElementsInProduct,
        getNeedsLayout
    };
})

