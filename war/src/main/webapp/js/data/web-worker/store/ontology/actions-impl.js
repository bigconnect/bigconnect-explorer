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
define(['../actions', '../../util/ajax'], function(actions, ajax) {
    actions.protectFromMain();

    const ACTION_UPDATE = 'Update';
    const ACTION_DELETE = 'Delete';
    const anyNotEmpty = ({ conceptIds, relationshipIds, propertyIds }) => _.any([conceptIds, relationshipIds, propertyIds], l => !_.isEmpty(l))
    const add = (type, listName) => ({ workspaceId, key, ...rest }) => dispatch => {
        const obj = rest[type];
        return ajax('POST', `/ontology/${type}`, { workspaceId, ...obj })
            .then(payload => {
                dispatch(api.partial({ workspaceId, [listName]: { [payload.title]: payload }}))
                if (key) {
                    dispatch(api.iriCreated({ key, type, iri: payload.title }))
                }
            })
            .catch(payload => {
                if (key) {
                    dispatch(api.iriFailed({ key, type, error: payload.message }))
                }
                throw payload;
            })
    };

    const api = {
        get: ({ workspaceId, invalidate = false }) => (dispatch, getState) => {
            const state = getState();
            if (!workspaceId) {
                workspaceId = state.workspace.currentId ||
                    (state.user.current && state.user.current.currentWorkspaceId)
            }

            if (!workspaceId) throw new Error('No workspace provided');

            if (!state.ontology[workspaceId] || invalidate) {
                return ajax('GET', '/ontology', { workspaceId })
                    .then(result => {
                        dispatch(api.update({ ...transform(result), workspaceId }))
                    })
            }
        },

        update: (payload) => ({
            type: 'ONTOLOGY_UPDATE',
            payload
        }),

        invalidate: ({ workspaceIds }) => ({
            type: 'ONTOLOGY_INVALIDATE',
            payload: {
                workspaceIds
            }
        }),

        partial: ({ workspaceId, ...ontology }) => (dispatch, getState) => {
            if (!workspaceId) {
                workspaceId = getState().workspace.currentId;
            }

            dispatch({
                type: 'ONTOLOGY_PARTIAL_UPDATE',
                payload: {
                    workspaceId,
                    ...transform(ontology)
                }
            })
        },

        addConcept: add('concept', 'concepts'),

        addProperty: add('property', 'properties'),

        addRelationship: add('relationship', 'relationships'),

        iriCreated: ({ type, key, iri }) => ({
            type: 'ONTOLOGY_IRI_CREATED',
            payload: { type, key, iri }
        }),

        iriFailed: ({ type, key, error }) => ({
            type: 'ONTOLOGY_IRI_CREATED',
            payload: { type, key, error }
        }),

        remove: ({ workspaceId, concepts, relationships, properties }) => ({
            type: 'ONTOLOGY_REMOVE_IRIS',
            payload: { workspaceId, concepts, relationships, properties }
        }),

        ontologyChange: ({ workspaceId, action, idType, conceptIds, relationshipIds, propertyIds }) => (dispatch, getState) => {
            const state = getState();
            const isPublishedChanged = !workspaceId;
            const ids = { conceptIds, relationshipIds, propertyIds };
            const hasIds = anyNotEmpty(ids)
            const currentWorkspaceId = state.workspace.currentId;
            const requestWithIds = (workspaceId, ontology) => {
                return ajax('GET', '/ontology/segment', { workspaceId, ...ontology })
                    .then(payload => {
                        dispatch(api.partial({ workspaceId, ...payload }))
                    })
            }

            if (isPublishedChanged) {
                if (action === ACTION_UPDATE) {
                    let otherWorkspaces = Object.keys(state.ontology);
                    if (currentWorkspaceId) {
                        otherWorkspaces = _.without(otherWorkspaces, currentWorkspaceId);
                    }
                    dispatch(api.invalidate({ workspaceIds: otherWorkspaces }));
                    if (currentWorkspaceId) {
                        if (hasIds) {
                            return requestWithIds(currentWorkspaceId, ids);
                        } else {
                            dispatch(api.get({ currentWorkspaceId, invalidate: true }));
                        }
                    }
                } else throw new Error(`Published action: ${action} not supported`);
            } else {
                const workspaceInStore = workspaceId in state.ontology;
                if (workspaceInStore) {
                    if (hasIds) {
                        if (action === ACTION_UPDATE) {
                            return requestWithIds(workspaceId, ids);
                        } else if (action === ACTION_DELETE) {
                            dispatch(api.remove({
                                workspaceId,
                                concepts: conceptIds,
                                relationships: relationshipIds,
                                properties: propertyIds
                            }));
                        } else throw new Error(`Action: ${action} not supported`);
                    } else {
                        dispatch(api.get({ workspaceId, invalidate: true }))
                    }
                }
            }
        }
    }

    return api;


    function transform(ontology) {
        const concepts = _.indexBy(ontology.concepts, 'title');
        const properties = _.indexBy(ontology.properties, 'title');
        const relationships = _.indexBy(ontology.relationships, 'title');

        return { concepts, properties, relationships };
    }
})

