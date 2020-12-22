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

/**
 * Add some promise helpers, done, finally, and progress
 *
 * Example:
 *
 *  var p = new Promise(function(f, r) {
 *      var duration = 4,
 *          startTime = Date.now(),
 *          t = setInterval(function() {
 *              var now = Date.now(),
 *                  dt = (now - startTime) / (duration * 1000);

 *              if (dt < 1.0) {
 *                  f.updateProgress(dt);
 *              } else {
 *                  f(true)
 *              }
 *          }, 16);
 *  }).progress(function(percent) {
 *      console.log('Updated', percent);
 *  }).then(function() {
 *      console.log('finished');
 *  }).finally(function() {
 *      console.log('finally')
 *  })
 */
(function(global) {
    'use strict';

    define([
        'bluebird',
        'underscore'
    ], function(P, _) {

        var Promise = P || global.Promise;

        if (P) {
            Promise.config({
                cancellation: true,
                longStackTraces: bcEnvironment ? bcEnvironment.dev : false,
                warnings: {
                    wForgottenReturn: false
                }
            });
        }

        addProgress();
        addTimeout();
        addRequire();
        registerUnhandledRejection();

        global.Promise = Promise;
        return Promise;

        /*eslint no-extend-native:off */
        function addProgress() {
            if (typeof Promise.prototype.progress !== 'function') {
                Promise.prototype.progress = function(progress) {
                    this._progressCallbacks = this._progressCallbacks || [];
                    this._progressCallbacks.push(progress);
                    return this;
                };
            } else console.warn('Native implementation of progress');

            // Wrap Promise constructor to add progress support
            var OldPromise = Promise;
            Promise = function(callback) {

                var reject,
                    that = new OldPromise(function() {
                    // Update progress is a function on fulfill function
                    var f = arguments[0];
                    f.updateProgress = updateProgress;

                    callback.apply(null, arguments);
                });

                that
                    .then(function() {
                        updateProgress(1);
                    })
                    .catch(function() {});

                return that;

                function updateProgress(percent) {
                    if (that._progressCallbacks) {
                        that._progressCallbacks.forEach(function(c) {
                            c(percent || 0);
                        })
                    }
                }
            }

            Promise.all = OldPromise.all;
            Promise.map = OldPromise.map;
            Promise.race = OldPromise.race;
            Promise.reject = OldPromise.reject;
            Promise.resolve = OldPromise.resolve;
            Promise.try = OldPromise.try;
            Promise.prototype = OldPromise.prototype;
        }

        function addTimeout() {
            if (typeof Promise.timeout !== 'function') {
                Promise.timeout = function(millis) {
                    return new Promise(function(fulfill) {
                        setTimeout(fulfill, millis);
                    });
                }
            } else console.warn('Native implementation of timeout');
        }

        function addRequire() {
            if (typeof Promise.prototype.require !== 'function') {
                Promise.require = function() {
                    var deps = Array.prototype.slice.call(arguments, 0);

                    return new Promise(function(fulfill, reject, onCancel) {
                        onCancel(function() {
                        })
                        require(_.filter(deps, _.isString), fulfill, reject);
                    });
                };
            } else console.warn('Native implementation of require');
        }

        function registerUnhandledRejection() {
            global.addEventListener('unhandledrejection', function(e) {
                // See Promise.onPossiblyUnhandledRejection for parameter documentation
                e.preventDefault();
                // Causes better stack traces (source map support) over console.log
                if (e && e.detail && e.detail.reason) throw e.detail.reason;
                else if (e && e.reason) throw e.reason;
                else throw e;
            });
        }

    });
})(this);
