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
    'com/mware/web/product/map/dist/actions-impl'
], function(registry, u, actions) {

    registry.registerExtension('org.bigconnect.store', {
        key: 'product',
        reducer: function(state, { type, payload }) {
            switch (type) {
                case 'PRODUCT_MAP_ADD_ELEMENTS': return addElements(state, payload);
                case 'PRODUCT_MAP_REMOVE_ELEMENTS': return removeElements(state, payload);
                case 'PRODUCT_MAP_SET_LAYER_ORDER': return setLayerOrder(state, payload);
            }

            return state;
        },
        undoActions: {
            PRODUCT_MAP_ADD_ELEMENTS: {
                undo: (undo) => actions.removeElements(undo),
                redo: (redo) => actions.redoDropElements(redo)
            },
            PRODUCT_MAP_REMOVE_ELEMENTS: {
                undo: (undo) => actions.redoDropElements(undo),
                redo: (redo) => actions.removeElements(redo)
            }
        }
    })

    function addElements(state, { workspaceId, productId, vertexIds, elements }) {
        const product = state.workspaces[workspaceId].products[productId];
        const vertices = product && product.extendedData && product.extendedData.vertices;
        const newVertices = {};
        if (elements) {
            Object.keys(elements).forEach(key => {
                newVertices[key] = u.constant(elements[key])
            })
        }
        if (vertexIds) {
            vertexIds.forEach(id => {
                newVertices[id] = { id }
            });
        }
        if (vertices) {
            return u({
                workspaces: {
                    [workspaceId]: {
                        products: {
                            [productId]: {
                                extendedData: {
                                    vertices: newVertices
                                }
                            }
                        }
                    }
                }
            }, state);
        }

        return state;
    }

    function removeElements(state, { workspaceId, productId, elements }) {
        return u({
            workspaces: {
                [workspaceId]: {
                    products: {
                        [productId]: {
                            extendedData: {
                                vertices: u.omitBy(v => elements.vertexIds.includes(v.id))
                            }
                        }
                    }
                }
            }
        }, state);
    }

    function setLayerOrder(state, { workspaceId, productId, layerOrder }) {
        return u({
            workspaces: {
                [workspaceId]: {
                    products: {
                        [productId]: {
                            extendedData: {
                                'org-bigconnect-map-layers': {
                                    layerOrder: u.constant(layerOrder)
                                }
                            }
                        }
                    }
                }
            }
        }, state);
    }
});
