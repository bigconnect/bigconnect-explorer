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

    return withDocumentUnloadHandlers;

    /**
     * Mixin that provides a window unload listener and manages
     * a priority sorted queue of callbacks to be applied.
     * If any of the callbacks return a String, the remaining
     * callbacks will not be executed and the user will be
     * propmted with that String.
     */
    function withDocumentUnloadHandlers() {
        var registeredHandlers = [],
            uniqueId = _.uniqueId();

        this.before('initialize', function() {
            $(document).on('registerBeforeUnloadHandler', this.onRegisterBeforeUnloadHandler);
            $(document).on('unregisterBeforeUnloadHandler', this.onUnregisterBeforeUnloadHandler);
            $(window).on('beforeunload.' + uniqueId, this.onDocumentUnload);
        });

        this.getUnloadHandlers = function() {
            return registeredHandlers;
        };

        this.clearUnloadHandlers = function() {
            registeredHandlers = [];
        };

        this.onDocumentUnload = function(evt) {
            var self = this,
                confirmationMessage;

            $.each(registeredHandlers, function(index, handler) {
                confirmationMessage = handler.fn.call(handler.scope || self, evt);
                return !_.isString(confirmationMessage);
            });

            if (_.isString(confirmationMessage)) {
                (evt || window.event).returnValue = confirmationMessage;   //Gecko + IE
                return confirmationMessage;                                //Webkit, Safari, Chrome etc.
            }
        };

        this.onRegisterBeforeUnloadHandler = function(event, data) {
            if ($.isFunction(data)) {
                data = { fn: data };
            }

            if (data) {
                data.priority = _.isNumber(data.priority) ? data.priority : Number.MAX_VALUE;

                registeredHandlers.push(data);
                registeredHandlers = _.chain(registeredHandlers)
                                            .uniq(false, _.property('fn'))
                                            .sortBy('priority')
                                            .value();
            }
        };

        this.onUnregisterBeforeUnloadHandler = function(event, data) {
            if (data && !$.isFunction(data)) {
                data = data.fn;
            }

            if (data) {
                var existingHandler = _.find(registeredHandlers, function(handler) {
                    return handler.fn === data;
                });

                if (existingHandler) {
                    registeredHandlers = _.without(registeredHandlers, existingHandler);
                }
            }
        };
    }
});
