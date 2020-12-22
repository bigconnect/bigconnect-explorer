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
define(['util/websocket'], function(websocketUtils) {
    'use strict';

    return withWebsocket;

    function withWebsocket() {

        var overlayPromise = new Promise(function(fulfill, reject) {
            this.after('initialize', function() {
                this.on('applicationReady currentUserBCDataUpdated', function() {
                    _.defer(function() {
                        Promise.require('util/offlineOverlay').done(fulfill);
                    })
                })
            })
        }.bind(this));

        this.after('initialize', function() {
            var self = this;
            this.on('applicationReady currentUserBCDataUpdated', function() {
                if (!bcData.socketSourceGuid) {
                    self.setPublicApi('socketSourceGuid', websocketUtils.generateSourceGuid());
                    self.worker.postMessage({
                        type: 'atmosphereConfiguration',
                        configuration: this.getAtmosphereConfiguration()
                    })
                }
            });

            this.on('willLogout', function() {
                this.worker.postMessage({
                    type: 'atmosphereConfiguration',
                    close: true
                })
            })
            this.on(window, 'offline', this.onWebsocketDisconnect);
            this.on('websocketNotSupportedInWorker', () => {
                this.off(window, 'offline', this.onWebsocketDisconnect);
            });

            if (window.DEBUG) {
                DEBUG.pushSocket = this.pushSocket.bind(this);
            }
        });

        this.pushSocket = function(message) {
            this.worker.postMessage({
                type: 'websocketSend',
                message: message
            });
        };

        this.rebroadcastEvent = function(message) {
            this.trigger(message.eventName, message.data);
        };

        this.getAtmosphereConfiguration = function() {
            // https://github.com/Atmosphere/atmosphere/wiki/atmosphere.js-API#attributes
            return {
                url: location.origin + location.pathname.replace(/jsc.*$/, '') + 'messaging',
                transport: 'websocket',
                fallbackTransport: 'long-polling',
                contentType: 'application/json',
                trackMessageLength: true,
                suspend: true,
                shared: false,
                pollingInterval: 5000,
                connectTimeout: -1,
                enableProtocol: true,
                maxReconnectOnClose: 2,
                maxStreamingLength: 2000,
                logLevel: 'warn'
            };
        };

        this.websocketStateOnError = function(error) {
            this.onWebsocketDisconnect();
        };

        this.websocketStateOnClose = function(message) {
            if (message && message.error) {
                console.error('Websocket closed', message.reasonPhrase, message.error);
            } else {
                console.error('Websocket closed', message.status)
            }
        };

        this.onWebsocketDisconnect = function() {
            overlayPromise.done(function(Overlay) {
                // Might be closing because of browser refresh, delay
                // so it only happens if server went down
                _.delay(function() {
                    Overlay.attachTo(document);
                }, 1000);
            });
        };
    }
});
