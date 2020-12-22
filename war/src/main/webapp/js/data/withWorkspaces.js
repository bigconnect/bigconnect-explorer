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
define([], function() {
    'use strict';

    return withWorkspaces;

    function withWorkspaces() {
        var workspace,
            undoManagersPerWorkspace = {};

        this.after('initialize', function() {
            var self = this;

            this.fireApplicationReadyOnce = _.once(this.trigger.bind(this, 'applicationReady'));

            this.on('loadCurrentWorkspace', this.onLoadCurrentWorkspace);
            this.on('switchWorkspace', this.onSwitchWorkspace);
            this.on('updateWorkspace', this.onUpdateWorkspace);
            this.on('undo', this.onUndo);
            this.on('redo', this.onRedo);

            bcData.storePromise.then(store => store.observe(state => state.workspace, (next, prev) => {
                const state = store.getState()
                const oldWorkspace = prev && prev.currentId && prev.byId[prev.currentId];
                const newWorkspace = next && next.currentId && next.byId[next.currentId];
                const changed = newWorkspace && (!oldWorkspace || oldWorkspace.workspaceId !== newWorkspace.workspaceId);

                if (changed) {
                    workspace = {...newWorkspace};
                    this.setPublicApi('currentWorkspaceId', workspace.workspaceId);
                    this.setPublicApi('currentWorkspaceName', workspace.title);
                    this.setPublicApi('currentWorkspaceEditable', workspace.editable);
                    this.setPublicApi('currentWorkspaceCommentable', workspace.commentable);
                    this.trigger('workspaceLoaded', workspace);
                    this.trigger('selectObjects');
                    this.fireApplicationReadyOnce();
                }

                _.each(next.byId, (workspace, id) => {
                    const previousWorkspace = prev.byId[id];
                    const workspaceChanged = !previousWorkspace || (previousWorkspace !== workspace);
                    if (workspaceChanged) {
                        this.setPublicApi('currentWorkspaceName', workspace.title);
                        this.setPublicApi('currentWorkspaceEditable', workspace.editable);
                        this.setPublicApi('currentWorkspaceCommentable', workspace.commentable);
                        this.trigger('workspaceUpdated', { workspace })
                    }
                });

                const deletedKeys = prev && next && Object.keys(_.omit(prev.byId, Object.keys(next.byId)));
                if (deletedKeys) {
                    deletedKeys.forEach(workspaceId => {
                        this.trigger('workspaceDeleted', { workspaceId });
                    })
                }
            }));
        });

        this.onLoadCurrentWorkspace = function(event) {
            var currentWorkspaceId = this.bcData.currentWorkspaceId;
            this.trigger('switchWorkspace', { workspaceId: currentWorkspaceId });
        };

        this.onSwitchWorkspace = function(event, data) {
            this.setPublicApi('currentWorkspaceId', data.workspaceId);
            Promise.all([
                bcData.storePromise,
                Promise.require('data/web-worker/store/workspace/actions')
            ]).spread(function(store, workspaceActions) {
                store.dispatch(workspaceActions.setCurrent(data.workspaceId))
            });
        };

        this.onUpdateWorkspace = function(event, data) {
            var self = this,
                triggered = false,
                buffer = _.delay(function() {
                    triggered = true;
                    self.trigger('workspaceSaving', workspace);
                }, 250),
                result,
                legacyKeys = ['entityUpdates', 'entityDeletes'],
                legacy = _.pick(data, legacyKeys);

            if (legacy.length) {
                data = _.omit(data, legacyKeys);
                console.warn('updateWorkspace no longer accepts entity changes');
            }

            if (!_.isEmpty(data)) {
                this.dataRequestPromise.then(function(dataRequest) {
                    dataRequest('workspace', 'save', data)
                        .then(function(data) {
                            clearTimeout(buffer);
                            if (data.saved) {
                                triggered = true;
                            }
                        })
                        .catch(function(e) {
                            console.error(e);
                        })
                        .then(function() {
                            if (triggered) {
                                self.trigger('workspaceSaved', result);
                            }
                        })
                });
            }
        };

        this.onUndo = function() {
            Promise.all([
                bcData.storePromise,
                Promise.require('data/web-worker/store/undo/actions')
            ]).spread((store, actions) => {
                const scope = this.bcData.currentWorkspaceId;
                store.dispatch(actions.undoForProduct());
            });
        };

        this.onRedo = function() {
            Promise.all([
                bcData.storePromise,
                Promise.require('data/web-worker/store/undo/actions')
            ]).spread((store, actions) => {
                const scope = this.bcData.currentWorkspaceId;
                store.dispatch(actions.redoForProduct());
            });
        };
    }
});
