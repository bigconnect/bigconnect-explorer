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
var toString = Object.prototype.toString;

function isString(obj) {
    return toString.call(obj) === "[object String]";
}

function isNumber(obj) {
    return toString.call(obj) === "[object Number]";
}

/**
 * inlined Object.is polyfill to avoid requiring consumers ship their own
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
 */
function is(x, y) {
    // SameValue algorithm
    if (x === y) {
        // Steps 1-5, 7-10
        // Steps 6.b-6.e: +0 != -0
        return x !== 0 || 1 / x === 1 / y;
    } else {
        // Step 6.a: NaN == NaN
        /* eslint no-self-compare: 0 */
        return x !== x && y !== y;
    }
}

function isFuzzy(x, y) {
    /* eslint eqeqeq: 0 */
    if (x == y) {
        if ((isString(x) || isNumber(x)) && (isString(y) || isNumber(y))) {
            return true;
        }
    }
    return is(x, y);
}

var hasOwnProperty = Object.prototype.hasOwnProperty;

// custom algoritm from https://github.com/facebook/fbjs
// fbjs/lib/shallowEqual
function shallowEqualFuzzy(objA, objB) {
    if (isFuzzy(objA, objB)) {
        return true;
    }

    if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) {
        return false;
    }

    if (objA instanceof Array && objB instanceof Array) {
        if (objA.length !== objB.length) {
            return false;
        }
        // greed search
        var valA, iLen = objA.length;
        var equalityMap = new Array(iLen);
        for (var i = 0; i < iLen; i++) {
            valA = objA[i];
            if (shallowEqualFuzzy(valA, objB[i])) {
                // elements in array in normal order
                equalityMap[i] = true;
                continue;
            }

            // elements in array have different order
            var isEqual = false;
            for (var k = 0, kLen = objB.length; k < kLen; k++) {
                if (equalityMap[k]) {
                    continue;
                }
                if (shallowEqualFuzzy(valA, objB[k])) {
                    equalityMap[k] = true;
                    isEqual = true;
                    break;
                }
            }
            if (!isEqual) {
                return false;
            }
        }
        return true;
    }

    var keysA = Object.keys(objA);
    var keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) {
        return false;
    }

    for (var j = 0; j < keysA.length; j++) {
        if (!hasOwnProperty.call(objB, keysA[j]) ||
            !shallowEqualFuzzy(objA[keysA[j]], objB[keysA[j]])) {
            return false;
        }
    }
    return true;
}
