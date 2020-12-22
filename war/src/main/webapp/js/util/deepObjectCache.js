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

    // WeakMap API, but for storing value types
    function ValueMap() {
        this.map = {};
    }
    ValueMap.prototype.get = function(key) {
        return this.map[key];
    }
    ValueMap.prototype.set = function(key, value) {
        this.map[key] = value;
    }
    ValueMap.prototype.delete = function(key) {
        delete this.map[key];
    }

    DeepObjectCache.prototype.getOrUpdate = getOrUpdate;
    DeepObjectCache.prototype.clear = clear;

    return DeepObjectCache;

    /*
     * Cache that uses weak maps to cache results of functions given object
     * arguments.
     *
     * Useful for caching calls to registry extension functions given arguments.
     *
     * Arguments can be objects, or primitives (strings, numbers, booleans.)
     *
     * Input objects must be immutable otherwise changes won't be detected /
     * reevaluated. Comparisons are done using `===`, not `_.isEqual`.
     *
     *  var c = new DeepObjectCache();
     *  c.getOrUpdate(expensiveFn, input1, input2);
     *  c.clear()
     *  // Calls expensiveFn(input1, input2) once until inputs or arity changes
     */
    function DeepObjectCache() {
        if (this === window) throw new Error('Must instantiate cache with new')
    }

    function clear() {
        if (this.rootMap) {
            this.rootMap = null;
        }
    }

    function getOrUpdate(fn, ...args) {
        if (!_.isFunction(fn)) throw new Error('fn must be a function');
        if (!args.length) throw new Error('Must have at least one argument');

        if (!this.rootMap) this.rootMap = createCache(args[0]);

        return _getOrUpdate(this.rootMap, [fn, ...args], reevaluate)

        function reevaluate() {
            return fn.apply(null, args);
        }
    }

    function isCache(obj) {
        return obj instanceof WeakMap || obj instanceof ValueMap;
    }

    function createCache(obj) {
        return _.isObject(obj) && !_.isString(obj) ? new WeakMap() : new ValueMap();
    }

    function _getOrUpdate(cache, keyObjects, reevaluate) {
        if (keyObjects.length === 0) {
            return cache
        }

        const nextKey = keyObjects.shift();
        let nextObject = cache.get(nextKey);
        if (nextObject) {
            // Check for arity changes and clear
            if (nextObject instanceof WeakMap && keyObjects.length === 0) {
                nextObject = reevaluate();
            } else if (!isCache(nextObject) && keyObjects.length) {
                cache.delete(nextKey)
                nextObject = createCache(nextKey);
            }
        } else {
            nextObject = keyObjects.length ? createCache(keyObjects[0]) : reevaluate();
        }

        cache.set(nextKey, nextObject);

        return _getOrUpdate(nextObject, keyObjects, reevaluate);
    }
})
