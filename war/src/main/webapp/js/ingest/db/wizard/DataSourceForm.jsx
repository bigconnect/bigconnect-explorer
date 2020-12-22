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
    'react-dom',
    'prop-types',
    'create-react-class',
    '../../../components/Alert'
], function(React, ReactDOM, PropTypes, createReactClass, Alert) {
    'use strict';

    const DataSourceForm = createReactClass({
        propTypes: {
            changeAppMode: PropTypes.func.isRequired,
            getStore: PropTypes.func.isRequired,
            updateStore: PropTypes.func.isRequired
        },

        getInitialState() {
            return {
                id: this.props.getStore().dsId,
                name: this.props.getStore().name,
                description: this.props.getStore().description,
                maxRecords: this.props.getStore().maxRecords,
                sqlSelect: this.props.getStore().sqlSelect,
                error: null,
                saving: false
            }
        },

        componentWillReceiveProps(nextProps) {
            this.setState({
                id: this.props.getStore().dsId,
                name: this.props.getStore().name,
                description: this.props.getStore().description,
                maxRecords: this.props.getStore().maxRecords,
                sqlSelect: this.props.getStore().sqlSelect,
                error: null,
                saving: false
            });
        },

        setError(msg) {
            this.setState({ error: { statusText: msg} });
        },

        isValidated() {
            this.setState({ saving: true });

            if(this.state.name.trim().length == 0) {
                this.setError('Name is required');
                return false;
            }

            if(this.state.sqlSelect.trim().length == 0) {
                this.setError('Select statement is required');
                return false;
            }

            // if the sql statement changed, clear store mappings
            const wizardStore = this.props.getStore();
            if(wizardStore.sqlSelect != this.state.sqlSelect)  {
                this.props.updateStore({
                    entityMappings: null,
                    relMappings: null
                });
            }

            // update the store with the new values
            this.props.updateStore({
                ...this.state,
                dcId: this.props.dcId,
                importConfig: {
                    jobId: '',
                    incremental: false,
                    incrementalMode: 'append',
                    checkColumn: '',
                    lastValue: '',
                    runNow: false,
                    source: this.state.name.trim()
                }
            });

            return this.props.dataRequest('dataload', 'preview', this.props.dcId, this.state.sqlSelect)
                .then((preview) => {
                    if (!preview.success) {
                        throw Error(preview.exceptionMessage);
                    }

                    this.props.updateStore({
                        ...this.state,
                        preview: preview
                    });

                    this.setState({ saving: false });

                    return true;
                })
                .catch((e) => {
                    this.setState({error: e.message, saving: false});
                    return false;
                });
        },

        handleAlertDismiss() {
            this.setState({
                error: null
            });
        },

        render() {
            return (
                <div className='step-progress'>
                    <div className="container-fluid">
                        <div className="row text-center">
                            <h3>Data Source details</h3>
                        </div>
                        <div className="row">
                            <form className="form-horizontal">
                                <Alert error={this.state.error} onDismiss={this.handleAlertDismiss}/>

                                <div className="form-group">
                                    <label className="col-sm-2 control-label" htmlFor="inputDsName">Name:</label>
                                    <div className="col-sm-10">
                                        <input type="text"
                                               className="form-control"
                                               ref="name"
                                               id="inputDsName"
                                               value={this.state.name}
                                               required
                                               placeholder="Name"
                                               onChange={(e) => { this.setState({ name: e.target.value }) }}
                                        />
                                        <span className="help-block">The name of the Data Source</span>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="col-sm-2 control-label" htmlFor="inputDescription">Description:</label>
                                    <div className="col-sm-10">
                                        <input type="text"
                                               className="form-control"
                                               id="inputDescription"
                                               ref="description"
                                               value={this.state.description}
                                               placeholder="Description"
                                               onChange={(e) => { this.setState({ description: e.target.value }) }}
                                        />
                                        <span className="help-block">Description of the Data Source</span>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="col-sm-2 control-label" htmlFor="inputMaxRecords">Max Records:</label>
                                    <div className="col-sm-10">
                                        <input type="text"
                                               className="form-control"
                                               id="inputMaxRecords"
                                               value={this.state.maxRecords}
                                               placeholder="Max Records"
                                               onChange={(e) => { this.setState({ maxRecords: e.target.value.trim() }) }}
                                        />
                                        <span className="help-block">Number of records to load from the Data Source</span>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="col-sm-2 control-label" htmlFor="inputSelect">Select Statement:</label>
                                    <div className="col-sm-10">
                                        <textarea id="inputSelect"
                                                  className="form-control"
                                                  rows="5"
                                                  required
                                                  value={this.state.sqlSelect}
                                                  placeholder="SQL Select Statement"
                                                  onChange={(e) => { this.setState({ sqlSelect: e.target.value }) }}
                                        />
                                        <span className="help-block">The SQL SELECT statement that will be run to fetch the records</span>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            );
        }
    });

    return DataSourceForm;
});
