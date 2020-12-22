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
    './userSelectTpl.hbs',
    './user.hbs',
    'util/withDataRequest'
], function(
    defineComponent,
    template,
    userTemplate,
    withDataRequest) {
    'use strict';

    return defineComponent(UserSelect, withDataRequest);

    function UserSelect() {

        this.defaultAttrs({
            inputSelector: 'input',
            filterUserIds: []
        });

        this.after('initialize', function() {
            this.on('clearUser', this.onClearUser);
            this.on('updateFilterUserIds', this.onUpdateFilterUserIds);
            this.on(document, 'userStatusChange', this.onUserStatusChange);

            this.$node.html(template({
                placeholder: this.attr.placeholder || i18n('user.selection.field.placeholder')
            }));

            this.setupTypeahead();
        });

        this.onUserStatusChange = function(event, user) {
            this.$node.find('.user-row').each(function() {
                var $this = $(this);
                if ($this.data('user').id === user.id) {
                    $this.find('.user-status')
                        .removeClass('active idle offline unknown')
                        .addClass('st-' + (user.status && user.status.toLowerCase() || 'unknown'));
                }
            })
        };

        this.onUpdateFilterUserIds = function(event, data) {
            this.attr.filterUserIds = data.userIds;
        };

        this.onClearUser = function() {
            var self = this;

            _.defer(function() {
                self.select('inputSelector').val('');
            });
        };

        this.setupTypeahead = function() {
            var self = this,
                userMap = {};

            this.select('inputSelector').tooltip();

            this.select('inputSelector').typeahead({
                source: function(query, callback) {
                    if ($.trim(query).length) {
                        self.dataRequest('user', 'search', { query: query })
                            .done(function(users) {
                                var otherUsers = users.filter(function(user) {
                                        return self.attr.filterUserIds.indexOf(user.id) === -1;
                                    }),
                                    ids = _.pluck(otherUsers, 'id');

                                userMap = _.indexBy(otherUsers, 'id');

                                callback(ids);
                            });
                    } else {
                        callback([]);
                    }
                },
                matcher: function() {
                    return true;
                },
                sorter: function(userIds) {
                    return _.sortBy(userIds, function(userId) {
                        return userMap[userId].displayName;
                    });
                },
                updater: function(userId) {
                    self.trigger('userSelected', {
                        user: userMap[userId]
                    });
                    return userMap[userId].displayName;
                },
                highlighter: function(userId) {
                    const user = userMap[userId];
                    return userTemplate({
                        json: JSON.stringify(user),
                        statusClass: `st-${user.status ? user.status.toLowerCase() : 'unknown'}`,
                        displayName: user.displayName,
                        subtitle: (user.displayName.toLowerCase() !== (user.email || user.userName).toLowerCase()) ?
                            (user.email || user.userName) : null
                    });
                }
            });
        };

    }
});
