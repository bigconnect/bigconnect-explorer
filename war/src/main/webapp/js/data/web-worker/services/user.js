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
 * Services for users
 *
 * @module services/user
 * @see module:dataRequest
 */
define(['../util/ajax', '../store', '../store/user/actions-impl'], function(ajax, store, userActions) {
    'use strict';

    /**
     * @alias module:services/user
     */
    var api = {

        cachedNames: {},

        /**
         * Get the current user
         */
        me: function(options) {
            return ajax('GET', '/user/me')
                .then(function(user) {
                    return _.extend(user, {
                        privilegesHelper: _.indexBy(user.privileges || [])
                    });
                })
        },

        /**
         * Get user info
         * @param {string} userName
         */
        get: function(userName) {
            return ajax('GET', '/user', {
                'user-name': userName
            });
        },

        /**
         * Get user info by id
         * @param {string} userId
         */
        getById: function(userId) {
            return ajax('GET', '/user/id', {
                'user-id': userId
            });
        },

        addOrEdit: function(user, mode) {
            return ajax('POST', '/user/addOrEdit', {
                id: user.id,
                userName: user.userName,
                displayName: user.displayName,
                email: user.email,
                password: user.password,
                privileges: user.privileges,
                roles: user.roles,
                mode: mode
            });
        },

        /**
         * Set user preference
         * @param {string} name
         * @param {object} value
         */
        preference: function(name, value) {
            store.getStore().dispatch(userActions.putUserPreference({ name, value }));
            return ajax('POST', '/user/ui-preferences', {
                name: name,
                value: value
            });
        },

        delete: function(userId) {
            return ajax('POST', '/user/delete1', {
                id: userId
            });
        },

        /**
         * Get user names for ids
         * @function
         * @param {Array.<string>} userIds
         */
        getUserNames: function(userIds) {
            var notCached = _.reject(userIds, function(userId) {
                return userId in api.cachedNames || (
                    publicData.currentUser.id === userId
                );
            });

            if (notCached.length) {
                return api.search({ userIds: notCached })
                    .then(function(users) {
                        var usersById = _.indexBy(users, 'id');
                        return userIds.map(function(userId) {
                            return api.cachedNames[userId] || (
                                api.cachedNames[userId] = (usersById[userId] || publicData.currentUser).displayName
                            );
                        });
                    });
            } else {
                return Promise.resolve(
                    userIds.map(function(userId) {
                        return api.cachedNames[userId] || publicData.currentUser.displayName;
                    })
                );
            }
        },

        table: function(options) {
            return ajax(
                'GET',
                '/user/table', options)
                .then(function(response) {
                    return response.users;
                })
        },

        /**
         * Search for user
         * @param {object} options
         * @param {object} [options.query]
         * @param {Array.<string>} [options.userIds]
         */
        search: function(options) {
            var data = {},
                returnSingular = false;

            if (options.query) {
                data.q = options.query;
            }
            if (options.online) {
                data.online = options.online;
            }
            if (options.userIds) {
                if (!_.isArray(options.userIds)) {
                    returnSingular = true;
                    data.userIds = [options.userIds];
                } else {
                    data.userIds = _.unique(options.userIds);
                }
            }
            return ajax(
                (data.userIds && data.userIds.length > 2) ? 'POST' : 'GET',
                '/user/all', data)
                .then(function(response) {
                    var users = response.users;
                    return returnSingular ? users[0] : users;
                })
        },

        /**
         * Logout
         */
        logout: function(options) {
            return ajax('POST', '/logout');
        }

    };

    return api;
});
