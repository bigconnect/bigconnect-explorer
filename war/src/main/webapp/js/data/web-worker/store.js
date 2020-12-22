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
(function(global) {
    'use strict';


    define([
        'configuration/plugins/registry',
        'fast-json-patch',
        'redux',
        './store/rootReducer',
        './store/enhancer/observe',

        // Middleware
        './store/middleware/actionRouter',
        './store/middleware/thunk',
        './store/middleware/promise',
        './store/middleware/undo',
        './store/middleware/dataRequest',
        //'./store/middleware/logger'
    ], function(registry, jsonpatch, redux, rootReducer, observe, ...middleware) {
        var store;

        return {
            getStore() {
                if (!store) {
                    store = redux.createStore(
                        rootReducer,
                        redux.compose(
                            redux.applyMiddleware(...middleware),
                            observe
                        )
                    );
                    store.subscribe(stateChanged(store.getState()))
                }
                return store;
            },

            getOrWaitForNestedState(getterFn, waitForConditionFn) {
                const check = waitForConditionFn ||
                    (s => {
                        const v = getterFn(s);
                        return !_.isUndefined(v) && !_.isEmpty(v)
                    });

                return Promise.try(function() {
                    var state = store.getState();
                    if (check(state)) {
                        return getterFn(state)
                    } else {
                        return new Promise(done => {
                            const unsubscribe = store.subscribe(() => {
                                const state = store.getState();
                                if (check(state)) {
                                    const newValue = getterFn(store.getState())
                                    unsubscribe();
                                    done(newValue);
                                }
                            })
                        })
                    }
                })
            }
        };

        // Send worker state changes to main thread as JSON-patches
        function stateChanged(initialState) {
            var previousState = initialState;
            return function storeSubscription() {
                var newState = store.getState();
                if (newState !== previousState) {
                    var diff = jsonpatch.compare(previousState, newState);
                    if (diff && diff.length) {
                        previousState = newState;
                        dispatchMain('reduxStoreAction', {
                            action: {
                                type: 'STATE_APPLY_DIFF',
                                payload: diff,
                                meta: {
                                    originator: 'webworker'
                                }
                            }
                        })
                    }
                }
            }
        }
    })
})(this)
