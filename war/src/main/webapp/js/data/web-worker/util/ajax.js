
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

/*global File:false*/
define(['util/promise', './cancel'], function(Promise, cancelPreviousByHash) {
    'use strict';

    RequestFailed.prototype = Object.create(Error.prototype);

    return ajax;

    function RequestFailed({json, status = '', statusText = ''}) {
        this.json = json;
        this.status = status;
        this.statusText = statusText;
    }

    function paramPair(key, value) {
        return key + '=' + encodeURIComponent(value);
    }

    function isFile(params) {
        return params && (
            params instanceof FormData ||
            (params instanceof File) ||
            (params instanceof Blob) ||
            _.isArray(params)
        )
    }

    function toFileUpload(params) {
        if (params instanceof FormData) {
            return params;
        }
        var formData = new FormData();
        if (!_.isArray(params)) {
            params = [params];
        }
        params.forEach(function(file) {
            formData.append(file.name, file);
        });

        return formData;
    }

    function toQueryString(params) {
        var str = '', key;
        for (key in params) {
            if (typeof params[key] !== 'undefined') {

                // TODO: support fixing nested arrays
                if (_.isArray(params[key])) {
                    str += _.map(params[key], _.partial(paramPair, !(/\[\]$/).test(key) ? key + '[]' : key)).join('&') + '&';
                } else if (_.isObject(params[key])) {
                    str += paramPair(key, JSON.stringify(params[key])) + '&';
                } else {
                    str += paramPair(key, params[key]) + '&';
                }
            }
        }
        return str.slice(0, str.length - 1);
    }

    function ajax(method, url, parameters, { cancelHash } = {}, debugOptions) {
        var isJson = true,
            methodRegex = /^(.*)->HTML$/;
        method = method.toUpperCase();

        var matches = method.match(methodRegex);
        if (matches && matches.length === 2) {
            isJson = false;
            method = matches[1];
        }

        var finished = false,
            r = new XMLHttpRequest(),
            promise = new Promise(function(fulfill, reject, onCancel) {
                var progressHandler,
                    params = isFile(parameters) ? toFileUpload(parameters) : toQueryString(parameters),
                    resolvedUrl = BASE_URL + url + ((/GET|DELETE/.test(method) && parameters) ?
                        ('?' + params) : ''),
                    formData;

                onCancel(function() {
                    r.abort();
                });

                r.onload = function() {
                    finished = true;
                    try {
                        r.upload.removeEventListener('progress', progressHandler);
                    } catch(e) {}

                    if (r.status === 200) {
                        var text = r.responseText;
                        if (isJson) {
                            try {
                                var json = JSON.parse(text);
                                if (typeof ajaxPostfilter !== 'undefined') {
                                    ajaxPostfilter(r, json, {
                                        method: method,
                                        url: url,
                                        parameters: parameters
                                    });
                                }
                                fulfill(json);
                            } catch(e) {
                                reject(e);
                            }
                        } else {
                            fulfill(text)
                        }
                    } else {
                        if (r.responseText && (/^\s*{/).test(r.responseText)) {
                            try {
                                var errorJson = JSON.parse(r.responseText);
                                reject(new RequestFailed({ json: errorJson }));
                                return;
                            } catch(e) { /*eslint no-empty:0 */ }
                        }
                        const { status, statusText } = r;
                        reject(new RequestFailed({ status, statusText }))
                    }
                };
                r.onerror = function() {
                    finished = true;
                    try {
                        r.upload.removeEventListener('progress', progressHandler);
                    } catch(e) {}
                    reject(new Error('Network Error'));
                };
                r.open(method, resolvedUrl, true);

                // using try/catch here because I could not get feature detection to work in IE11
                try {
                    r.upload.addEventListener('progress', (progressHandler = function(event) {
                        if (event.lengthComputable) {
                            var complete = (event.loaded / event.total || 0);
                            if (complete < 1.0) {
                                fulfill.updateProgress(complete);
                            }
                        }
                    }), false);
                } catch(e) {}

                if (method === 'POST' && parameters) {
                    formData = params;
                    if (!(params instanceof FormData)) {
                        r.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                    }
                }

                if (debugOptions) {
                    console.warn('Request Debugging is set for ' + url)
                    if (debugOptions.error) {
                        r.setRequestHeader('BC-Request-Error', debugOptions.error);
                    }
                    if (debugOptions.errorJson) {
                        if (!debugOptions.errorJson.invalidValues) {
                            debugOptions.errorJson.invalidValues = [];
                        }
                        r.setRequestHeader('BC-Request-Error-Json', JSON.stringify(debugOptions.errorJson));
                    }
                    if (debugOptions.delay) {
                        r.setRequestHeader('BC-Request-Delay-Millis', debugOptions.delay);
                    }
                }

                if (typeof ajaxPrefilter !== 'undefined') {
                    ajaxPrefilter.call(null, r, method, url, parameters);
                }

                r.send(formData);
            });

        if (cancelHash) {
            cancelPreviousByHash(promise, cancelHash);
        }

        return promise;
    }
})
