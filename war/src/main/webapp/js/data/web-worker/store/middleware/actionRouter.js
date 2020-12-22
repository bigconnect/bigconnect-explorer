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
 * Route actions with type: ROUTE_TO_WORKER_ACTION,
 * to a method supplied in the module `meta.workerImpl`.
 *
 * Allows actions to be dispatched that have complex behavior
 * to be processed by redux-thunk/promise, etc.
 */
define(['../actions'], function(actions) {
    return ({ getState }) => (next) => (action) => {
        if (_.isFunction(action)) return next(action);

        var { type, payload, meta } = action;
        if (type === 'ROUTE_TO_WORKER_ACTION' && meta) {

            var { workerImpl, name } = meta;

            if (workerImpl && name) {
                require([workerImpl], function(worker) {
                    if ('default' in worker) {
                        worker = worker.default;
                    }
                    if (name in worker) {
                        var impl = worker[name];
                        if (_.isFunction(impl)) {
                            var result = impl(payload);
                            if (result) {
                                next(result)
                            }
                        } else {
                            next(impl)
                        }
                    } else {
                        console.error(worker);
                        throw new Error('Action dispatched with no matching worker impl: ' + name + ', worker = ' + workerImpl)
                    }
                }, function(error) {
                    console.error('Action dispatched with worker that got error: ', error);
                    throw error;
                })
            } else {
                throw new Error('workerImpl and name required in meta for type = ' + type)
            }
        } else {
            return next(action);
        }
    }
})
