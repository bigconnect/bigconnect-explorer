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
    'configuration/plugins/registry',
    'updeep',
    'com/mware/web/product/graph/dist/actions-impl'
], function(registry, u, actions) {

    registry.registerExtension('org.bigconnect.store', {
        key: 'product',
        reducer: function(state, { type, payload }) {
            switch (type) {
                case 'PRODUCT_GRAPH_SET_POSITIONS': return updateOrAddElements(state, payload);
                case 'PRODUCT_GRAPH_REMOVE_ELEMENTS': return removeElements(state, payload);
                case 'PRODUCT_GRAPH_RENAME_COLLAPSED_NODE': return renameCollapsedNode(state, payload);
                case 'PRODUCT_ADD_EDGE_IDS': return addEdges(state, payload);

                case 'ELEMENT_UPDATE': return updateVisibleCollapsedNodes(state, payload);
            }

            return state;
        },
        undoActions: {
            PRODUCT_GRAPH_SET_POSITIONS: {
                undo: (undo) => actions.undoSetPositions(undo),
                redo: (redo) => actions.redoSetPositions(redo)
            },
            PRODUCT_GRAPH_REMOVE_ELEMENTS: {
                undo: (undo) => actions.undoRemoveElements(undo),
                redo: (redo) => actions.redoRemoveElements(redo)
            },
            PRODUCT_GRAPH_COLLAPSE_NODES: {
                undo: (undo) => actions.uncollapseNodes(undo),
                redo: (redo) => actions.collapseNodes(redo)
            },
            PRODUCT_GRAPH_UNCOLLAPSE_NODES: {
                undo: (undo) => actions.collapseNodes(undo),
                redo: (redo) => actions.uncollapseNodes(redo)
            }
        }
    })

    registry.registerExtension('org.bigconnect.store', {
        key: 'org-bigconnect-graph',
        reducer: function(state, { type, payload }) {
            if (!state) return { animatingGhosts: {} }
            switch (type) {
                case 'PRODUCT_GRAPH_ADD_GHOSTS': return addGhosts(state, payload);
                case 'PRODUCT_GRAPH_REMOVE_GHOST': return removeGhost(state, payload);
            }

            return state;
        }
    })

    function addGhosts(state, { ids, position }) {
        return u({
            animatingGhosts: _.object(ids.map(id => [id, u.constant(position)]))
        }, state)
    }
    function removeGhost(state, { id }) {
        return u({ animatingGhosts: u.omit(id) }, state);
    }

    function addEdges(state, { productId, edges, workspaceId }) {
        const product = state.workspaces[workspaceId].products[productId];
        if (product && product.extendedData && product.extendedData.edges) {
            return u.updateIn(
                `workspaces.${workspaceId}.products.${productId}.extendedData.edges`,
                (prevEdges) => ({...prevEdges, ...edges})
            , state)
        }

        return state;
    }

    function updateOrAddElements(state, { workspaceId, productId, updateVertices }) {
        const product = state.workspaces[workspaceId].products[productId];

        if (product && product.extendedData && product.extendedData.vertices) {
            const updatedIds = [];
            var updated = u.updateIn(
                `workspaces.${workspaceId}.products.${productId}.extendedData.vertices`,
                function(elements) { return applyUpdates(elements, updatedIds) },
                state
            );
            updated = u.updateIn(
                `workspaces.${workspaceId}.products.${productId}.extendedData.compoundNodes`,
                function(elements) { return applyUpdates(elements, updatedIds) },
                updated
            );

            const additionalVertices = _.omit(updateVertices, updatedIds)
            if (!_.isEmpty(additionalVertices)) {
                updated = u.updateIn(
                    `workspaces.${workspaceId}.products.${productId}.extendedData.vertices`,
                    function(elements) { return addElements(elements, additionalVertices, 'vertex') },
                    updated
                )
                updated = u.updateIn(
                    `workspaces.${workspaceId}.products.${productId}.extendedData.compoundNodes`,
                    function(elements) { return addElements(elements, additionalVertices, 'compoundNode') },
                    updated
                )
            }

            return updated;
        }

        return state;

        function applyUpdates(elements, updatedIds) {
            return _.mapObject(elements, (element) => {
                if (element.id in updateVertices) {
                    updatedIds.push(element.id);
                    return updateVertices[element.id];
                }
                return element;
            })
        }

        function addElements(elements, adding, type) {
            Object.keys(adding).forEach(id => {
                const newElement = adding[id];
                if (newElement.type === type) {
                    elements = {
                        ...elements,
                        [id]: newElement
                    };
                }
            });
            return elements;
        }
    }

    function removeElements(state, { workspaceId, productId, elements }) {
        const { vertexIds, edgeIds, collapsedNodeIds } = elements;
        const updates = {};

        if (vertexIds) updates.vertices = u.omitBy(v => vertexIds.includes(v.id));
        if (edgeIds) updates.edges = u.omitBy(e => edgeIds.includes(e.edgeId));
        if (collapsedNodeIds) updates.compoundNodes = u.omitBy(c => collapsedNodeIds.includes(c.id));

        return u({
            workspaces: {
                [workspaceId]: {
                    products: {
                        [productId]: {
                            extendedData: updates
                        }
                    }
                }
            }
        }, state);
    }

    function renameCollapsedNode(state, { title, collapsedNodeId, productId, workspaceId }) {
        return u.updateIn(`workspaces.${workspaceId}.products.${productId}.extendedData.compoundNodes.${collapsedNodeId}.title`, title, state);
    }

    function updateVisibleCollapsedNodes(state, {workspaceId, vertices}) {
        if (_.isEmpty(vertices)) {
            return state;
        }

        const updateProduct = (product) => {
            if (product && product.extendedData) {
                const { vertices: productVertices, compoundNodes: collapsedNodes } = product.extendedData;
                if (productVertices && collapsedNodes) {
                    const authorizedVertices = _.pick(productVertices, v => vertices[v.id] ? !vertices[v.id]._DELETED : !v.unauthorized);
                    const visibleCollapsedNodes = _.mapObject(collapsedNodes, (collapsedNode, id) => {
                        const queue = [...collapsedNode.children];
                        let visible = false;
                        while (!visible && queue.length) {
                            const id = queue.pop();
                            const children = collapsedNodes[id] && collapsedNodes[id].children;
                            if (children) {
                                children.forEach(child => { queue.push(child) });
                            } else {
                                visible = id in authorizedVertices;
                            }
                        }

                        return visible;
                    });

                    return u.updateIn(
                        'extendedData.compoundNodes',
                        collapsedNodes => _.mapObject(collapsedNodes, ({ id, ...rest }) => ({
                            ...rest,
                            id,
                            visible: visibleCollapsedNodes[id]
                        })), product);
                }
            }

            return product;
        }

        return u({
            workspaces: {
                [workspaceId]: {
                    products: u.map(updateProduct)
                }
            }
        }, state);
    }
});

