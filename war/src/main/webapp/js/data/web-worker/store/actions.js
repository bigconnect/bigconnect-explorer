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

    const validActionKeys = 'type payload error meta'.split(' ');

    return {

        // Similar to https://github.com/acdlite/flux-standard-action
        isValidAction(action) {
            return (
                _.isObject(action) &&
                _.isString(action.type) &&
                Object.keys(action).every(isValidKey)
            );

            function isValidKey(key) { return validActionKeys.indexOf(key) > -1; }
        },

        /*
         * Create FSA compatible actions which include the worker action
         * mapper.
         *
         * We can't send functions over the worker wire, so just send keys and
         * map those to new actions that could be processed by thunk, promise
         * middleware.
         *
         * Specify functions as the value of actions to add create action
         * payloads from calling code. If value is not a function it's ignored.
         */
        createActions({ workerImpl, actions }) {
            if (!_.isString(workerImpl)) throw new Error('workerImpl must be defined as a string')
            if (!_.isObject(actions)) throw new Error('actions must be an object')

            return _.mapObject(actions, function(value, key) {
                var action = { type: 'ROUTE_TO_WORKER_ACTION', payload: {}, meta: { workerImpl: workerImpl, name: key } }
                if (_.isFunction(value)) {
                    return function(...params) {
                        return { ...action, payload: value(...params) }
                    }
                } else {
                    return action;
                }
            })
        },

        protectFromMain() {
            if (isMainThread()) throw new Error('This file should only be required in a worker thread')
        },

        protectFromWorker() {
            if (!isMainThread()) throw new Error('This file should only be required in the main thread');
        }

    }

    function isMainThread() {
        return typeof importScripts === 'undefined'
    }
})
