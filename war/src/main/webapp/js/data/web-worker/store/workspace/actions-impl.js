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
define(['../actions', '../../util/ajax', 'require'], function(actions, ajax, require) {
    actions.protectFromMain();

    const sort = workspaces => _.sortBy(
        _.filter(workspaces, function(w) {
            return !w.sharedToUser && ('createdBy' in w);
        }),
        w => w.title.toLowerCase()
    );

    const api = {

        setCurrent: ({ workspaceId }) => (dispatch, getState) => {
            if (!workspaceId) {
                var workspaces = getState().workspace;
                return Promise.try(() => {
                    if (workspaces.allLoaded) {
                        return Promise.resolve(sort(Object.values(workspaces.byId)));
                    } else {
                        publicData.currentWorkspaceId = null;
                        return ajax('GET', '/workspace/all')
                            .then(function(result) {
                                dispatch(api.setAll({ workspaces: result.workspaces }));
                                return sort(result.workspaces);
                            })
                    }
                }).then(list => {
                    if (list.length) {
                        return list[0].workspaceId
                    }
                    return ajax('POST', '/workspace/create').then(workspace => {
                        dispatch(api.update({ workspace }))
                        return workspace.workspaceId;
                    })
                }).then(workspaceId => {
                    return new Promise(f => {
                        require(['../ontology/actions-impl'], ontologyActions => {
                            const getOntology = ontologyActions.get({ workspaceId })(dispatch, getState)
                            Promise.resolve(getOntology).then(() => {
                                dispatch({ type: 'WORKSPACE_SETCURRENT', payload: { workspaceId } })
                                pushSocketMessage({ type: 'setActiveWorkspace', data: { workspaceId } });
                                f();
                            })
                        })
                    })
                })
            } else {
                return new Promise(f => {
                    require(['../ontology/actions-impl'], ontologyActions => {
                        const getOntology = ontologyActions.get({ workspaceId })(dispatch, getState)
                        Promise.resolve(getOntology).then(() => {
                            dispatch({ type: 'WORKSPACE_SETCURRENT', payload: { workspaceId } })
                            dispatch(api.get({ workspaceId }))
                            pushSocketMessage({ type: 'setActiveWorkspace', data: { workspaceId } });
                            f();
                        })
                    })
                })
            }
        },

        setAll: ({ workspaces }) => ({
            type: 'WORKSPACE_SET_ALL',
            payload: { workspaces }
        }),

        deleteWorkspace: ({ workspaceId }) => (dispatch, getState) => {
            const workspaces = getState().workspace;
            const workspace = workspaces.byId[workspaceId];

            if (workspace) {
                dispatch({
                    type: 'WORKSPACE_DELETE',
                    payload: { workspaceId }
                })

                const workspaces = getState().workspace;
                if (workspaces.currentId === workspaceId) {
                    dispatch(api.setCurrent({ workspaceId: undefined }))
                }
            }
        },

        get: ({ workspaceId, invalidate }) => (dispatch, getState) => {
            var workspace = getState().workspace.byId[workspaceId];
            if (!workspace || invalidate) {
                ajax('GET', '/workspace', { workspaceId })
                    .then(workspace => dispatch(api.update({ workspace })))
            }
        },

        update: ({ workspace }) => (dispatch, getState) => {
            const state = getState();
            const { currentId, byId } = state.workspace;
            const { current } = state.user;
            const currentUserId = current && current.id;
            // Sometimes withdrawing access can send a change message after
            // permission has been removed
            const hasAccess = currentUserId === workspace.createdBy ||
                workspace.users.some(({userId}) => userId === currentUserId)

            if (hasAccess) {
                dispatch({
                    type: 'WORKSPACE_UPDATE',
                    payload: { workspace }
                })
                if (!currentId || !byId[currentId]) {
                    dispatch(api.setCurrent({ workspaceId: workspace.workspaceId }))
                } else {
                    require([
                        'data/web-worker/store/product/actions-impl',
                        'data/web-worker/store/product/selectors'
                    ], (productActions, productSelectors) => {
                        const selectedProduct = productSelectors.getProduct(state);
                        if (selectedProduct && selectedProduct.extendedData) {
                                dispatch(productActions.get({ productId: selectedProduct.id, invalidate: true }));
                        }
                    })
                }
            }
        }
    }

    return api;
})
