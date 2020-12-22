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

/*eslint strict:0 */
(function(global) {
    define('wait-for-webworker-plugins', [], function() {
        return global.pluginsLoaded.promise;
    })

    if (!global.pluginsLoaded.isFinished()) {
        console.error(
            `Web worker plugins should not require the store using requirejs.  Please check any plugins that require "data/web-worker/store" and replace with "publicData.storePromise"

For example:

    define([
        'data/web-worker/store' //Remove this
    ], function(store) {

        // Add this
        publicData.storePromise.then(store => {
            ...
        })
    })`);
        console.error('BigConnect Explorer is deadlocked until circular dependency is resolved.')
    }

    define([
        'configuration/plugins/registry',
        'redux',
        'util/requirejs/promise!wait-for-webworker-plugins',

        // Reducers
        './configuration/reducer',
        './element/reducer',
        './ontology/reducer',
        './product/reducer',
        './screen/reducer',
        './selection/reducer',
        './undo/reducer',
        './user/reducer',
        './workspace/reducer',
        './ingest/reducer'

        // Add reducers above, the name of the function will be used as the key
    ], function(registry, redux, pluginsFinished, ...reducers) {

        registry.markUndocumentedExtensionPoint('org.bigconnect.store');

        const composeReducers = (reducers) => {
            return (state, payload) => {
                return reducers.reduce((previous, fn) => {
                    const returnedState = fn(previous, payload);
                    if (!returnedState) {
                        console.warn('No state returned from reducer, ignoring', fn);
                        return previous;
                    }
                    return returnedState;
                }, state)
            }
        }
        const reducerExtensions = registry.extensionsForPoint('org.bigconnect.store');
        const reducersByKey = _.groupBy(reducerExtensions, 'key');
        const baseReducers = _.object(
            reducers.map(reducerFn => {
                const { name } = reducerFn;
                if (_.isUndefined(name)) {
                    throw new Error('Undefined name for reducer: ' + reducerFn);
                }
                if (name in reducersByKey) {
                    const reducers = _.pluck(reducersByKey[name], 'reducer');
                    reducers.splice(0, 0, reducerFn);
                    delete reducersByKey[name];
                    return [name, composeReducers(reducers)]
                }

                return [name, reducerFn]
            })
        );
        const rootExtensions = reducersByKey[undefined];
        const rootReducerExtensions = rootExtensions ? _.pluck(rootExtensions, 'reducer') : [];
        delete reducersByKey[undefined];

        const reducerMap = redux.combineReducers({
            ...baseReducers,
            ..._.mapObject(reducersByKey, extensions => {
                const reducers = extensions.map(e => e.reducer)
                return reducers.length === 1 ? reducers[0] : composeReducers(reducers)
            })
        });

        return composeReducers([reducerMap, ...rootReducerExtensions]);
    });
})(this);
