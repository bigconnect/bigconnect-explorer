
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
    './form-tpl.hbs',
    './shareRow.hbs',
    './permissions.hbs',
    'util/users/userSelect',
    'util/withDataRequest'
], function(
    defineComponent,
    template,
    shareRowTemplate,
    permissionsTemplate,
    UserSelect,
    withDataRequest) {
    'use strict';

    const Permissions = [
        { name: 'READ', display: i18n('workspaces.form.sharing.access.view') },
        { name: 'COMMENT', display: i18n('workspaces.form.sharing.access.comment') },
        { name: 'WRITE', display: i18n('workspaces.form.sharing.access.edit') }
    ];

    return defineComponent(Form, withDataRequest);

    function Form() {

        this.defaultAttrs({
            titleSelector: '.workspace-title',
            titleErrorSelector: '.form-title-error',
            shareListSelector: '.share-list',
            shareHeader: '.share-header',
            shareFormSelector: '.share-form',
            permissionsSelector: '.permissions',
            permissionsRadioSelector: '.popover input',
            permissionsRadioLabelSelector: '.popover label',
            deleteSelector: '.delete',
            removeAccessSelector: '.remove-access'
        });

        this.after('teardown', function() {
            $(document).off('click.permPopover');
        });

        this.after('initialize', function() {
            var self = this;

            this.on(document, 'userStatusChange', this.onUserStatusChange);

            this.editable = this.attr.data.editable;

            this.$node.html(template({
                workspace: this.attr.data,
                editable: this.editable
            }));
            this.loadUserPermissionsList();

            if (this.editable) {

                this.on('userSelected', function(event, data) {
                    if (data && data.user) {
                        self.trigger('shareWorkspaceWithUser', {
                            workspace: self.attr.data,
                            user: data.user
                        });
                        self.trigger(this.select('shareFormSelector'), 'clearUser');
                    }
                });

                UserSelect.attachTo(this.select('shareFormSelector'), {
                    filterUserIds: _.pluck(self.attr.data.users, 'userId'),
                    placeholder: i18n('workspaces.form.sharing.placeholder')
                });

                $(document).on('click.permPopover', function(event) {
                    var $target = $(event.target);

                    if ($target.closest('.permissions-list').length === 0) {
                        self.$node.find('.permissions-list').popover('hide');
                    }
                });
                this.on('shareWorkspaceWithUser', this.onShareWorkspaceWithUser);
                this.on('click', {
                    deleteSelector: this.onDelete,
                    removeAccessSelector: this.onRevokeAccess,
                    permissionsRadioLabelSelector: function(e) {
                        e.stopPropagation();
                    }
                });
                this.on('change', {
                    permissionsRadioSelector: this.onPermissionsChange
                });
                this.select('titleSelector').on('change keyup paste', this.onChangeTitle.bind(this));
            }
        });

        this.onUserStatusChange = function(event, user) {
            this.$node.find('.share-list > .user-row').each(function() {
                var $this = $(this);
                if ($this.data('userId') === user.id) {
                    $this.find('.user-status')
                        .removePrefixedClasses('st-')
                        .addClass('st-' + (user.status && user.status.toLowerCase() || 'unknown'));
                }
            })
        };

        var timeout;
        this.saveWorkspace = function(immediate, options) {
            var self = this,
                changes = options.changes,
                revert = options.revert,
                d = $.Deferred(),
                save = function() {
                    self.trigger(document, 'workspaceSaving', self.attr.data);

                    self.dataRequest('workspace', 'save', self.attr.data.workspaceId, changes)
                        .then(function(workspace) {
                            self.trigger(document, 'workspaceSaved', self.attr.data);
                            d.resolve({ workspace: self.attr.data });
                        })
                        .catch(function() {
                            self.attr.data = revert;
                            self.trigger(document, 'workspaceSaved', revert);
                            d.reject();
                        })
                }

            if (immediate) {
                save();
            } else {
                clearTimeout(timeout);
                timeout = setTimeout(function() {
                    save();
                }, 1000);
            }

            return d;
        };

        this.loadUserPermissionsList = function() {
            var self = this,
                workspace = this.attr.data,
                workspaceUsers = workspace.users || (workspace.users = []),
                userIds = _.pluck(workspaceUsers, 'userId'),
                html = $();

            userIds = _.without(userIds, bcData.currentUser.id);

            (userIds.length ?
                this.dataRequest('user', 'search', { userIds: userIds }) :
                Promise.resolve([]))
                .catch(function(error) {
                    console.log(error);
                    return [];
                })
                .done(function(users) {
                    var usersById = _.indexBy(users, 'id');
                    self.currentUsers = usersById;

                    _.sortBy(workspaceUsers, function(userPermission) {
                        var user = usersById[userPermission.userId];
                        return user && user.displayName || 1;
                    }).forEach(function(userPermission) {
                        if (String(userPermission.userId) !== String(bcData.currentUser.id)) {
                            var data = self.shareRowDataForPermission(userPermission);
                            if (data) {
                                html = html.add(shareRowTemplate(data));
                            }
                        }
                    });
                    self.select('shareHeader').after(html).find('.loading').remove();
                    if (self.editable) {
                        self.select('shareFormSelector').show();
                        self.updatePopovers();
                    }

                })
        };

        this.shareRowDataForPermission = function(userPermission, _user) {
            var user = _user || this.currentUsers[userPermission.userId];
            if (user) {
                return {
                    userId: user.id,
                    displayName: user.displayName,
                    subtitle: (user.displayName.toLowerCase() !== (user.email || user.userName).toLowerCase()) ?
                        (user.email || user.userName) : null,
                    statusClass: `st-${user.status ? user.status.toLowerCase() : 'unknown'}`,
                    accessName: userPermission.access.toUpperCase(),
                    accessDisplay: {
                        read: i18n('workspaces.form.sharing.access.view'),
                        comment: i18n('workspaces.form.sharing.access.comment'),
                        write: i18n('workspaces.form.sharing.access.edit')
                    }[userPermission.access.toLowerCase()],
                    editable: this.editable
                };
            } else console.warn('User ' + userPermission.userId + ' in permissions is not a current user');
        };

        this.updatePopovers = function() {
            this.makePopover(this.select('permissionsSelector'));
        };

        this.makePopover = function(el) {
            el.popover({
                html: true,
                placement: 'left',
                container: this.$node,
                content: function() {
                    var row = $(this).closest('.user-row'),
                        data = $(this).data();
                    return $(permissionsTemplate({
                        permissions: Permissions.map(p => ({
                            ...p,
                            active: p.name === data.access
                        }))
                    })).data('userRow', row);
                }
            });
        };

        this.onChangeTitle = function(event) {
            var self = this,
                $target = $(event.target),
                val = $target.val().trim().replace(/\s+/g, ' ');

            if (!val.length) {
                this.select('titleErrorSelector').hide();
                return;
            }

            if (this.attr.workspaceTitles.includes(val.toLowerCase()) &&
                val.toLowerCase() !== this.attr.currentWorkspaceTitle.toLowerCase()) {
                this.select('titleSelector').addClass('invalid');
                this.select('titleErrorSelector').show();
                return;
            } else {
                this.select('titleSelector').removeClass('invalid');
                this.select('titleErrorSelector').hide();

                if (val !== this.attr.data.title) {
                    if (!this.titleRevert) {
                        this.titleRevert = $.extend(true, {}, this.attr.data);
                    }
                    this.attr.data.title = val;
                    this.saveWorkspace(false, {
                        changes: {
                            title: val
                        },
                        revert: this.titleRevert
                    }).fail(function() {
                        $target.val(self.titleRevert.title);
                    }).always(function() {
                        self.titleRevert = null;
                    });
                }
            }
        };

        this.onPermissionsChange = function(event) {
            var self = this,
                $target = $(event.target),
                newPermissions = $target.data('permissions'),
                list = $target.closest('.permissions-list'),
                userRow = list.data('userRow');

            if(!userRow)
                return;

            var badge = userRow.find('.permissions'),
                userId = userRow.data('userId'),
                user = _.findWhere(this.attr.data.users, { userId: userId });

            if (user) {
                var revert = $.extend(true, {}, this.attr.data);
                user.access = newPermissions;
                badge.popover('hide').popover('disable').addClass('loading');
                this.saveWorkspace(true, {
                    changes: {
                        userUpdates: [user]
                    },
                    revert: revert
                })
                    .done(function() {
                        var newUserRow = $(shareRowTemplate(self.shareRowDataForPermission(user)));
                        userRow.replaceWith(newUserRow);
                        self.makePopover(newUserRow.find('.badge'));
                    });
            } else console.warn('Unable to update permissions because user "' + userId + '" not found');
        };

        this.onDelete = function(event) {
            var self = this,
                workspaceId = this.attr.data.workspaceId,
                $target = $(event.target),
                previousText = $target.text();

            this.trigger('workspaceDeleting', this.attr.data);

            $target.text(i18n('workspaces.form.button.deleting')).attr('disabled', true);

            this.dataRequest('workspace', 'delete', workspaceId)
                .then(function() {
                    //self.trigger('workspaceDeleted', { workspaceId: workspaceId });
                })
                .catch(function() {
                    $target.text(previousText).removeAttr('disabled');
                })
        };

        this.onRevokeAccess = function(event) {
            var self = this,
                list = $(event.target).closest('.permissions-list'),
                row = list.data('userRow'),
                userId = row.data('userId'),
                badge = row.find('.permissions').popover('hide').popover('disable').addClass('loading'),
                revert = $.extend(true, {}, this.attr.data);

            this.attr.data.users = _.reject(this.attr.data.users, function(user) {
                return user.userId === userId;
            });
            this.saveWorkspace(true, {
                changes: {
                    userDeletes: [userId]
                },
                revert: revert
            })
                .fail(function() {
                    var originalHtml = badge.html();
                    badge.removeClass('loading').addClass('badge-important').text('Error');
                    _.delay(function() {
                        badge.html(originalHtml).removeClass('badge-important').popover('enable');
                    }, 2000)
                })
                .done(function() {
                    row.remove();
                    self.updateUserSelectionFilter();
                });
        };

        this.updateUserSelectionFilter = function() {
            this.trigger(this.select('shareFormSelector'), 'updateFilterUserIds', {
                userIds: _.pluck(this.attr.data.users, 'userId')
            });
        };

        this.onShareWorkspaceWithUser = function(event, data) {
            if (this.currentUsers) {
                this.currentUsers[data.user.id] = data.user;
            }

            var self = this,
                form = this.select('shareFormSelector'),
                user = {
                    userId: data.user.id,
                    access: 'READ'
                },
                row = $(shareRowTemplate(this.shareRowDataForPermission(user, data.user))).insertBefore(form),
                badge = row.find('.permissions'),
                revert = $.extend(true, {}, this.attr.data);

            this.attr.data.users.push(user);

            badge.addClass('loading');
            this.saveWorkspace(true, {
                changes: {
                    userUpdates: [user]
                },
                revert: revert
            })
                .always(function() {
                    badge.removeClass('loading');
                    badge.popover('destroy');
                })
                .fail(function() {
                    badge.addClass('badge-important').text('Error');
                    _.delay(function() {
                        row.remove();
                    }, 2000);
                })
                .done(function() {
                    _.defer(function() {
                        self.makePopover(badge);
                        self.updateUserSelectionFilter();
                    });
                });
        };

    }
});
