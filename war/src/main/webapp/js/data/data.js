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
define([
    'flight/lib/component',
    './withReduxStore',
    './withPublicApi',
    './withBrokenWorkerConsole',
    './withDataRequestHandler',
    './withCurrentUser',
    './withDocumentCopyText',
    './withWebsocket',
    './withWebsocketLegacy',
    './withKeyboardRegistration',
    './withObjectSelection',
    './withObjectsUpdated',
    './withClipboard',
    './withWorkspaces',
    './withSessionTimeout'
], function(
    defineComponent,
    ...mixins
) {

    var PATH_TO_WORKER = 'jsc/data/web-worker/data-worker.js';

    return defineComponent.apply(null, [Data].concat(mixins));

    function Data() {

        this.after('initialize', function() {
            var self = this;

            this.setupDataWorker();

            this.dataRequestPromise = new Promise(function(fulfill, reject) {
                    if (self.bcData.readyForDataRequests) {
                        fulfill();
                    } else {
                        var timer = _.delay(reject, 10000);
                        self.on('readyForDataRequests', function readyForDataRequests() {
                            if (timer) {
                                clearTimeout(timer);
                            }
                            fulfill();
                            self.off('readyForDataRequests', readyForDataRequests);
                        });
                    }
                }).then(function() {
                    return Promise.require('util/withDataRequest');
                }).then(function(withDataRequest) {
                    return withDataRequest.dataRequest;
                });

            this.messagesPromise = this.dataRequestPromise.then(function() {
                    return Promise.require('util/messages');
                }).then(this.setupMessages.bind(this));

            if (typeof DEBUG !== 'undefined') {
                DEBUG.logCacheStats = function() {
                    self.worker.postMessage({
                        type: 'postCacheStats'
                    });
                }
            }
        });

        this.setupMessages = function(i18n) {
            window.i18n = i18n;
            return i18n;
        };

        this.setupDataWorker = function() {
            this.worker = new Worker(PATH_TO_WORKER + '?' + bcCacheBreaker);
            this.worker.postMessage(JSON.stringify({
                cacheBreaker: bcCacheBreaker,
                webWorkerResources: bcPluginResources.webWorker,
                environment: bcEnvironment
            }));
            this.worker.onmessage = this.onDataWorkerMessage.bind(this);
            this.worker.onerror = this.onDataWorkerError.bind(this);
        };

        this.onDataWorkerError = function(event) {
            console.error('data-worker error', event);
        };

        this.onDataWorkerMessage = function(event) {
            var data = event.data;

            if (_.isArray(data)) {
                data.forEach(this.processWorkerMessage.bind(this));
            } else {
                this.processWorkerMessage(data);
            }
        };

        this.processWorkerMessage = function(message) {
            if (message.type && (message.type in this)) {
                this[message.type](message);
            } else {
                console.warn('Unhandled message from worker', message);
            }
        }
    }
});
