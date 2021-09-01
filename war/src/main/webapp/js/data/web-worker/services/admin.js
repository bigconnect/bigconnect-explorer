
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
    '../util/ajax'
], function(ajax) {
    'use strict';

    var api = {
        ontologyProperySave: function(property, conceptId, relId, namespace) {
            return ajax('post', '/admin/ontologyPropertySave', { property, conceptId, relId, namespace });
        },

        ontologyProperyAddExisting: function(property, conceptId, relId, namespace) {
            return ajax('post', '/admin/ontologyProperyAddExisting', { property, conceptId, relId, namespace });
        },

        ontologyProperyRemoveExisting: function(property, conceptId, relId, namespace) {
            return ajax('post', '/admin/ontologyProperyRemoveExisting', { property, conceptId, relId, namespace });
        },

        ontologyProperyDelete: function(propertyId, namespace) {
            return ajax('post', '/admin/ontologyPropertyDelete', { propertyId, namespace });
        },

        ontologyConceptSave: function(namespace, concept) {
            return ajax('post', '/admin/ontologyConceptSave', { namespace, concept });
        },

        ontologyConceptDelete: function(namespace, conceptId) {
            return ajax('post', '/admin/ontologyConceptDelete', { namespace, conceptId });
        },

        ontologyRelSave: function(namespace, rel) {
            return ajax('post', '/admin/ontologyRelSave', { namespace, rel });
        },

        ontologyRelDelete: function(namespace, relId) {
            return ajax('post', '/admin/ontologyRelDelete', { namespace, relId });
        },

        dictionarySearch: function(searchFrom, searchTo, searchType) {
            return ajax('POST->HTML','/admin/dictionarySearch', {
                startFrom: searchFrom,
                endTo: searchTo,
                searchType: searchType
            });
        },

        dictionary: function() {
            return ajax('GET', '/admin/dictionary');
        },

        dictionaryDelete: function(rowKey) {
            return ajax('POST', '/admin/dictionary/delete', {
                entryRowKey: rowKey
            });
        },

        dictionaryValidate: function(rowKey) {
            return ajax('POST', '/admin/dictionary/validate', {
                entryRowKey: rowKey
            });
        },

        dictionaryAdd: function(concept, tokens, resolvedName) {
            var data = {
                concept: concept,
                tokens: tokens
            };

            if (resolvedName) {
                data.resolvedName = resolvedName;
            }

            return ajax('POST', '/admin/dictionary', data);
        },

        plugins: function() {
            return ajax('GET', '/admin/plugins');
        },

        enablePlugin: function(clazz, enabled) {
            return ajax('POST', '/admin/plugins/enable', { clazz, enabled });
        },

        systemNotificationCreate: function(options) {
            if ('endDate' in options && !options.endDate) {
                delete options.endDate;
            }
            if ('externalUrl' in options && !options.externalUrl) {
                delete options.externalUrl;
            }
            return ajax('POST', '/notification/system', options);
        },

        systemNotificationDelete: function(id) {
            return ajax('DELETE', '/notification/system', {
                notificationId: id
            });
        },

        userDelete: function(userName) {
            return ajax('POST', '/user/delete', {
                'user-name': userName
            });
        },

        workspaceShare: function(workspaceId, userName) {
            return ajax('POST', '/workspace/shareWithMe', {
                'user-name': userName,
                workspaceId: workspaceId
            });
        },

        workspaceImport: function(workspaceFile) {
            var formData = new FormData();
            formData.append('workspace', workspaceFile);
            return ajax('POST->HTML', '/admin/workspace/import', formData);
        },

        publicOntology: function() {
            return ajax('GET', '/ontology/public');
        },

        workspaceOntology: function(workspaceId) {
            return ajax('GET', '/ontology/workspace', {workspaceId});
        },

        /**
         * Delete elements identified by a saved search
         *
         * @param {string} id
         */
        deleteElements: function(queryId, backup) {
            return ajax('DELETE', '/admin/deleteElements', {
                id: queryId,
                backup: backup
            });
        },

        /**
         * Rstore elements identified by a saved search
         *
         * @param {string} id
         */
        restoreElements: function(queryId) {
            return ajax('POST', '/admin/restoreElements', {
                id: queryId
            });
        }

    };

    return api;
});
