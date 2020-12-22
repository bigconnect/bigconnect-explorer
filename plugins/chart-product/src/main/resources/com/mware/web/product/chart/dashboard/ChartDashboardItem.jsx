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
const bcPromise = require("util/promise");

define([
    'react',
    'create-react-class',
    'prop-types',
    'react-plotly.js'
], function(React, createReactClass, PropTypes, PlotlyComponent) {
    window.Promise = bcPromise;
    const Plot = PlotlyComponent.default;

    const ChartDashboardItem = createReactClass({
        propTypes: {
            item: PropTypes.object.isRequired,
            extension: PropTypes.object.isRequired,
            configurationChanged: PropTypes.func.isRequired,
            configureItem: PropTypes.func.isRequired,
            finishedLoading: PropTypes.func.isRequired,
            showError: PropTypes.func.isRequired,
            bcApi: PropTypes.object.isRequired
        },

        getInitialState() {
            return {
                data: [],
                frames: [],
                layout: {}
            }
        },

        componentWillMount() {
            this.dataRequest = this.props.bcApi.v1.dataRequest;
        },

        componentDidMount() {
            const chartId = this.props.item.configuration.chartId;
            if(chartId)
                this.loadSavedChart();

            $(this.cardRef).parent().on('refreshData', this.onRefreshData);
        },

        componentWillUnmount() {
            $(this.cardRef).parent().off('refreshData', this.onRefreshData);
        },

        onRefreshData() {
            this.setState(this.getInitialState(), () => {
                this.loadSavedChart();
            });
        },

        loadSavedChart() {
            this.dataRequest('chart', 'get', this.props.item.configuration.chartId)
                .catch((e) => {
                    throw new Error('Search unavailable');
                })
                .then((result) => {
                    if(result && result.chartData) {
                        const { data, frames, layout } = result.chartData;
                        this.setState({ data, frames, layout });
                    }
                })
        },

        render() {
            const { configureItem, item } = this.props;
            const { chartId } = item.configuration;
            const { data, frames, layout, config } = this.state;

            return (
                <div className="dash-chart-item" ref={(ref) => {this.cardRef = ref}}>
                    {(() => {
                        if (!chartId) {
                            return <a onClick={configureItem}>Configure chart...</a>
                        } else {
                            return <Plot
                                data={data}
                                frames={frames}
                                layout={layout}
                                config={config}
                                onInitialized={(figure) => this.setState(figure)}
                                onUpdate={(figure) => this.setState(figure)}
                            />
                        }
                    })()}
                </div>
            )
        }
    })

    return ChartDashboardItem;
})
