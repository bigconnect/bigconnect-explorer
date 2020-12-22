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
define([
    'react',
    'prop-types',
    'create-react-class',
], function(React, PropTypes, createReactClass) {
    'use strict';

    const DetailKeys = 'fileName className projectVersion builtBy builtOn gitRevision'.split(' ');
    const TypeDateKeys = 'builtOn'.split(' ');

    const PluginItem = function({item, api}) {
        var details = DetailKeys.map(function(key) {
                    if (_.contains(TypeDateKeys, key) && (key in item)) {
                        item[key] = api.formatters.date.dateTimeString(item[key]);
                    }
                    return { display: formatKeyForDisplay(key), value: item[key] }
                })
                .filter(function(item) {
                    return !!item.value;
                })

        return (
            <li>
                <h1 className="name">{item.name}</h1>
                <h2 className="description">{item.description}</h2>
                <dl>
                {details.map(function({display, value}) {
                    return [<dt>{display}</dt>, <dd title={value}>{value}</dd>]
                })}
                </dl>
            </li>
        )
    };

    const PluginSection = createReactClass({
        getInitialState: function() {
            return { expanded: false }
        },
        toggleCollapsed: function(event) {
            this.setState({ expanded: !this.state.expanded })
        },
        render: function() {
            var api = this.props.api,
                pluginItems = this.props.items.map(function(item) {
                    var key = item.className || item.fileName || item.name;
                    return <PluginItem api={api} key={key} item={item} />
                }),
                sectionClassName = 'collapsible has-badge-number',
                name = formatKeyForDisplay(this.props.name);
            if (this.props.items.length === 0) {
                sectionClassName += ' disabled'
            }
            if (this.state.expanded) {
                sectionClassName += ' expanded';
            }

            return (
                <section onClick={this.toggleCollapsed} className={sectionClassName}>
                    <h1 className="collapsible-header">
                        <strong title={name}>{name} ({this.props.items.length})</strong>
                    </h1>
                    <div>
                        <ol className="inner-list">
                            {pluginItems}
                        </ol>
                    </div>
                </section>
            )
        },
        propTypes: {
            name: PropTypes.string.isRequired,
            items: PropTypes.array.isRequired
        }
    });

    const PluginList = createReactClass({
        getInitialState: function() {
            return {
                loading: true,
                plugins: []
            }
        },
        componentWillUnmount: function() {
            this.request.cancel();
        },
        componentDidMount: function() {
            var self = this;
            this.request = this.props.bcApi.v1.dataRequest('admin', 'plugins')
                .then(function(plugins) {
                    self.setState({ loading: false, plugins: plugins })
                })
                .catch(function(error) {
                    self.setState({ loading: false, error: error.statusText || error.message })
                })
        },
        render: function() {
            let state = this.state,
                api = this.props.bcApi.v1;

            let pluginsComponent = (<div/>);

            if (state.loading) {
                pluginsComponent = (
                    <ul className="nav nav-list">
                      <li className="nav-header">Plugins<span className="badge loading"></span></li>
                    </ul>
                )
            } else if (state.error) {
                pluginsComponent = (
                    <ul className="nav nav-list">
                      <li className="nav-header">{state.error}</li>
                    </ul>
                )
            } else {
                pluginsComponent = _.sortBy(Object.keys(state.plugins), function (name) {
                        return name.toLowerCase();
                    }).map(function (plugin) {
                        return <PluginSection api={api} key={plugin} name={plugin} items={state.plugins[plugin]}/>;
                    });
            }
            return (
                <div className="panel">
                    <div className="panel-heading">
                        <div className="panel-heading-title">Registered plugins</div>
                        <div className="panel-heading-subtitle text-muted">
                            Browse registered and active BigConnect plugins
                        </div>
                    </div>

                    <div className="panel-body p-a-4">
                        <div className="admin-plugin-list">
                            {pluginsComponent}
                        </div>
                    </div>
                </div>
            );
        }
    });

    return PluginList;

    function formatKeyForDisplay(key) {
        if (key.length > 1) {
            return key.substring(0, 1).toUpperCase() + key.substring(1).replace(/[A-Z]/g, function(cap) {
                return ' ' + cap;
            });
        }
        return key;
    }
});

