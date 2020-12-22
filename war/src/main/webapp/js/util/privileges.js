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
    'flight/lib/component',
    './defaultPrivileges'
], function(defineComponent) {
    'use strict';

    var Component = defineComponent(Privileges);

    return Component;

    function Privileges() {

        this.workspaceEditable = false;

        this.after('initialize', function() {
            this.workspaceEditable = true;
            this.on('workspaceLoaded', this.onWorkspaceLoaded);
            this.on('workspaceUpdated', this.onWorkspaceUpdated);
            this.update();
        });

        this.onWorkspaceUpdated = function(event, data) {
            var workspace = data.workspace;
            this.workspaceEditable = workspace.editable;
            this.workspaceCommentable = workspace.commentable;
            this.update();
        };

        this.onWorkspaceLoaded = function(event, workspace) {
            this.workspaceEditable = workspace.editable;
            this.workspaceCommentable = workspace.commentable;
            this.update();
        };

        this.update = function() {
            var user = bcData.currentUser,
                editable = this.workspaceEditable,
                commentable = this.workspaceCommentable,
                cls = [];

            if (user) {
                $.extend(user, {
                    privilegesHelper: _.indexBy(user.privileges || [])
                });
            }
            PRIVILEGES.forEach(function(p) {
                var missingKey = 'missing' + p;

                if (p === 'ADMIN') {
                    Component[missingKey] = !user || !user.privilegesHelper[p];
                } else if (p === 'COMMENT') {
                    Component[missingKey] = !user || !user.privilegesHelper[p] || !commentable;
                } else {
                    Component[missingKey] = !user || !user.privilegesHelper[p] || !editable;
                }
                Component['can' + p] = !Component[missingKey];

                if (Component[missingKey]) {
                    cls.push('no-privilege-' + p);
                }
            });

            $('html').removePrefixedClasses('no-privilege-').addClass(cls.join(' '));
            this.trigger('privilegesReady');
        };

    }
});
