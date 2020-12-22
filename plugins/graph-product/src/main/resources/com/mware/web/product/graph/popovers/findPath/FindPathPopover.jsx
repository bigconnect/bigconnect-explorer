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
    'create-react-class',
    'prop-types',
    'updeep',
    'util/withDataRequest',
    'data/web-worker/store/user/actions',
    './FindPathEdgesConfig',
    './FindPathTopLevelConfig'
], function(createReactClass, PropTypes, u, withDataRequest, userActions, FindPathEdgesConfig, FindPathTopLevelConfig) {
    'use strict';

    const CONFIG_EXCLUDED_EDGE_PREFIX = 'org.bigconnect.findPath.excludedEdge';
    const STATE_TOP_LEVEL_CONFIG = 'topLevelConfig';
    const STATE_EDGES_CONFIG = 'edgesConfig';

    const FindPathPopover = createReactClass({
        propTypes: {
            outVertexId: PropTypes.string.isRequired,
            inVertexId: PropTypes.string.isRequired,
            success: PropTypes.func.isRequired,
            setUserPreferences: PropTypes.func.isRequired,
            userPreferences: PropTypes.any.isRequired,
            configuration: PropTypes.any.isRequired
        },

        getInitialState() {
            return {
                state: STATE_TOP_LEVEL_CONFIG,
                availableEdges: [],
                selectedEdgeIris: [],
                defaultSelectedEdgeIris: [],
                maximumHops: this.getDefaultMaximumHops(),
                executing: false
            };
        },

        componentWillMount() {
            withDataRequest.dataRequest('ontology', 'relationships')
                .then((relationships) => {
                    const availableEdges = relationships.list
                        .filter((r) => {
                            return r.userVisible;
                        })
                        .sort((a, b) => {
                            return a.displayName.toLocaleLowerCase().localeCompare(b.displayName.toLocaleLowerCase());
                        });
                    const defaultSelectedEdgeIris = this.getDefaultSelectedEdges(availableEdges);
                    let userPreferences = this.props.userPreferences;
                    if (_.isString(userPreferences)) {
                        userPreferences = JSON.parse(userPreferences);
                    }

                    const selectedEdgeIris = userPreferences.selectedEdgeIris || defaultSelectedEdgeIris;
                    this.setState({
                        availableEdges: availableEdges,
                        selectedEdgeIris: selectedEdgeIris,
                        defaultSelectedEdgeIris: defaultSelectedEdgeIris,
                        maximumHops: userPreferences.maximumHops || this.getDefaultMaximumHops()
                    });
                });
        },

        getDefaultMaximumHops() {
            return 2;
        },

        getDefaultSelectedEdges(availableEdges) {
            availableEdges = availableEdges || this.state.availableEdges;
            const configurationExcludedEdges = this.getConfigurationExcludedEdges();
            return availableEdges
                .map((e) => {
                    return e.title;
                })
                .filter((iri) => {
                    return configurationExcludedEdges.indexOf(iri) < 0;
                });
        },

        getConfigurationExcludedEdges() {
            let results = [];
            Object.entries(this.props.configuration).forEach(([key, value]) => {
                if (key.indexOf(CONFIG_EXCLUDED_EDGE_PREFIX) === 0) {
                    results.push(value);
                }
            });
            return results;
        },

        handleMaximumHopsChange(maximumHops) {
            this.setState({maximumHops});
        },

        handleEdgesValueConfigure() {
            this.setState({
                state: STATE_EDGES_CONFIG
            });
        },

        handleEdgeConfigCancel() {
            this.setState({
                state: STATE_TOP_LEVEL_CONFIG
            });
        },

        handleEdgeConfigLimit(selectedEdgeIris) {
            this.setState({
                selectedEdgeIris: selectedEdgeIris,
                state: STATE_TOP_LEVEL_CONFIG
            });
        },

        handleExecute() {
            if (this.state.executing) {
                return;
            }
            this.setState({
                executing: true
            });
            Promise.all([
                this.setUserPreferences(),
                this.performFindPath()
            ])
                .then(() => {
                    this.setState({
                        executing: false
                    });
                    this.props.success();
                })
                .catch((err) => {
                    this.setState({
                        executing: false
                    });
                    console.error('error', err);
                });
        },

        setUserPreferences() {
            return this.props.setUserPreferences({
                maximumHops: this.state.maximumHops,
                selectedEdgeIris: this.state.selectedEdgeIris
            });
        },

        performFindPath() {
            const parameters = {
                outVertexId: this.props.outVertexId,
                inVertexId: this.props.inVertexId,
                hops: this.state.maximumHops,
                edgeLabels: this.state.selectedEdgeIris
            };
            return withDataRequest.dataRequest('vertex', 'findPath', parameters);
        },

        render() {
            if (this.state.state === STATE_TOP_LEVEL_CONFIG) {
                return (<FindPathTopLevelConfig availableEdges={this.state.availableEdges}
                                                selectedEdgeIris={this.state.selectedEdgeIris}
                                                defaultSelectedEdgeIris={this.state.defaultSelectedEdgeIris}
                                                maximumHops={this.state.maximumHops}
                                                executing={this.state.executing}
                                                onMaximumHopsChange={this.handleMaximumHopsChange}
                                                onExecute={this.handleExecute}
                                                onEdgesValueConfigure={this.handleEdgesValueConfigure}/>);
            } else if (this.state.state === STATE_EDGES_CONFIG) {
                return (<FindPathEdgesConfig availableEdges={this.state.availableEdges}
                                             selectedEdgeIris={this.state.selectedEdgeIris}
                                             defaultSelectedEdgeIris={this.state.defaultSelectedEdgeIris}
                                             onCancel={this.handleEdgeConfigCancel}
                                             onLimit={this.handleEdgeConfigLimit}/>);
            }
            throw new Error(`Invalid state ${this.state.state}`);
        }
    });

    return FindPathPopover;
});
