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
    'react-virtualized-select',
    '../../../components/Alert'
], function(React, PropTypes, createReactClass, {default: VirtualizedSelect}, Alert) {

    const DataSourceImportConfig = createReactClass({
        propTypes: {
            changeAppMode: PropTypes.func.isRequired,
            getStore: PropTypes.func.isRequired,
            updateStore: PropTypes.func.isRequired
        },

        getInitialState() {
            return {
                jobId: this.props.getStore().importConfig.jobId,
                incremental: this.props.getStore().importConfig.incremental,
                incrementalMode: this.props.getStore().importConfig.incrementalMode,
                checkColumn: this.props.getStore().importConfig.checkColumn,
                lastValue: this.props.getStore().importConfig.lastValue,
                runNow: this.props.getStore().importConfig.runNow,
                source: this.props.getStore().importConfig.source,
                error: null
            }
        },

        handleAlertDismiss() {
            this.setState({
                error: null
            });
        },

        setError(msg) {
            this.setState({ error: { statusText: msg} });
        },

        isValidated() {
            this.props.updateStore({
                importConfig: {
                    ...this.state
                }
            });
        },

        render() {
            const modeOptions = [
                { label: 'Append', value: 'append' },
                { label: 'Last Modified', value: 'lastmodified' }
            ];

            const dataCols = this.props.getStore().preview.columns.map(c => {
                return {
                    label: c.name,
                    value: c.name
                }
            });

            return (
                <div className='step-progress'>
                    <div className="container-fluid" style={{marginTop: '30px'}}>
                        <div className="row text-center">
                            <h3>Job Settings</h3>
                        </div>
                        <div className="row">
                            <div className="col-md-7">
                            <form className="form-horizontal">
                                <Alert error={this.state.error} onDismiss={this.handleAlertDismiss}/>

                                <div className="form-group">
                                    <div className="col-sm-offset-3 col-sm-9">
                                        <div className="checkbox">
                                            <label>
                                                <input type="checkbox"
                                                       id="inputIncremental"
                                                       checked={this.state.runNow}
                                                       onChange={(e) => {
                                                           this.setState({runNow: e.target.checked})
                                                       }}
                                                />
                                                <span className="checkbox-material">
                                                    <span className="check" />
                                                </span>
                                                Run on finish
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                { false && <div className="form-group">
                                    <label className="col-sm-3 control-label" htmlFor="inputJobId">Job ID:</label>
                                    <div className="col-sm-9">
                                        <input type="text"
                                               ref="name"
                                               id="inputJobId"
                                               value={this.state.jobId}
                                               required
                                               placeholder="Job ID"
                                               onChange={(e) => {
                                                   this.setState({jobId: e.target.value.trim()})
                                               }}
                                        />
                                    </div>
                                </div>
                                }

                                <div className="form-group">
                                    <div className="col-sm-offset-3 col-sm-9">
                                        <div className="checkbox">
                                            <label>
                                                <input type="checkbox"
                                                       id="inputIncremental"
                                                       disabled={true}
                                                       checked={this.state.incremental}
                                                       onChange={(e) => {
                                                           this.setState({incremental: e.target.checked})
                                                       }}
                                                />
                                                <span className="checkbox-material">
                                                    <span className="check" />
                                                </span>
                                                Incremental import
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <fieldset style={{display: (this.state.incremental) ? 'block' : 'none'}}>
                                    <legend style={{marginLeft: '70px'}}>Incremental Import</legend>

                                    <div className="form-group">
                                        <label className="col-sm-3 control-label" htmlFor="inputCheckCol">Check column:</label>
                                        <div className="col-sm-9">
                                            <VirtualizedSelect
                                                id="inputCheckCol"
                                                disabled={true}
                                                options={dataCols}
                                                value={this.state.checkColumn}
                                                onChange={(val) => { this.setState({checkColumn: val.value}) }}
                                                clearable={false}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="col-sm-3 control-label" htmlFor="inputIncMode">Mode:</label>
                                        <div className="col-sm-9">
                                            <VirtualizedSelect
                                                id="inputIncMode"
                                                options={modeOptions}
                                                disabled={true}
                                                value={this.state.incrementalMode}
                                                onChange={(val) => { this.setState({incrementalMode: val.value}) }}
                                                clearable={false}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="col-sm-3 control-label" htmlFor="inputLastValue">Last value:</label>
                                        <div className="col-sm-9">
                                            <input type="text"
                                                   ref="name"
                                                   id="inputLastValue"
                                                   value={this.state.lastValue}
                                                   required
                                                   disabled={true}
                                                   placeholder="The maximum value of the check column from the previous import"
                                                   onChange={(e) => { this.setState({ lastValue: e.target.value.trim() }) }}
                                            />
                                        </div>
                                    </div>
                                </fieldset>
                            </form>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    });

    return DataSourceImportConfig;
});
