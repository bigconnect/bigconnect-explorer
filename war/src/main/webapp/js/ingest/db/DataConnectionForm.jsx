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
    '../../components/Alert',
    'public/v1/api'
], function(
    React,
    PropTypes,
    createReactClass,
    { default: VirtualizedSelect },
    Alert,
    bcApi
) {

    const DataConnectionForm = createReactClass({
        propTypes: {
            mode: PropTypes.string.isRequired
        },

        getInitialState() {
            return {
                id: '',
                name: '',
                description: '',
                driverClass: '',
                driverProperties: '',
                jdbcUrl: '',
                username: '',
                password: '',
                error: null
            }
        },

        componentWillReceiveProps(nextProps) {
            if(nextProps.mode === 'edit') {
                nextProps.dataRequest('dataload', 'getById', nextProps.dcId)
                    .then((dc) => {
                        this.setState({
                            id: dc.id,
                            name: dc.name,
                            description: dc.description,
                            driverClass: dc.driverClass,
                            driverProperties: dc.driverProperties,
                            jdbcUrl: dc.jdbcUrl,
                            username: dc.username,
                            password: dc.password
                        });
                    })
                    .catch((e) => {
                        this.setState({error: e});
                    })
            }
        },

        onSave(e) {
            e.preventDefault();

            var self = this;
            this.props.dataRequest('dataload', 'addOrEdit', this.state, this.props.mode)
                .then((result) => {
                    if (!result.success) {
                        throw Error(result.exceptionMessage);
                    }
                    self.props.changeAppMode('list');
                })
                .catch((e) => {
                    this.setState({error: e.message});
                })
        },

        handleAlertDismiss() {
            this.setState({
                error: null
            });
        },

        render () {
            var modeText = (this.props.mode === 'edit') ? 'Edit' : 'Add';

            return (
                <div className="panel panelFileIngest">
                    <div className="panel-heading">
                        <div className="panel-heading-title">{modeText} Connection</div>
                    </div>

                    <div className="panel-body">
                        <form onSubmit={this.onSave} className="form-horizontal">
                            <div className="form-group">
                                <label className="col-sm-2 control-label" htmlFor="inputDcName">Name:</label>
                                <div className="col-sm-10">
                                    <input type="text"
                                           className="form-control"
                                           id="inputDcName"
                                           value={this.state.name}
                                           required
                                           placeholder="Name"
                                           onChange={(e) => { this.setState({ name: e.target.value }) }}
                                    />
                                    <span className="help-block">The name of the Data Connection</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="col-sm-2 control-label" htmlFor="inputDescription">Description:</label>
                                <div className="col-sm-10">
                                    <input type="text"
                                           className="form-control"
                                           id="inputDescription"
                                           value={this.state.description}
                                           placeholder="Description"
                                           onChange={(e) => { this.setState({ description: e.target.value }) }}
                                    />
                                    <span className="help-block">Description for the Data Connection</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="col-sm-2 control-label" htmlFor="inputDescription">Driver Class:</label>
                                <div className="col-sm-10">
                                    <input type="text"
                                           className="form-control"
                                           id="inputDriverClass"
                                           value={this.state.driverClass}
                                           required
                                           placeholder="Driver Class"
                                           onChange={(e) => { this.setState({ driverClass: e.target.value }) }}
                                    />
                                    <span className="help-block">Fully qualified class name of the driver</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="col-sm-2 control-label" htmlFor="inputDescription">JDBC URL:</label>
                                <div className="col-sm-10">
                                    <input type="text"
                                           className="form-control"
                                           id="inputJdbcUrl"
                                           value={this.state.jdbcUrl}
                                           required
                                           placeholder="JDBC URL"
                                           onChange={(e) => { this.setState({ jdbcUrl: e.target.value }) }}
                                    />
                                    <span className="help-block">URL to connect to the database (ex: jdbc:mysql://localhost:3306/mydb) </span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="col-sm-2 control-label" htmlFor="inputDescription">Driver Properties:</label>
                                <div className="col-sm-10">
                                    <textarea className="form-control"
                                           rows="3"
                                           id="inputDriverProps"
                                           value={this.state.driverProperties}
                                           placeholder="Driver Properties"
                                           onChange={(e) => { this.setState({ driverProperties: e.target.value }) }}
                                    />
                                    <span className="help-block">The list of properties to pass to the driver (property=value). One property per line.</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="col-sm-2 control-label" htmlFor="inputDescription">Username:</label>
                                <div className="col-sm-10">
                                    <input type="text"
                                           className="form-control"
                                           id="inputUsername"
                                           value={this.state.username}
                                           required
                                           placeholder="Username"
                                           onChange={(e) => { this.setState({ username: e.target.value }) }}
                                    />
                                    <span className="help-block">User to connect to the database</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="col-sm-2 control-label" htmlFor="inputDescription">Password:</label>
                                <div className="col-sm-10">
                                    <input type="password"
                                           className="form-control"
                                           id="inputPassword"
                                           value={this.state.password}
                                           placeholder="Password"
                                           onChange={(e) => { this.setState({ password: e.target.value }) }}
                                    />
                                    <span className="help-block">Password to connect to the database (can be blank)</span>
                                </div>
                            </div>

                            <Alert error={this.state.error} onDismiss={this.handleAlertDismiss}/>

                            <div className="form-group">
                                <div className="col-12 m-t-2 text-center">
                                    <div className="btn-group">
                                        <button className="btn btn-danger p-x-4" onClick={() => this.props.changeAppMode('list') }>Cancel</button>
                                        <button className="btn btn-primary m-x-1 p-x-4">Save</button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )
        }
    });

    return DataConnectionForm;

});
