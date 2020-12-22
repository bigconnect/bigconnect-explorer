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

    var CACHES = {
        ontology: null
    };
    var FAST_PASSED = {
        'ontology/ontology': null,
        'ontology/properties': null,
        'ontology/relationships': null,
        'config/properties': null,
        'config/messages': null
    };

    return withDataRequestHandler;

    function fixParameter(obj) {
        if (obj instanceof FileList) {
            return _.map(obj, function(o) {
                return o;
            });
        }

        return obj;
    }

    function deferred() {
        var resolve, reject, promise = new Promise((f, r) => { resolve = f; reject = r; });
        return { promise, resolve, reject };
    }


    function checkForFastPass(message) {
        var path = message.originalRequest.service + '/' + message.originalRequest.method;
        if (FAST_PASSED[path]) {
            // Wrap ontology objects with getter that uses the latest ontology
            if (path === 'ontology/ontology') {
                CACHES.ontology = message.result;
                message.result = {
                    concepts: wrap(CACHES.ontology.concepts, 'ontology', 'concepts'),
                    properties: wrap(CACHES.ontology.properties, 'ontology', 'properties'),
                    relationships: wrap(CACHES.ontology.relationships, 'ontology', 'relationships')
                };
            }
            FAST_PASSED[path].resolve(message);
        }
    }

    function wrap(obj, ...paths) {
        var wrappedObj = {};
        Object.keys(obj).forEach(key => {
            Object.defineProperty(wrappedObj, key, {
                get: function() {
                    var latest = CACHES;
                    paths.forEach(p => {
                        latest = latest[p];
                    })
                    return latest[key];
                },
                enumerable: true
            });
        })
        return wrappedObj;
    }

    function withDataRequestHandler() {

        this.after('initialize', function() {
            this.on('dataRequest', this.handleDataRequest);
            this.on('dataRequestCancel', this.handleDataRequestCancel);
            this.bcData.readyForDataRequests = true;
            this.trigger('readyForDataRequests');
        });

        this.handleDataRequestCancel = function(event, data) {
            // TODO
            //this.worker.postMessage({
                //type: 'cancelDataRequest',
                //data: data
            //});
        };

        this.handleDataRequest = function(event, data) {
            var self = this;

            this.trigger('dataRequestStarted', _.pick(data, 'requestId'));

            if (data.parameters) {
                data.parameters = _.map(data.parameters, fixParameter);
            }
            if (data && data.service === 'config') {
                var l = {};
                if (typeof localStorage !== 'undefined') {
                    l.language = localStorage.getItem('language');
                    l.country = localStorage.getItem('country');
                    l.variant = localStorage.getItem('variant');
                    data.parameters.push(l);
                }
            }
            var message = { type: event.type, data };

            if (!this.fastPassNoWorker(message)) {
                this.worker.postMessage(message);
            }
        };

        this.dataRequestCompleted = function(message) {
            checkForFastPass(message);
            this.trigger(message.type, message);
        };

        this.dataRequestProgress = function(message) {
            this.trigger(message.type, message);
        };

        this.fastPassNoWorker = function(message) {
            const self = this;
            const path = message.data.service + '/' + message.data.method;
            if (path in FAST_PASSED) {
                if (FAST_PASSED[path]) {
                    FAST_PASSED[path].promise.then(r => {
                        this.trigger(r.type, { ...r, requestId: message.data.requestId });
                    })
                    return true;
                } else {

                    // Special case check for properties/relationship request and
                    // resolve using ontology if already requested
                    if (message.data.service === 'ontology' && (
                            message.data.method === 'properties' || message.data.method === 'relationships'
                        )) {
                        const ontologyPath = 'ontology/ontology';
                        const existing = FAST_PASSED[ontologyPath] && FAST_PASSED[ontologyPath].promise;
                        let ontologyPromise;
                        if (existing) {
                            ontologyPromise = new Promise((fulfill) => {
                                this.on('ontologyUpdated', onOntologyUpdated);

                                Promise.resolve(existing).then(result => {
                                    this.off('ontologyUpdated', onOntologyUpdated);
                                    fulfill(result);
                                });

                                function onOntologyUpdated(event, data) {
                                    self.off('ontologyUpdated', onOntologyUpdated);

                                    const completed = {
                                        success: true,
                                        type: 'dataRequestCompleted',
                                        result: data.ontology,
                                        originalRequest: {
                                            method: 'ontology',
                                            service: 'ontology',
                                            parameters: []
                                        }
                                    };

                                    fulfill(completed);
                                }
                            })
                        } else {
                            ontologyPromise = this.refreshOntology();
                        }

                        Promise.resolve(ontologyPromise).then(r => {
                            this.trigger(r.type, {
                                ...r,
                                result: r.result[message.data.method],
                                requestId: message.data.requestId
                            });
                        })
                        return true;
                    }
                    FAST_PASSED[path] = deferred();
                }
            }
            return false;
        }

        this.refreshOntology = function() {
            return this.dataRequestPromise
                .then(dr => dr('ontology', 'ontology'))
                    .then(ontology => {
                        return FAST_PASSED['ontology/ontology'].promise;
                    });
        };

        this.dataRequestFastPassClear = function(message) {
            var ontologyCleared = false;
            message.paths.forEach(function(path) {
                ontologyCleared = ontologyCleared || (path.indexOf('ontology') === 0)
                FAST_PASSED[path] = null;
            })

            if (ontologyCleared) {
                this.refreshOntology().then(ontologyRequest => {
                    /**
                     * Triggered when the ontology is modified, either by changing the
                     * case or something was published.
                     *
                     * Listen to this event to be notified and update views
                     * that might be using the ontology.
                     *
                     * @global
                     * @event ontologyUpdated
                     * @property {object} data
                     * @property {object} data.ontology
                     * @example <caption>From Flight</caption>
                     * this.on(document, 'ontologyUpdated', function(event, data) {
                     *     console.log('Ontology:', data.ontology);
                     * })
                     * @example <caption>Anywhere</caption>
                     * $(document).on('ontologyUpdated', function(event, data) {
                     *     console.log('Ontology:', data.ontology);
                     * })
                     */
                    this.trigger('ontologyUpdated', { ontology: ontologyRequest.result });
                })
            }
        };

    }
});
