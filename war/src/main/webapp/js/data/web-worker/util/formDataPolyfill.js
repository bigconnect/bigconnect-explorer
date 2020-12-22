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

/*
 * FormData for XMLHttpRequest 2  -  Polyfill for Web Worker
 * (c) 2014 Rob Wu <rob@robwu.nl>
 * License: MIT
 * - append(name, value[, filename])
 * - XMLHttpRequest.prototype.send(object FormData)
 *
 * Specification: http://www.w3.org/TR/XMLHttpRequest/#formdata
 *                http://www.w3.org/TR/XMLHttpRequest/#the-send-method
 * The .append() implementation also accepts Uint8Array and ArrayBuffer objects
 * Web Workers do not natively support FormData:
 *                http://dev.w3.org/html5/workers/#apis-available-to-workers
 * Originally released in 2012 as a part of http://stackoverflow.com/a/10002486.
 * Updates since initial release:
 * - Forward-compatibility by testing whether FormData exists before defining it.
 * - Increased robustness of .append.
 * - Allow any typed array in .append.
 * - Remove use of String.prototype.toString to work around a Firefox bug.
 * - Use typed array in xhr.send instead of arraybuffer to get rid of deprecation
 *   warnings.
 **/
/*eslint no-use-before-define:0, eqeqeq:0, curly:0, no-undef:0 */
(function(exports) {
    'use strict';
    if (exports.FormData) {
        // Don't replace FormData if it already exists
        return;
    }
    // Export variable to the global scope
    exports.FormData = function() {
        // Force a Constructor
        if (!(this instanceof FormData)) return new FormData();
        // Generate a random boundary - This must be unique with respect to the form's contents.
        this.boundary = '------RWWorkerFormDataBoundary' + Math.random().toString(36);
        var internalData = this.data = [];
        this.__append = function(inp) {
            var i = 0, len;
            if (typeof inp == 'string') {
                for (len = inp.length; i < len; ++i) {
                    internalData.push(inp.charCodeAt(i) & 0xff);
                }
            } else if (inp && inp.byteLength) {/*If ArrayBuffer or typed array */
                if (!('byteOffset' in inp))   /* If ArrayBuffer, wrap in view */
                    inp = new Uint8Array(inp);
                for (len = inp.byteLength; i < len; ++i) {
                    internalData.push(inp[i] & 0xff);
                }
            }
        };
    }

    var FormData = exports.FormData,
        ___send$rw = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(data) {
        if (data instanceof FormData) {
            if (!data.__endedMultipart) data.__append('--' + data.boundary + '--\r\n');
            data.__endedMultipart = true;
            this.setRequestHeader('Content-Type', 'multipart/form-data; boundary=' + data.boundary);
            data = new Uint8Array(data.data);
        }
        // Invoke original XHR.send
        return ___send$rw.call(this, (data && data.buffer) || data);
    };

    /**
    * @param name     String                                   Key name
    * @param value    String|Blob|File|typed array|ArrayBuffer Value
    * @param filename String                                   Optional File name (when value is not a string).
    **/
    FormData.prototype.append = function(name, value, filename) {
        if (this.__endedMultipart) {
            // Truncate the closing boundary
            this.data.length -= this.boundary.length + 6;
            this.__endedMultipart = false;
        }
        if (arguments.length < 2) {
            throw new SyntaxError('Not enough arguments');
        }
        var part = '--' + this.boundary + '\r\n' +
                'Content-Disposition: form-data; name="' + name + '"';

        if (value instanceof File || value instanceof Blob) {
            return this.append(name,
                            new Uint8Array(new FileReaderSync().readAsArrayBuffer(value)),
                            filename || value.name);
        } else if (typeof value.byteLength == 'number') {
            // Duck-typed typed array or array buffer
            part += '; filename="' + (filename || 'blob').replace(/"/g, '%22') + '"\r\n';
            part += 'Content-Type: application/octet-stream\r\n\r\n';
            this.__append(part);
            this.__append(value);
            part = '\r\n';
        } else {
            part += '\r\n\r\n' + value + '\r\n';
        }
        this.__append(part);
    };
})(this || self);
