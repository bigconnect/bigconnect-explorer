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
define(['flight/lib/registry', 'jquery'], function(registry) {
    'use strict';

    $.fn.lookupComponent = function(instanceConstructor) {
        return _lookupComponent(this[0], instanceConstructor);
    };

    $.fn.lookupAllComponents = function(instanceConstructor) {
        var instances = [],
            results = registry.findInstanceInfoByNode(this[0]);

        for (var i = 0; i < results.length; ++i) {
            var instance = results[i].instance;
            instances.push(instance);
        }

        return instances;
    };

    $.fn.teardownComponent = function(instanceConstructor) {
        return this.each(function() {
            var instance = _lookupComponent(this, instanceConstructor);
            if (instance) {
                instance.teardown();
            }
        });
    };

    $.fn.teardownAllExcept = function(instanceConstructor) {
        return this.each(function() {
            $(this).lookupAllComponents().forEach(function(instance) {
                if (instance.constructor !== instanceConstructor) {
                    instance.teardown();
                }
            })
        });
    };

    $.fn.lookupAllComponentsWithMixin = function(Mixin) {
        var instances = [],
            results = registry.findInstanceInfoByNode(this[0]);

        for (var i = 0; i < results.length; ++i) {
            var instance = results[i].instance;
            if (instance.mixedIn) {
                for (var j = 0; j < instance.mixedIn.length; j++) {
                    if (instance.mixedIn[j] === Mixin) {
                        instances.push(instance);
                        break;
                    }
                }
            }
        }

        return instances;
    };

    $.fn.teardownAllComponentsWithMixin = function(Mixin) {
        this.lookupAllComponentsWithMixin(Mixin).forEach(function(i) {
            i.teardown();
        });

        return this;
    };

    $.fn.teardownAllComponents = function() {
        return this.each(function() {
            var results = registry.findInstanceInfoByNode(this);
            for (var i = 0; i < results.length; ++i) {
                results[i].instance.teardown();
            }
        })
    };

    function _lookupComponent(elem, instanceConstructor) {
        var results = registry.findInstanceInfoByNode(elem);
        for (var i = 0; i < results.length; ++i) {
            if (results[i].instance.constructor === instanceConstructor) {
                return results[i].instance;
            }
        }
        return false;
    }

});
