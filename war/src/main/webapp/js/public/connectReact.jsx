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
 * This module returns a function that creates a higher-order
 * component that calls `connect` on the {@link module:public/v1/api}
 * and will defer rendering of the component until the promise resolves.
 * In which case the props will contain the
 * {@link module:public/v1/api.connected|connected} components.
 *
 * @module public/connectReact
 * @react Higher-order Component that automatically resolves the `connect`
 * promise from the public API
 * @example
 * define(['create-react-class', 'prop-types', 'public/v1/api'], function(createReactClass, PropTypes, api) {
 *     const MyComponent = createReactClass({
 *         render() {
 *             const { formatters, dataRequest, components } = this.props;
 *             // ...
 *         }
 *     })
 *     const MyConnectedComponent = api.connectReact()(MyComponent)
 *     return MyConnectedComponent
 * })
 */
define([
    'create-react-class', 'prop-types'
], function(createReactClass, PropTypes) {
    'use strict';

    const API_VERSIONS = ['v1'];
    const loadApiPromise = loadApiVersions();

    /**
     * Maps from the available Apis to what the component gets as props.
     *
     * @callback module:public/connectReact~mapApiToProps
     * @param {object} availableApis
     * @param {object} availableApis.v1
     * @returns {object} Api requested
     * @example
     * function(apiVersions) {
     *  return apiVersions['v1']
     * }
     */
    const defaultMapApiToProps = (apiVersions) => {
        var defaultVersion = API_VERSIONS[0];
        return apiVersions[defaultVersion];
    };
    const Connect = (mapApi, Component) => createReactClass({
        getInitialState() {
            return {
                connected: false,
                api: null
            };
        },

        componentWillMount() {
            loadApiPromise
                .then((apiVersions) => {
                    this.setState({
                        connected: true,
                        api: apiVersions
                    });
                });
        },

        displayName: 'Connect(' + getDisplayName(Component) + ')',

        render() {
            const { connected, api } = this.state;

            return connected ? <Component {...this.props} {...mapApi(api)} /> : null;
        }
    });

    /**
     *
     * @memberof module:public/connectReact
     * @see module:public/v1/api.connected
     * @param {module:public/connectReact~mapApiToProps} [mapApiToProps] Passes the latest API to
     * component by default
     * @returns {function} Connect HOC function
     * @example
     * const MyConnectedComponent = api.connectReact()(MyComponent)
     * @example <caption>Custom mapApiToProps</caption>
     * const MyConnectedComponent = api.connectReact(apis => {
     *     return apis['v1']
     * })(MyComponent)
     */
    function connectReact(mapApiToProps) {
        var mapApi = mapApiToProps ? mapApiToProps : defaultMapApiToProps;

        return _.partial(Connect, mapApi);
    }

    return connectReact;

    function loadApiVersions() {
        return Promise.map(API_VERSIONS, (version) => {
                return Promise.require('public/' + version + '/api')
                    .then((api) => {
                        return api.connect()
                            .then((asyncApi) => {
                                var baseApi = _.omit(api, 'connect');
                                return [version, _.extend(baseApi, asyncApi)];
                            });
                    });
            })
            .then((apis) => {
                return _.object(apis);
            })
    }

    function getDisplayName(Component) {
        return Component.displayName || Component.name || 'Component';
    }

});
