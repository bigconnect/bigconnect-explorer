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
    'antd'
], function(React, PropTypes, createReactClass, antd) {
    'use strict';

    const {List, Switch, message, Tag, Space} = antd;

    const DetailKeys = 'fileName className projectVersion builtBy builtOn gitRevision'.split(' ');
    const TypeDateKeys = 'builtOn'.split(' ');

    function formatKeyForDisplay(key) {
        if (key.length > 1) {
            return key.substring(0, 1).toUpperCase() + key.substring(1).replace(/[A-Z]/g, function(cap) {
                return ' ' + cap;
            });
        }
        return key;
    }

    const PluginSection = createReactClass({
        propTypes: {
            name: PropTypes.string.isRequired,
            items: PropTypes.array.isRequired,
            reload: PropTypes.func.isRequired
        },

        getInitialState: function() {
            return { loading: false }
        },

        enablePlugin(it, checked) {
            this.setState({ loading: true });
            this.request = this.props.api.dataRequest('admin', 'enablePlugin', it.item.className, checked)
                .then(() => {
                    this.setState({ loading: false })
                    this.props.reload();
                })
                .catch((error) => {
                    message.error('Error changing plugin state. Please contact the System Administrator.');
                })
        },

        renderItem(it) {
            const { item, api } = it,
                name = item.systemPlugin ? `${item.name} (SYSTEM PLUGIN)` : item.name;

            const details = DetailKeys.map(function(key) {
                    if (_.contains(TypeDateKeys, key) && (key in item)) {
                        item[key] = api.formatters.date.dateTimeString(item[key]);
                    }
                    return { display: formatKeyForDisplay(key), value: item[key] }
                }).filter(function(item) {
                    return !!item.value;
                })
            return (
                <List.Item>
                    <List.Item.Meta
                        avatar={
                            <Switch checkedChildren='Enabled' unCheckedChildren='Disabled'
                                    checked={it.item.enabled}
                                    disabled={it.item.systemPlugin}
                                    loading={this.state.loading}
                                    onChange={(checked) => this.enablePlugin(it, checked)}/>
                        }
                        title={
                            <Space>
                                <span>{item.name}</span>
                                {item.systemPlugin ? (<Tag color="orange">system</Tag>) : <span/>}
                            </Space>
                        }
                        description={item.description}
                    />
                </List.Item>
            )
        },

        render() {
            var api = this.props.api,
                pluginItems =  this.props.items.map(function(item) {
                    var key = item.className || item.fileName || item.name;
                    return { api, key, item }
                }),
                name = formatKeyForDisplay(this.props.name);

            return (
                <List
                    className='m-t-3'
                    style={{ backgroundColor: '#ffffff' }}
                    size='small'
                    header={<div>{name} ({this.props.items.length})</div>}
                    bordered
                    dataSource={pluginItems}
                    renderItem={this.renderItem}
                />
            )
        }
    });

    return createReactClass({
        getInitialState: function () {
            return {
                plugins: []
            }
        },

        loadData() {
            this.request = this.props.bcApi.v1.dataRequest('admin', 'plugins')
                .then((plugins) => {
                    this.setState({plugins: plugins})
                })
                .catch((error) => {
                    this.setState({error: error.statusText || error.message})
                })
        },

        componentWillUnmount: function () {
            this.request.cancel();
        },

        componentDidMount: function () {
            this.loadData();
        },

        render: function () {
            let state = this.state,
                api = this.props.bcApi.v1;

            let pluginsComponent;

            if (state.error) {
                pluginsComponent = (
                    <ul className="nav nav-list">
                        <li className="nav-header">{state.error}</li>
                    </ul>
                )
            } else {
                pluginsComponent = _.sortBy(Object.keys(state.plugins), (name) => name.toLowerCase())
                    .map((plugin) => (<PluginSection api={api} key={plugin} name={plugin} items={state.plugins[plugin]} reload={this.loadData}/>));
            }
            return (
                <>
                    <div className="panel">
                        <div className="panel-heading">
                            <div className="panel-heading-title">Registered plugins</div>
                            <div className="panel-heading-subtitle text-muted">
                                Browse registered and active BigConnect plugins
                            </div>
                        </div>
                    </div>

                    {pluginsComponent}
                </>
            );
        }
    });
});

