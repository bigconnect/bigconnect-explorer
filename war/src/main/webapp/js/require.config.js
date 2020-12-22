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
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.require = factory();
    }
}(this, function () {
    return {
        baseUrl: 'jsc',
        waitSeconds: 0,
        map: {
            '*': {
                'dot/doT': 'dot',
                'reselect': 'Reselect',
                'jquery-ui': 'jquery-ui-bundle',
                'jquery-ui/droppable': 'jquery-ui-bundle',
                'jquery-ui/core': 'jquery-ui-bundle',
                'jquery-ui/widget': 'jquery-ui-bundle',
                'jquery-ui/mouse': 'jquery-ui-bundle',
                'jquery-ui/resizable': 'jquery-ui-bundle',
                'jquery-ui/draggable': 'jquery-ui-bundle',
                'jquery-ui/data': 'jquery-ui-bundle',
                'jquery-ui/form': 'jquery-ui-bundle',
                'jquery-ui/ie': 'jquery-ui-bundle',
                'jquery-ui/labels': 'jquery-ui-bundle',
                'jquery-ui/unique-id': 'jquery-ui-bundle',
                'jquery-ui/version': 'jquery-ui-bundle',
                'jquery-ui/jquery-1-7': 'jquery-ui-bundle',
                'jquery-ui/plugin': 'jquery-ui-bundle',
                'jquery-ui/safe-blur': 'jquery-ui-bundle',
                'jquery-ui/safe-active-element': 'jquery-ui-bundle',
                'jquery-ui/scroll-parent': 'jquery-ui-bundle',
                'jquery-ui/tabbable': 'jquery-ui-bundle',
                'jquery-ui/keycode': 'jquery-ui-bundle',
                'jquery-ui/disable-selection': 'jquery-ui-bundle',
                'jquery-ui/focusable': 'jquery-ui-bundle',
                'jquery-ui/widgets/resizable': 'jquery-ui-bundle',
                'jquery-ui/widgets/mouse': 'jquery-ui-bundle',
                'jquery-ui/widgets/droppable': 'jquery-ui-bundle',
                'jquery-ui/widgets/draggable': 'jquery-ui-bundle',
                'prop-types': 'util/component/env-proptypes',
                'ol': 'openlayers',
                'React': 'react',
                'ReactDOM': 'react-dom',
                "video.js": "videojs",
            }
        },
        paths: {
            'antd': '../libs/antd/dist/antd.min',
            'antd-icons': '../libs/@ant-design/icons/dist/index.umd',
            'async': '../libs/requirejs-plugins/src/async',
            'atmosphere': '../libs/atmosphere.js/lib/atmosphere',
            'beautify': '../libs/js-beautify/js/lib/beautify',
            'block-ui': '../libs/block-ui/jquery.blockUI',
            'bootstrap': '../libs/bootstrap/dist/js/bootstrap.min',
            'bluebird': '../libs/bluebird/js/browser/bluebird.min',
            'chrono': '../libs/chrono-node/chrono.min',
            'classnames': '../libs/classnames/index',
            'colorjs': '../libs/color-js/color',
            'd3': '../libs/d3/d3.min',
            'd3-tip': '../libs/d3-tip/index',
            'd3-plugins': '../libs/d3-plugins-dist/dist/mbostock',
            'deep-freeze-strict': '../libs/amd-wrap/deep-freeze-strict/index',
            'duration-js': '../libs/duration-js/duration',
            'easing': '../libs/jquery.easing/jquery.easing.1.3',
            'ejs': '../libs/ejs/ejs',
            'flight': '../libs/flightjs/build/flight',
            'flight/lib': 'util/flight/compat',
            'filesaver': '../libs/file-saver/dist/FileSaver',
            'goog': '../libs/requirejs-plugins/src/goog',
            'gridstack': '../libs/gridstack/dist/gridstack.min',
            'gridstack-ui': '../libs/gridstack/dist/gridstack.jQueryUI.min',
            'hbs': 'util/requirejs/hbs-legacy-loader',
            'handlebars': '../libs/handlebars/dist/handlebars.amd.min',
            'jstz': '../libs/jstimezonedetect/dist/jstz.min',
            'jquery': '../libs/jquery/dist/jquery.min',
            'jquery-ui-bundle': '../bclibs/jquery-ui/jquery-ui.min',
            'jquery-scrollstop': '../libs/jquery-scrollstop/jquery.scrollstop.min',
            'jquery-query-builder': '../libs/jQuery-QueryBuilder/dist/js/query-builder',
            'jquery-extendext': '../libs/jquery-extendext/jQuery.extendext.min',
            'dot': '../libs/dot/doT.min',
            'jstree': '../bclibs/jstree/jstree.min',
            'jscache': '../bclibs/cache',
            'less': '../libs/requirejs-less/less',
            'lessc': '../libs/requirejs-less/lessc',
            'moment': '../libs/moment/min/moment-with-locales.min',
            'moment-timezone': '../libs/moment-timezone/builds/moment-timezone-with-data.min',
            'normalize': '../libs/requirejs-less/normalize',
            'openlayers': '../libs/openlayers/dist/ol-debug',
            'propertyParser': '../libs/requirejs-plugins/src/propertyParser',
            'urlPolyfill': '../libs/js-polyfills/url',
            'rangy-core': '../libs/rangy/lib/rangy-core',
            'rangy-text': '../libs/rangy/lib/rangy-textrange',
            'rangy-highlighter': '../libs/rangy/lib/rangy-highlighter',
            'rangy-cssclassapplier': '../libs/rangy/lib/rangy-classapplier',
            'rangy-serializer': '../libs/rangy/lib/rangy-serializer',

            // react section
            'react': '../libs/react/umd/react.production.min',
            'react-dom': '../libs/react-dom/umd/react-dom.production.min',
            'create-react-class': '../libs/create-react-class/create-react-class.min',
            'react-proptypes-dev': '../libs/prop-types/prop-types.min',
            'react-redux': '../libs/react-redux/dist/react-redux.min',
            'react-transition-group': '../libs/react-transition-group/dist/react-transition-group.min',
            'react-virtualized': '../libs/react-virtualized/dist/umd/react-virtualized',
            'react-virtualized-select': '../libs/react-virtualized-select/dist/umd/react-virtualized-select',
            'Reselect': '../libs/reselect/dist/reselect',
            'react-table': '../libs/react-table/react-table',
            'react-resizable': '../bclibs/react-resizable/bundle',
            'react-draggable': '../libs/react-draggable/dist/react-draggable.min',
            'react-data-grid': '../libs/react-data-grid/dist/react-data-grid',
            'react-tiny-popover': '../libs/react-tiny-popover/dist/index',
            'redux': '../libs/redux/dist/redux.min',
            'hoist-non-react-statics': '../libs/hoist-non-react-statics/dist/hoist-non-react-statics',
            'fast-json-patch': '../libs/fast-json-patch/dist/fast-json-patch.min',
            'styled-components': '../libs/styled-components/dist/styled-components.min',
            'uuid': '../libs/js-uuid/js-uuid',

            'filepond': '../libs/filepond/dist/filepond',
            'filepond-plugin-file-validate-type': '../libs/filepond-plugin-file-validate-type/dist/filepond-plugin-file-validate-type',
            'filepond-plugin-file-validate-size': '../libs/filepond-plugin-file-validate-size/dist/filepond-plugin-file-validate-size',

            'sf': '../libs/sf/sf',
            'text': '../libs/requirejs-text/text',
            'tpl': '../bclibs/rejs',
            'underscore': '../libs/underscore/underscore-min',
            'underscore.inflection': '../libs/underscore.inflection/lib/underscore.inflection',
            'updeep': '../libs/@mware/updeep/dist/umd/updeep-standalone.min',

            'global/window': './util/video/window',
            'global/document': './util/video/document',
            'videojs': '../libs/video.js/dist/video',

            'jqcloud2': '../libs/jqcloud2/dist/jqcloud',
            'velocity': '../bclibs/velocity/velocity.min',
            'velocity-ui': '../bclibs/velocity/velocity.ui.min',

            'cypher-codemirror': '../libs/cypher-codemirror/dist/cypher-codemirror',

            'swal': '../libs/sweetalert2/dist/sweetalert2.min',

            'px': '../bclibs/pixeladmin/js',
            'px-libs': '../bclibs/pixeladmin/libs',
            'px-bootstrap': '../bclibs/pixeladmin/bootstrap'
        },
        shim: {
            'atmosphere': {
                init: function () {
                    return $.atmosphere;
                }, deps: ['jquery']
            },
            'bootstrap': {exports: 'window', deps: ['jquery']},
            'chrono': {exports: 'chrono'},
            'cola': {exports: 'cola', deps: ['jquery']},
            'colorjs': {
                init: function () {
                    return this.net.brehaut.Color;
                }
            },
            'd3': {exports: 'd3'},
            'd3-plugins/tile/amd/index': {exports: 'd3', deps: ['d3']},
            'duration-js': {exports: 'Duration'},
            'easing': {
                init: function () {
                    return $.easing;
                }, deps: ['jquery']
            },
            'ejs': {exports: 'ejs'},
            'fast-json-patch': {exports: 'jsonpatch'},
            'gridstack-ui': {deps: ['gridstack', 'jquery-ui']},
            'jquery': {exports: 'jQuery'},
            'jstz': {exports: 'jstz'},
            'pathfinding': {exports: 'PF'},
            'rangy-text': {deps: ['rangy-core']},
            'rangy-highlighter': {deps: ['rangy-core', 'rangy-cssclassapplier', 'rangy-serializer']},
            'rangy-cssclassapplier': {deps: ['rangy-core']},
            'rangy-serializer': {deps: ['rangy-core']},
            'react-resizable': {deps: ['react']},
            'create-react-class': {deps: ['react']},
            'prop-types': {deps: ['react']},
            'react-table': {exports: 'ReactTable'},
            'jquery-scrollstop': {exports: 'jQuery', deps: ['jquery']},
            'jquery-extendext': {exports: 'jQuery', deps: ['jquery']},
            'jsree': {deps: ['jquery']},
            'underscore': {exports: '_'},
            'videojs': {exports: 'videojs'},
            'jqcloud2': {deps: ['jquery']},
            'velocity': {deps: ['jquery']},
            'velocity-ui': {deps: ['velocity']},
            'styled-components': {exports: 'styled'},
            'block-ui': {deps: ['jquery']},
            'jquery-query-builder': {
                deps: ['jquery'], init: function () {
                    return QueryBuilder;
                }
            }
        },

        packages: [
            {
                name: 'codemirror',
                location: '../libs/codemirror',
                main: 'lib/codemirror'
            },
            {
                name: 'lodash',
                location: '../libs/lodash-amd'
            }
        ],

        amdWrap: ['deep-freeze-strict/index.js']
    };
}));
