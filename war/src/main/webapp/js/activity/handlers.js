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

/**
 * Default handlers for the Activity panel
 */
define(['util/formatters'], function(F) {
    'use strict';

    return [
        {
            type: 'saveWorkspace',
            kind: 'eventWatcher',
            eventNames: ['workspaceSaving', 'workspaceSaved'],
            titleRenderer: function(el, datum) {
                el.textContent = datum.eventData.title;
            },
            autoDismiss: true
        },

        {
            type: 'findPath',
            kind: 'longRunningProcess',
            allowCancel: false, // long running processes don't support cancelling
            titleRenderer: function(el, process) {
                require([
                    'util/withDataRequest',
                    'util/vertex/formatters'
                ], function(withDataRequest, F) {
                    withDataRequest.dataRequest('vertex', 'store', {
                        workspaceId: process.workspaceId,
                        vertexIds: [
                            process.outVertexId,
                            process.inVertexId
                        ]
                    }).done(function(vertices) {
                        if (vertices.length === 2) {
                            var source = F.vertex.title(vertices[0]),
                                dest = F.vertex.title(vertices[1]);

                            el.textContent = F.string.truncate(source, 8) + ' → ' + F.string.truncate(dest, 8);
                            $('<div>')
                                .css({ fontSize: '90%' })
                                .text(i18n('popovers.find_path.hops.option', process.hops))
                                .appendTo(el);
                        }
                    });
                });
            },
            onRemove: function() {
                this.trigger('defocusPaths');
            },
            finishedComponentPath: 'activity/builtin/findPath'
        },
        {
            type: 'export-raw-search',
            kind: 'longRunningProcess',
            allowCancel: true,
            titleRenderer: function(el, process) {
                el.textContent = process.backupFile;
                if (process.progress == 1) {
                    $('<div>')
                        .html('<button style="margin: 5px;" class="btn btn-xs btn-raised btn-success">Download</button>')
                        .on('click', function() {
                            const csrfToken = window.bcData.currentUser.csrfToken;
                            const workspaceId = window.bcData.currentWorkspaceId;

                            const form = $('<form></form>').attr('action', '/download').attr('method', 'post').attr('target', '_blank');
                            form.append($('<input></input>').attr('type', 'hidden').attr('name', 'filePath').attr('value', process.filePath));
                            form.append($('<input></input>').attr('type', 'hidden').attr('name', 'fileName').attr('value', process.backupFile));
                            form.append($('<input></input>').attr('type', 'hidden').attr('name', 'mimeType').attr('value', 'application/zip'));
                            form.append($('<input></input>').attr('type', 'hidden').attr('name', 'csrfToken').attr('value', csrfToken));
                            form.append($('<input></input>').attr('type', 'hidden').attr('name', 'workspaceId').attr('value', workspaceId));
                            form.appendTo('body').submit().remove();
                        })
                        .appendTo(el);
                }
            },
        },
        {
            type: 'structured-ingest',
            kind: 'longRunningProcess',
            allowCancel: false, // long running processes don't support cancelling
            titleRenderer: function(el, process) {
                require([
                    'util/withDataRequest',
                    'util/vertex/formatters'
                ], function(withDataRequest, F) {
                    withDataRequest.dataRequest('vertex', 'store', {
                        workspaceId: process.workspaceId,
                        vertexIds: process.vertexId
                    }).done(function(vertex) {
                        if (!_.isArray(vertex)) {
                            var title = F.vertex.title(vertex);
                            el.title = title;
                            el.textContent = i18n('activity.tasks.type.structured-ingest.import', F.string.truncate(title, 12));
                        }
                    });
                });
            },
            finishedComponentPath: 'structuredIngest/structuredFileImportAcivityFinished'
        },

        {
            type: 'datasource-ingest',
            kind: 'longRunningProcess',
            allowCancel: true, // long running processes don't support cancelling BUT ! We leave this for the cancel button to appear. This button will remove the process from UI (needed for crashes)
            titleRenderer: function(el, process) {
                el.textContent = process.name;
            },
        },

        {
            type: 'facebook-ingest',
            kind: 'longRunningProcess',
            allowCancel: true, // long running processes don't support cancelling BUT ! We leave this for the cancel button to appear. This button will remove the process from UI (needed for crashes)
            titleRenderer: function(el, process) {
                el.textContent = process.name;
            },
        },

        {
            type: 'delete-elements',
            kind: 'longRunningProcess',
            allowCancel: true, // long running processes don't support cancelling BUT ! We leave this for the cancel button to appear. This button will remove the process from UI (needed for crashes)
            titleRenderer: function(el, process) {
                el.textContent = i18n('activity.tasks.type.delete-elements.content', process.savedSearchName);
            },
            finishedComponentPath: 'admin/bundled/data/delete/deleteRestoreActivityResult'
        },

        {
            type: 'restore-elements',
            kind: 'longRunningProcess',
            allowCancel: true, // long running processes don't support cancelling BUT ! We leave this for the cancel button to appear. This button will remove the process from UI (needed for crashes)
            titleRenderer: function(el, process) {
                el.textContent = i18n('activity.tasks.type.restore-elements.content', process.savedSearchName);
            },
            finishedComponentPath: 'admin/bundled/data/delete/deleteRestoreActivityResult'
        }

    ];
})
