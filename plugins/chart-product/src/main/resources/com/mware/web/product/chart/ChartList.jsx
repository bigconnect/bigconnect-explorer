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
    'create-react-class',
    'data/web-worker/store/product/actions',
    'swal'
], function(React, createReactClass, productActions, swal) {
    'use strict';

    const ChartList = createReactClass({
        getInitialState() {
            return {
                chartName: this.props.chartState.name || '',
                savedCharts: []
            }
        },

        componentWillMount() {
            this.loadChartList();
        },

        loadChartList() {
            this.props.bcApi.v1.dataRequest('chart', 'list')
                .then((result) => {
                    const savedCharts = result.charts,
                        loadedChart = _.findWhere(savedCharts, { id: this.props.chartId });

                    this.setState({ savedCharts: result.charts });

                    if(loadedChart) {
                        this.setState({ chartName: loadedChart.name });
                    }
                });
        },


        loadChart(chart) {
            const { product } = this.props,
                productId = product.id,
                chartId = chart.id;

            this.props.bcApi.v1.dataRequest('chart', 'get', chartId)
                .then(result => {
                    if(result && result.chartData) {
                        const { id, name, datasetId, chartData } = result,
                            { data, layout, frames } = chartData;

                        this.props.updateChartState(productId, {
                            id, name, datasetId, data, layout, frames
                        });
                    }
                })

            this.setState({ chartName: chart.name });
        },

        deleteChart(chart) {
            const { product } = this.props,
                productId = product.id;

            swal({
                title: 'Are you sure?',
                text: "You won't be able to revert this operation !",
                type: 'warning',
                showCancelButton: true
            }).then((result) => {
                if (result.value) {
                    this.props.bcApi.v1.dataRequest('chart', 'delete', chart.id)
                        .then((result) => {
                            this.loadChartList();
                            this.props.emptyChartState(productId);
                        })
                        .catch(e => {
                            console.log(e);

                            $.growl.error({
                                title: 'Error deleting chart'
                            });
                        })
                }
            });
        },

        saveChart() {
            const {product, chartState} = this.props,
                productId = product.id,
                { chartName } = this.state,
                chartData = { data: chartState.data, frames: chartState.frames, layout: chartState.layout }

            let promise = chartState.id ?
                this.props.bcApi.v1.dataRequest('chart', 'update', chartState.id, chartName, chartState.datasetId, chartData) :
                this.props.bcApi.v1.dataRequest('chart', 'save', chartName, chartState.datasetId, chartData);

            promise
                .then((result) => {
                    if(result && result.chartData) {
                        const { id, name, datasetId, chartData } = result,
                            { data, layout, frames } = chartData;

                        this.props.updateChartState(productId, {
                            id, name, datasetId, data, layout, frames
                        });
                    }

                    $.growl.success({
                        message: `Chart ${chartName} saved`,
                    });

                    this.loadChartList();
                })
                .catch(e => {
                    console.log(e);

                    if (e && e.json && e.json.error) {
                        $.growl.error({
                            title: 'Error saving chart',
                            message: e.json.error
                        });
                    }
                })
        },

        render() {
            const { savedCharts, chartName } = this.state,
                chartId = this.props.chartState.id || 'none';

            return (
                <section style={{width: "20em"}}>
                    <div className="input-group input-group-sm">
                        <input className="form-control"
                               onChange={(e) => { this.setState({chartName: e.target.value}) }}
                               value={chartName}
                        />
                        <span className="input-group-btn">
                            <button
                                className='btn'
                                onClick={this.saveChart}
                                disabled={!chartName}
                            >Save</button>
                        </span>
                    </div>

                    <ul className="list-group">
                        {savedCharts.map(chart => {
                            const classes = chart.id === chartId ? 'list-group-item active' :  'list-group-item';

                            return (
                                <li className={classes} key={chart.id}>
                                    <a onClick={() => this.loadChart(chart)}>{chart.name}</a>

                                    <span className="label label-danger">
                                        <a onClick={() => this.deleteChart(chart)}>Delete</a>
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                </section>
            )
        }
    })

    return ChartList;
});
