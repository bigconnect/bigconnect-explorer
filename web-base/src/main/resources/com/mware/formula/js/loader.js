
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

// Global Mocks
$ = function() {
    return { on: function() {} };
};
$.extend = _.extend;
window = this;
document = {};
navigator = { userAgent: ''};
bcData = publicData = { currentWorkspaceId: 'WORKSPACE_ID' };
console = {
    log: print,
    info: print,
    debug: print,
    warn: consoleWarn,
    error: consoleError
};
window.addEventListener = function() { };
window.bcEnvironment = { dev: false, prod: true };
require.config({
    baseUrl: '',
    paths: {
        // LIBS
        'chrono': '../libs/chrono.min',
        'sf': '../libs/sf',
        'timezone-js': '../libs/date',
        'underscore': '../libs/underscore',
        'bluebird': '../libs/promise-6.0.0',
        'duration-js': '../libs/duration',
        'moment': '../libs/moment-with-locales',
        'moment-timezone': '../libs/moment-timezone-with-data',
        'weak-map': '../libs/weakmap',

        // MOCKS
        'jquery': 'mocks/jquery',
        'jstz': 'mocks/jstz',
        'util/withDataRequest': 'mocks/withDataRequest',
        'util/ajax': 'mocks/ajax',
        'util/memoize': 'mocks/memoize',
        'configuration/plugins/registry': 'mocks/registry',
        'store': 'mocks/store',
        'reselect': 'mocks/reselect',

        // SRC
        'util/formatters': 'util_formatters',
        'util/promise': 'util_promise',
        'util/messages': 'util_messages',
        'util/parsers': 'util_parsers',
        'util/requirejs/promise': 'util_requirejs_promise',
        'util/service/messagesPromise': 'util_service_messagesPromise',
        'util/service/ontologyPromise': 'util_service_ontologyPromise',
        'util/service/propertiesPromise': 'util_service_propertiesPromise',
        'util/vertex/formatters': 'util_vertex_formatters',
        'util/vertex/formula': 'util_vertex_formula',
        'util/vertex/urlFormatters': 'util_vertex_urlFormatters',
        'service/config': 'service/config',
        'data/web-worker/store/ontology/selectors': 'store_ontology_selectors'
    },
    shims: {
        'bluebird': { exports: 'Promise' },
        'util/vertex/formatters': { deps: ['util/promise'] }
    }
});

var timerLoop = makeWindowTimer(this, function () { });

require(['util/promise', 'weak-map'], function(Promise) {
    bcData.storePromise = new Promise(function(r) {
        require(['store'], function(_store) {
            r(_store.getStore())
        })
    })
    define('util/visibility/util', [], {});

    require(['util/vertex/formatters'], function(F) {
        var createFunction = function(name) {
            return function(json) {
                return F.vertex[name](JSON.parse(json));
            }
        };

        window.evaluateTitleFormulaJson = createFunction('title');
        window.evaluateTimeFormulaJson = createFunction('time');
        window.evaluateSubtitleFormulaJson = createFunction('subtitle');
        window.evaluatePropertyFormulaJson = function(json, propertyKey, propertyName) {
            return F.vertex['prop'](JSON.parse(json), propertyName, propertyKey);
        }
    });
});

timerLoop();

