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

    var globals = [
        {
            name: 'enableLiveReload',
            description: 'Enable liveReload when `grunt` is running, (persisted)',
            preferenceKey: 'liveReloadEnabled',
            value: function(enable) {
                if ('localStorage' in window) {
                    if (enable === true || typeof enable === 'undefined') {
                        console.debug('Enabling LiveReload...')
                        const host = location.host.replace(/:.*$/, '');
                        require([`//${host}:35728/livereload.js`], function() {
                            console.debug('LiveReload successfully enabled');
                        }, function() {
                            console.warn(`Failed to enable LiveReload, check that grunt is running and you may also need to update the content security policy:
                            web.response.header.Content-Security-Policy.script-src.append=https://${host}:35728
                            web.response.header.Content-Security-Policy.connect-src.append=wss://${host}:35728
                            `);
                        });
                        localStorage.setItem('liveReloadEnabled', true);
                    } else {
                        console.debug('Disabling LiveReload')
                        localStorage.removeItem('liveReloadEnabled');
                    }
                }
            }
        },

        {
            name: 'enableGraphTracing',
            description: 'Enable Graph Engine graph performance tracing',
            value: function(enable) {
                $(document).trigger('setPublicApi', { key: 'graphTraceEnable', obj: enable });
            }
        },

        {
            name: 'switchLanguage',
            description: 'Switch UI message bundle language: [en,es,de,fr,it,zh_TW] (persisted)',
            value: function(code) {
                if (!code) {
                    code = 'en';
                }
                var availableLocales = 'en es de fr it zh_TW'.split(' ');

                if (~availableLocales.indexOf(code)) {
                    var parts = code.split('_');
                    if (parts[0]) {
                        localStorage.setItem('language', parts[0]);
                    }
                    if (parts[1]) {
                        localStorage.setItem('country', parts[1]);
                    }
                    if (parts[2]) {
                        localStorage.setItem('variant', parts[2]);
                    }
                    location.reload();
                } else console.error('Available Locales: ' + availableLocales.join(', '));
            }
        },

        {
            name: 'enableComponentHighlighting',
            description: 'Enable component highlighting by mouse movement',
            value: function(enable) {
                require(['util/flight/componentHighlighter'], function(c) {
                    c.highlightComponents(enable);
                });
            }
        },

        {
            name: 'showReduxStore',
            description: 'Displays the content of the redux store',
            value: function() {
                bcData.storePromise.then(store => {
                    console.log(store.getState());
                })
            }
        }
    ];

    globals.forEach(function(global) {
        window[global.name] = global.value;

        if ('localStorage' in window) {
            if (global.preferenceKey &&
                localStorage.getItem(global.preferenceKey) &&
               _.isFunction(global.value)) {
                global.value(true);
            }
        }
    });

    var helpName = 'help';
    if (typeof window.help !== 'undefined') {
        helpName = 'bcHelp';
        console.warn('Unable to create console help, already exists. Using bcHelp');
    }

    window[helpName] = function() {
        console.group('BigConnect Explorer Help');
            console.info('Descriptions of some of the debugging and global state objects');
            console.group('Global Helper Functions')
                _.sortBy(globals, 'name').forEach(function(global) {
                    console.log(global.name + ': ' + global.description);
                })
            console.groupEnd();
            console.group('Global Objects')
            console.log('bcData: ' + 'Only Shared Global State');
            console.log('\t.currentUser: ' + 'Current user object');
            console.log('\t.currentWorkspaceId: ' + 'Current workspaceId');
            console.log('\t.selectedObjects: ' + 'Current object selection');
            console.log('\t\t.vertices: ' + 'Selected vertices');
            console.log('\t\t.vertexIds: ' + 'Selected vertexIds');
            console.log('\t\t.edges: ' + 'Selected edges');
            console.log('\t\t.edgeIds: ' + 'Selected edgeIds');
            console.groupEnd();
        console.groupEnd();
    }
})
