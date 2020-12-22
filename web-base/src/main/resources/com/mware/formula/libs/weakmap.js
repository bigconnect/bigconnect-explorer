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

// https://gist.github.com/Gozala/1269991
/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true devel: true
         forin: false latedef: false */
/*global define: true */

if (typeof(WeakMap) === 'undefined') WeakMap = (function(global) {
  "use strict";

  function defineNamespace(object, namespace) {
    /**
    Utility function takes `object` and `namespace` and overrides `valueOf`
    method of `object`, so that when called with a `namespace` argument,
    `private` object associated with this `namespace` is returned. If argument
    is different, `valueOf` falls back to original `valueOf` property.
    **/

    // Private inherits from `object`, so that `this.foo` will refer to the
    // `object.foo`. Also, original `valueOf` is saved in order to be able to
    // delegate to it when necessary.
    var privates = Object.create(object), base = object.valueOf
    Object.defineProperty(object, 'valueOf', { value: function valueOf(value) {
      // If `this` or `namespace` is not associated with a `privates` being
      // stored we fallback to original `valueOf`, otherwise we return privates.
      return value != namespace || this != object ? base.apply(this, arguments)
                                                  : privates
    }, configurable: true })
    return privates
  }

  function Name() {
    /**
    Desugared implementation of private names proposal. API is different as
    it's not possible to implement API proposed for harmony with in ES5. In
    terms of provided functionality it supposed to be same.
    http://wiki.ecmascript.org/doku.php?id=strawman:private_names
    **/

    var namespace = {}
    return function name(object) {
      var privates = object.valueOf(namespace)
      return privates !== object ? privates : defineNamespace(object, namespace)
    }
  }

  function guard(key) {
    /**
    Utility function to guard WeakMap methods from keys that are not
    a non-null objects.
    **/

    if (key !== Object(key)) throw TypeError("value is not a non-null object")
    return key
  }

  function WeakMap() {
    /**
    Implementation of harmony `WeakMaps`, in ES5. This implementation will
    work only with keys that have configurable `valueOf` property (which is
    a default for all non-frozen objects).
    http://wiki.ecmascript.org/doku.php?id=harmony:weak_maps
    **/

    var privates = Name()

    return Object.freeze(Object.create(WeakMap.prototype, {
      has: {
        value: function has(object) {
          return 'value' in privates(object)
        },
        configurable: true,
        enumerable: false,
        writable: true
      },
      get: {
        value: function get(key, fallback) {
          return privates(guard(key)).value || fallback
        },
        configurable: true,
        enumerable: false,
        writable: true
      },
      set: {
        value: function set(key, value) {
          privates(guard(key)).value = value
        },
        configurable: true,
        enumerable: false,
        writable: true
      },
      'delete': {
        value: function set(key) {
          return delete privates(guard(key)).value
        },
        configurable: true,
        enumerable: false,
        writable: true
      }
    }))
  }

  return global.WeakMap = WeakMap
})(this)
