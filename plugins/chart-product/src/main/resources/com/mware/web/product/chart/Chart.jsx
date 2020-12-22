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
    'react-redux',
    'react-chart-editor',
    'plotly.js',
    'product/toolbar/ProductToolbar',
    'configuration/plugins/registry',
    'public/v1/api',
    'react-chart-editor/lib/react-chart-editor.css',
    'px/extensions/growl'
], function(React, createReactClass, redux, {default: PlotlyEditor}, plotly, ProductToolbar, registry, bcApi) {
    window.Promise = bcPromise;

    const config = {editable: true};

    registry.registerExtension('org.bigconnect.product.toolbar.item', {
        identifier: 'newChart',
        placementHint: 'button',
        label: 'New',
        props: { handler: newChart },
        canHandle: (product) => product.kind === 'org.bigconnect.web.product.chart.ChartWorkProduct'
    });

    registry.registerExtension('org.bigconnect.product.toolbar.item', {
        identifier: 'loadChart',
        itemComponentPath: 'com/mware/web/product/chart/dist/ChartList',
        placementHint: 'popover',
        label: 'Charts',
        canHandle: (product) => product.kind === 'org.bigconnect.web.product.chart.ChartWorkProduct'
    });

    registry.registerExtension('org.bigconnect.product.toolbar.item', {
        identifier: 'chooseDataset',
        itemComponentPath: 'com/mware/web/product/chart/dist/DatasetChooser',
        placementHint: 'popover',
        label: 'Dataset',
        canHandle: (product) => product.kind === 'org.bigconnect.web.product.chart.ChartWorkProduct'
    });

    const Chart = createReactClass({

        getInitialState() {
            return {
                loading: false,
                loadedDatasetId: '',
                dataSource: {},
                dataSourceOptions: []
            }
        },

        componentWillMount() {
            const datasetId = this.props.chartState.datasetId;
            if(datasetId) {
                this.loadData(datasetId);
            }
        },

        componentWillReceiveProps(nextProps) {
            const nextChartState = nextProps.chartState;
            if (nextChartState.datasetId && nextChartState.datasetId !== this.state.loadedDatasetId) {
                this.loadData(nextChartState.datasetId);
            }
        },

        loadData(datasetId) {
            this.setState({loading: true});

            bcApi.connect().then(({ dataRequest }) => {
                dataRequest('search', 'get', datasetId)
                    .then((search) => {
                        dataRequest('chart', 'chartData', search.name, 10000)
                            .then((data) => {
                                const properties = this.props.ontologyProperties;
                                let dataSource = _.object(data.columns, _.unzip(data.rows));
                                let dataSourceOptions = _.map(data.columns, (name) => {
                                    let label = name;
                                    if (properties[name])
                                        label = properties[name].displayName || name;

                                    return {
                                        value: name,
                                        label
                                    }
                                });
                                this.setState({dataSource, dataSourceOptions, loading: false, loadedDatasetId: datasetId});
                            })
                            .catch(e => {
                                console.log(e);
                                $.growl.error({
                                    message: `There was an error loading chart data`,
                                });
                                this.setState({loading: false});
                            })
                    })
            });
        },

        render() {
            const { product, chartState } = this.props,
                { data, layout, frames, id, name, datasetId } = chartState,
                { loading } = this.state;

            return (
                <div className="org-bigconnect-chartdesigner" style={{ height: '100%' }}>
                     <PlotlyEditor
                        data={data || []}
                        layout={layout || {}}
                        config={config}
                        frames={frames || []}
                        dataSources={this.state.dataSource}
                        dataSourceOptions={this.state.dataSourceOptions}
                        plotly={plotly}
                        onUpdate={(data, layout, frames) => {
                                this.props.emptyChartState(product.id);
                                this.props.updateChartState(product.id, {
                                    data, layout, frames, id, name, datasetId
                                })
                            }
                        }
                        useResizeHandler
                        debug
                        advancedTraceTypeSelector
                    />

                    {loading ? <div className="chart-data-loading"><h3>Loading data...</h3></div> : <div/> }

                    <ProductToolbar
                        topOffset={30}
                        product={product}
                        showNavigationControls={false}
                        showAddDataset={false}
                        injectedProductProps={this.props}
                    />
                </div>
            )
        }
    })

    function newChart(props) {
        const productId = props.product.id;
        props.emptyChartState(productId);
    }

    return Chart;
})
