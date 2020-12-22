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
define(['updeep'], function(u) {
    'use strict';

    return function element(state, { type, payload }) {
        if (!state) return { focusing: { vertexIds: {}, edgeIds: {} } }

        if (payload) {
            switch (type) {
                case 'ELEMENT_SET_FOCUS': return setFocusing(state, payload)

                case 'ELEMENT_UPDATE':
                    const { workspaceId } = payload;
                    if (!workspaceId) throw new Error('WorkspaceId required');
                    return { ...state, [workspaceId]: update(state[workspaceId], payload) };

                case 'ELEMENT_UPDATE_EDGELABELS': return updateEdgeLabels(state, payload);
            }
        }

        return state;
    }

    function updateEdgeLabels(state, { workspaceId, vertexLabels }) {
        return u({
            [workspaceId]: {
                vertices: {
                    ..._.mapObject(vertexLabels, labels => {
                        return { edgeLabels: u.constant(labels) };
                    })
                }
            }
        }, state)
    }

    function setFocusing(state, { vertexIds = [], edgeIds = [], elementIds = [] }) {
        const updates = {
            vertexIds: _.object(vertexIds.concat(elementIds).map(vertexId => [vertexId, true])),
            edgeIds: _.object(edgeIds.concat(elementIds).map(edgeId => [edgeId, true]))
        };
        return u({ focusing: u.constant(updates) }, state);
    }

    function update(previous, { vertices, edges }) {
        const updates = {};
        const updater = e => {
            if (e._DELETED) {
                return null;
            }

            e.propertiesByName = e.propertiesByName ? e.propertiesByName : _.groupBy(e.properties, 'name');
            return u.constant(e);
        };

        if (vertices && vertices.length) {
            updates.vertices = _.mapObject(_.indexBy(vertices, 'id'), updater);
        } else if (!previous || !previous.vertices) updates.vertices = {};

        if (edges && edges.length) {
            updates.edges = _.mapObject(_.indexBy(edges, 'id'), updater);
        } else if (!previous || !previous.edges) updates.edges = {};

        return u(updates, previous)
    }

});

