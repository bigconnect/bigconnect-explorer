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
(function() {
    'use strict';
define([
    'react-dom',
    'react',
    'react-redux',
    'components/ErrorBoundary',
    'util/promise'
], function(
    ReactDOM,
    React,
    { Provider },
    ErrorBoundary,
    Promise) {

    var API_VERSIONS = ['v1'],
        self = this,
        cachedApiVersions = null;

    function componentOrDefault(c) {
        return 'default' in c ? c.default : c;
    }

    /**
     * Abstracts the attachment of flight and react nodes
     */
    function Attacher(options = {}) {
        return (this === self ? new Attacher() : this).options(options)
    }

    ['path', 'component', 'params', 'behavior', 'legacyMapping', 'options'].forEach(createSetter);

    Attacher.prototype.node = function(node) {
        if (arguments.length === 0) return this._node;
        this._node = _.isFunction(node.get) ? node.get(0) : node;
        return this;
    };

    Attacher.prototype._verifyState = function() {
        if (!this._options.preferDirectReactChildren &&  !_.isElement(this._node)) {
            throw new Error('Node is not an Element')
        }
        if (!_.isString(this._path) && !this._component) {
            throw new Error('Valid component or path is required')
        }
        if (this._params) {
            if ('bcApi' in this._params) {
                throw new Error('Refrain from setting bcApi key in params to avoid collisions');
            }
            if (!_.isObject(this._params) || _.isArray(this._params) || _.isFunction(this._params)) {
                throw new Error('Params must be an object')
            }
        }
    };

    Attacher.prototype.teardown = function(options = {}) {
        const hasInstance = this._flightComponent || this._reactElement;
        const {
            flight = hasInstance ? this._flightComponent : true,
            react = hasInstance ? this._reactElement : true } = options;
        if (!this._node) throw new Error('No node specified');
        if (!this._options.preferDirectReactChildren) {
            if (react) ReactDOM.unmountComponentAtNode(this._node);
        }
        if (flight) {
            if (this._flightComponent) {
                $(this._node).teardownComponent(this._flightComponent);
            } else {
                $(this._node).teardownAllComponents();
            }
        }
        this._reactElement = null;
        this._flightComponent = null;
        return this;
    };

    Attacher.prototype.attach = function(options = {}) {
        var self = this,
            params = _.extend({}, this._params) || {};

        return Promise.try(this._verifyState.bind(this))
            .then(function() {
                if (self._component)
                    self._component = componentOrDefault(self._component);

                return Promise.all([
                    self._component || Promise.require(self._path).then(componentOrDefault),
                    cachedApiVersions || (cachedApiVersions = loadApiVersions()),
                    bcData.storePromise
                ]);
            })
            .spread(function(Component, api, store) {
                params.bcApi = api;
                const flight = isFlight(Component);

                if (options && options.teardown) {
                    self.teardown(options.teardownOptions || {});
                }
                if (options.empty || (flight && options.emptyFlight) || (!flight && options.emptyReact)) {
                    self._node.textContent = '';
                }
                if (flight) {
                    var eventNode = options && options.legacyFlightEventsNode,
                        addedEvents = addLegacyListeners(self, eventNode);
                    Component.attachTo(self._node, params);
                    removeLegacyListenersOnTeardown(self, eventNode || self._node, Component, addedEvents)
                    self._flightComponent = Component;
                } else {
                    const boundaryProps = { onError: params.onError, FallbackComponent: params.FallbackComponent };
                    const reactElement = React.createElement(Component, _.extend(params, wrapBehavior(self)));
                    const errorBoundaryWrapper = React.createElement(ErrorBoundary, boundaryProps, reactElement);

                    if (self._options.preferDirectReactChildren) {
                        self._reactElement = errorBoundaryWrapper;
                    } else {
                        const provider = React.createElement(Provider, { store }, errorBoundaryWrapper);
                        ReactDOM.render(provider, self._node);
                        self._reactElement = provider;
                    }
                }

                $(self._node).trigger('rendered');

                return self;
            })
    };

    return Attacher;

    function addLegacyListeners(inst, node) {
        var mapping = inst._legacyMapping || {},
            addedEvents = {};
        _.each(inst._behavior, function(callback, name) {
            if (name in mapping) {
                name = mapping[name];
            }
            if (!(name in addedEvents)) {
                addedEvents[name] = function(event, data) {
                    event.stopPropagation();
                    callback(inst, data);
                };
                $(node || inst._node).on(name, addedEvents[name]);
            }
        })
        return addedEvents;
    }

    function wrapBehavior(inst) {
        return _.mapObject(inst._behavior, function(fn) {
            return function(data) {
                return fn.apply(this, [inst].concat(_.toArray(arguments)));
            }
        })
    }

    function removeLegacyListenersOnTeardown(inst, eventNode, Component, addedEvents) {
        var comp = $(inst._node).lookupComponent(Component)
        if (comp) {
            comp.before('teardown', function() {
                var $node = this.$node;
                _.each(addedEvents, function(handler, name) {
                    $(eventNode).off(name, handler);
                })
            })
        }
    }

    function loadApiVersions() {
        return Promise.map(API_VERSIONS, function(version) {
                return Promise.require('public/' + version + '/api')
                    .then(function(api) {
                        return api.connect()
                            .then(function(asyncApi) {
                                var baseApi = _.omit(api, 'connect');
                                return [version, _.extend(baseApi, asyncApi)];
                            });
                    })
            })
            .then(function(apis) {
                return _.object(apis);
            })
    }

    function isFlight(Component) {
        return _.isFunction(Component.attachTo);
    }

    function createSetter(name) {
        Attacher.prototype[name] = function(value) {
            var key = `_${name}`;
            if (arguments.length === 0) {
                return this[key];
            }
            this[key] = value;
            return this;
        }
    }
});
})();
