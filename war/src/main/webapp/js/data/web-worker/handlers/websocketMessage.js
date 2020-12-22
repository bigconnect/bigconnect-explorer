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
    'require',
    'configuration/plugins/registry',
    '../store'
], function(require, registry, store) {
    'use strict';

    var NOOP = function() {},
        socketHandlers = {
            workspaceChange: function(data, json) {
                require(['../store/workspace/actions-impl'], function(actions) {
                    store.getStore().dispatch(actions.update({ workspace: data }))
                });
            },
            workspaceDelete: function(data) {
                require(['../store/workspace/actions-impl'], function(actions) {
                    store.getStore().dispatch(actions.deleteWorkspace({ workspaceId: data.workspaceId }));
                });
            },
            ontologyChange: function(data) {
                require(['../store/ontology/actions-impl'], function(actions) {
                    store.getStore().dispatch(actions.ontologyChange(data));
                });
            },
            workProductPreviewChange: function(data) {
                const { id, workspaceId, md5 } = data;
                require(['../store/product/actions-impl'], function(actions) {
                    store.getStore().dispatch(actions.previewChanged({ productId: id, workspaceId, md5 }));
                })
            },
            workProductChange: function(data) {
                const { id, workspaceId} = data;
                require(['../store/product/actions-impl'], function(actions) {
                    store.getStore().dispatch(actions.changedOnServer({ productId: id, workspaceId }));
                })
            },
            workProductDelete: function(data) {
                require(['../store/product/actions-impl'], function(actions) {
                    store.getStore().dispatch(actions.remove(data.id))
                })
            },
            workProductAncillaryChange: function({ workspaceId, productId, id }) {
                require([
                    '../store/element/actions-impl',
                    '../store/product/actions-impl'
                ], function(elementActions, productActions) {
                    const dispatch = store.getStore().dispatch;

                    dispatch(elementActions.ancillaryChange({ workspaceId, id }))
                    dispatch(productActions.get({ productId, invalidate: true }))
                });
            },
            userAccessChange: function(user) {
                require(['../store/user/actions-impl'], function(actions) {
                    store.getStore().dispatch(actions.putUser({ user }));
                })
            },
            userWorkspaceChange: NOOP,
            publish: function(data) {
                // Property undo already publishes propertyChange
                if (data.objectType !== 'property' || data.publishType !== 'undo') {
                    socketHandlers.propertyChange(data);
                }
            },
            propertyChange: function(data) {
                require(['../store/element/actions-impl'], function(actions) {
                    store.getStore().dispatch(actions.propertyChange(data));
                });
            },
            verticesDeleted: function(data) {
                require(['../store/element/actions-impl'], function(actions) {
                    store.getStore().dispatch(actions.deleteElements({ vertexIds: data.vertexIds }));
                });
            },
            edgeDeletion: function(data) {
                require(['../store/element/actions-impl'], function(actions) {
                    store.getStore().dispatch(actions.deleteElements({ edgeIds: [data.edgeId] }));
                });
            },
            textUpdated: function(data) {
                if (data.graphVertexId &&
                    (!data.workspaceId ||
                     data.workspaceId === publicData.currentWorkspaceId)) {

                    dispatchMain('rebroadcastEvent', {
                        eventName: 'textUpdated',
                        data: {
                            vertexId: data.graphVertexId
                        }
                    })
                }
            },
            longRunningProcessDeleted: function(data) {
                dispatchMain('rebroadcastEvent', {
                    eventName: 'longRunningProcessDeleted',
                    data: {
                        processId: data.processId
                    }
                });
            },
            longRunningProcessChange: function(process) {
                dispatchMain('rebroadcastEvent', {
                    eventName: 'longRunningProcessChanged',
                    data: {
                        process: process
                    }
                });
            },
            entityImageUpdated: function(data) {
                if (data && data.graphVertexId) {
                    socketHandlers.propertyChange(data);
                }
            },
            notification: function(data) {
                dispatchMain('rebroadcastEvent', {
                    eventName: 'notificationActive',
                    data: data
                });
            },
            systemNotificationUpdated: function(data) {
                dispatchMain('rebroadcastEvent', {
                    eventName: 'notificationUpdated',
                    data: data
                });
            },
            systemNotificationEnded: function(data) {
                dispatchMain('rebroadcastEvent', {
                    eventName: 'notificationDeleted',
                    data: data
                });
            }
        },
        callHandlersForName = function(name, data) {
            var extensions = _.where(
                registry.extensionsForPoint('org.bigconnect.websocket.message'),
                { name: name }
            );
            if (extensions.length) {
                extensions.forEach(function(e) {
                    e.handler(data);
                });

                return true;
            }
        };

    return function(data) {
        var body = data.responseBody,
            json = JSON.parse(body);

        if (isBatchMessage(json)) {
            var filtered = _.reject(json.data, messageFromUs);
            if (filtered.length) {
                console.groupCollapsed('Socket Batch (' + filtered.length + ')');
                filtered.forEach(process);
                console.groupEnd();
            }
        } else if (!messageFromUs(json)) {
            process(json);
        }
    }

    function process(json) {
        console.debug('%cSocket: %s %O', 'color:#999;font-style:italics', json.type, json.data || json)
        if (json.type in socketHandlers) {
            socketHandlers[json.type]('data' in json ? json.data : json, json);
            callHandlersForName(json.type, json.data);
        } else if (!callHandlersForName(json.type, json.data)) {
            console.warn('Unhandled socket message type:' + json.type, 'message:', json);
        }
    }

    function messageFromUs(json) {
        const { data } = json;
        if (!_.isObject(data)) {
            return false;
        }

        const { sourceGuid } = data;
        if (!sourceGuid) {
            return false;
        }

        return sourceGuid === publicData.socketSourceGuid;
    }

    function isBatchMessage(json) {
        return json.type === 'batch' && _.isArray(json.data);
    }
});
