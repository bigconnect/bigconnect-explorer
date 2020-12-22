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

/* global publicData:0 */
define([
    'data/web-worker/store/element/selectors',
    'data/web-worker/store/product/selectors'
], function(elementSelectors, productSelectors) {

    //check new edges for product inclusion (both vertices are in the product)
    publicData.storePromise.then(store => store.observe(elementSelectors.getEdges, (newEdges, prevEdges) => {
        const state = store.getState();
        const workspaceId = state.workspace.currentId;

        productSelectors.getProducts(state).forEach(product => {
            if (product.extendedData) {
                const { vertices, edges } = product.extendedData;
                const addEdges = {};

                _.each(newEdges, (edge, id) => {
                    if (edge !== null && !(id in edges)) {
                        if (edge.inVertexId in vertices && edge.outVertexId in vertices) {
                            addEdges[id] = {
                                edgeId: id,
                                ..._.pick(edge, 'inVertexId', 'outVertexId', 'label')
                            };
                        }
                    }
                })

                if (Object.keys(addEdges).length) {
                    _.defer(() => {
                        store.dispatch({
                            type: 'PRODUCT_ADD_EDGE_IDS',
                            payload: { workspaceId, productId: product.id, edges: addEdges }
                        })
                    })
                }
            }
        });
    }));
});
