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
 * Plugins should `require` this module for access to BigConnect Explorer helpers
 * available in the worker thread.
 *
 * @module public/v1/workerApi
 * @classdesc BigConnect Explorer Top-Level API for Web Workers
 * @example
 * require(['public/v1/workerApi'], function(workerApi) {
 *     // ...
 * })
 */
define([
    'data/web-worker/util/ajax'
], function(ajax) {
    'use strict';

    /**
     * @alias module:public/v1/workerApi
     */
    return {

        /**
         * Make an `XmlHttpRequest` to the server.
         *
         * This function expects the server to respond in JSON.
         * If that is not that case you must pass a special method formatted
         * like: `[method]->HTML`. For example, `GET->HTML`.
         *
         * @function
         * @param {string} method The request method type (GET, PUT, POST, DELETE, etc)
         * @param {string} endpoint The endpoint
         * @param {object} [parameters] Any parameters to send
         * @returns {Promise}
         * @example <caption>GET</caption>
         * require(['public/v1/workerApi'], function(workerApi) {
         *     workerApi.ajax('GET', '/user/me')
         *      .then(function(user) {
         *      })
         * })
         * @example <caption>POST</caption>
         * require(['public/v1/workerApi'], function(workerApi) {
         *     workerApi.ajax('POST', '/user/logout')
         *      .then(function() {
         *      })
         * })
         * @example <caption>DELETE with Parameters</caption>
         * require(['public/v1/workerApi'], function(workerApi) {
         *     workerApi.ajax('DELETE', '/sample/object', { objectId: 'o1' })
         *      .then(function() {
         *      })
         * })
         * @example <caption>Handle Errors</caption>
         * require(['public/v1/workerApi'], function(workerApi) {
         *     workerApi.ajax('DELETE', '/sample/object', { objectId: 'o1' })
         *      .catch(function(err) {
         *          console.error(err);
         *      })
         *
         * })
         */
        ajax: ajax
    };
});
