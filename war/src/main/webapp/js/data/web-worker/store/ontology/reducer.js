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

    return function ontology(state = {}, { type, payload }) {

        switch (type) {
            case 'ONTOLOGY_UPDATE': return update(state, payload);
            case 'ONTOLOGY_PARTIAL_UPDATE': return updatePartial(state, payload);
            case 'ONTOLOGY_IRI_CREATED': return updateIri(state, payload);
            case 'ONTOLOGY_INVALIDATE': return invalidate(state, payload);
            case 'ONTOLOGY_REMOVE_IRIS': return remove(state, payload);
        }

        return state;
    }

    function update(state, payload) {
        const { workspaceId, ...ontology } = payload;
        return u({ [workspaceId]: u.constant(ontology) }, state);
    }

    function updatePartial(state, payload) {
        const { workspaceId, concepts = {}, relationships = {}, properties = {} } = payload;
        return u({
            [workspaceId]: {
                concepts: _.mapObject(concepts, o => u.constant(o)),
                relationships: _.mapObject(relationships, o => u.constant(o)),
                properties: _.mapObject(properties, o => u.constant(o)),
            }
        }, state)
    }

    function remove(state, payload) {
        const { workspaceId, ...iris } = payload;
        const updates = {}
        _.each(iris, (list, type) => {
            if (_.isArray(list) && list.length) {
                updates[type] = u.omit(list);
            }
        })
        return u({ [workspaceId]: updates }, state)
    }

    function invalidate(state, { workspaceIds = [] }) {
        return u(u.omit(workspaceIds), state);
    }

    function updateIri(state, { type, key, error, iri }) {
        if (iri) {
            return u.updateIn(`iris.${type}.${key}`, iri, state);
        }
        return u.updateIn(`iris.${type}.${key}.error`, error, state);
    }
});

