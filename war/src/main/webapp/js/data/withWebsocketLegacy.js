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

    return withLegacyWebsocket;

    function withLegacyWebsocket() {

        this.websocketNotSupportedInWorker = function() {
            var self = this,
                config = this.getAtmosphereConfiguration(),
                atmospherePromise = Promise.all([
                    Promise.require('atmosphere'),
                    new Promise(function(fulfill, reject) {
                        if (bcData.currentUser) return fulfill();
                        self.on('applicationReady currentUserBCDataUpdated', fulfill);
                    })
                ]).then(function(result) {
                    var atmosphere = result.shift();
                    return new Promise(function(fulfill, reject) {
                        var socket = atmosphere.subscribe(_.extend(config, {

                            // Remember to also Change
                            // web-worker/handlers/atmosphereConfiguration
                            onOpen: function() {
                                fulfill(socket);
                            },
                            onError: function(request) {
                                self.websocketStateOnError({
                                    reason: request.reasonPhrase,
                                    error: request.error
                                });
                            },
                            onClose: function(request) {
                                self.websocketStateOnClose({
                                    reason: request.reasonPhrase,
                                    error: request.error
                                });
                            },
                            onMessage: function(response) {
                                self.worker.postMessage({
                                    type: 'websocketMessage',
                                    responseBody: response.responseBody
                                });
                            }
                        }));
                    });
                });

            this.trigger('websocketNotSupportedInWorker');
            
            this.around('pushSocket', function(push, message) {
                atmospherePromise.then(function(socket) {
                    var string = JSON.stringify(_.extend({}, message, {
                        sourceGuid: bcData.socketSourceGuid
                    }));
                    socket.push(string);
                })
            });

            this.websocketLegacyClose = function() {
                atmospherePromise.then(function(socket) {
                    socket.close();
                });
            };

            this.websocketFromWorker = function(message) {
                if (message && message.message) {
                    Promise.all([
                        atmospherePromise,
                        Promise.require('util/websocket')
                    ]).then(function(r) {
                        var socket = r[0],
                            websocketUtils = r[1];

                        websocketUtils.pushDataToSocket(socket, bcData.socketSourceGuid, message.message);
                    });
                }
            }
        }

    }
});
