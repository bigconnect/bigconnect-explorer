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
var path = require('path');
var webpack = require('webpack');

var BcAmdExternals = [
    'components/DroppableHOC',
    'product/toolbar/ProductToolbar',
    'components/RegistryInjectorHOC',
    'components/Attacher',
    'components/Modal',
    'configuration/plugins/registry',
    'data/web-worker/store/actions',
    'data/web-worker/store/product/actions-impl',
    'data/web-worker/store/product/actions',
    'data/web-worker/store/user/actions-impl',
    'data/web-worker/store/user/actions',
    'data/web-worker/store/user/selectors',
    'data/web-worker/store/product/selectors',
    'data/web-worker/store/selection/actions',
    'data/web-worker/store/user/actions-impl',
    'data/web-worker/store/element/actions-impl',
    'data/web-worker/store/element/selectors',
    'data/web-worker/store/selection/actions-impl',
    'data/web-worker/store/undo/actions-impl',
    'data/web-worker/store/undo/actions',
    'data/web-worker/store/workspace/actions-impl',
    'data/web-worker/store/workspace/actions',
    'data/web-worker/store/ontology/selectors',
    'data/web-worker/util/ajax',
    'com/mware/web/product/chart/dist/actions-impl',
    'public/v1/api',
    'util/component/attacher',
    'util/formatters',
    'util/vertex/formatters',
    'util/retina',
    'util/dnd',
    'util/deepObjectCache',
    'util/parsers',
    'util/promise',
    'util/withContextMenu',
    'util/withDataRequest',
    'util/withTeardown',
    'util/withFormFieldErrors',
    'util/ontology/relationshipSelect',
    'detail/dropdowns/propertyForm/justification',
    'util/visibility/edit',
    'flight/lib/component',
    'fast-json-patch',
    'bluebird',
    'updeep',
    'underscore',
    'colorjs',
    'react',
    'create-react-class',
    'prop-types',
    'react-dom',
    'redux',
    'react-redux',
    'swal',
    'react-virtualized',
    'px/extensions/growl'
].map(path => ({[path]: {amd: path, commonjs2: false, commonjs: false}}));


var baseConfig = {
    node: {
        fs: 'empty'
    },

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        library: '[name]',
        libraryTarget: 'umd',
    },
    externals: BcAmdExternals,
    resolve: {
        extensions: ['.js', '.jsx', '.hbs']
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /(dist|node_modules)/,
                use: [
                    {loader: 'babel-loader'}
                ]
            },
            {
                test: /\.(css|scss)?$/,
                use: ['style-loader', 'css-loader', 'sass-loader'],
            }
        ]
    },
    devtool: 'source-map'
};

module.exports = [
    Object.assign({}, baseConfig, {
        entry: {
            'actions-impl': './worker/actions-impl.js',
            'plugin-worker': './worker/plugin.js'
        },
        target: 'webworker'
    }),
    Object.assign({}, baseConfig, {
        entry: {
            Chart: './ChartContainer.jsx',
            DatasetChooser: './DatasetChooser.jsx',
            ChartList: './ChartList.jsx',
            ChartDashboardItem: './dashboard/ChartDashboardItem.jsx',
            ChartDashboardItemConfig: './dashboard/ChartDashboardItemConfig.jsx',

        },
        target: 'web'
    })
];
