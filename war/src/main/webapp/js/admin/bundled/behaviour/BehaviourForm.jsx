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
    'public/v1/api',
    'react',
    'prop-types',
    'create-react-class',
    './BehaviourQueryTable',
    '../../../components/Alert'
], function(
    bcApi,
    React,
    PropTypes,
    createReactClass,
    BehaviourQueryTable,
    Alert) {

    const BehaviourForm = createReactClass({
        propTypes: {
            changeAppMode: PropTypes.func.isRequired,
            userId: PropTypes.string,
            mode: PropTypes.string.isRequired
        },

        getInitialState() {
            return {
                id: '',
                name: '',
                description: '',
                threshold: 0,
                error: null,
                queries: [],
                loading: true
            }
        },

        componentDidMount() {
            if(this.props.mode === 'edit') {
                bcApi.connect().then(({ dataRequest }) => {
                    dataRequest('behaviour', 'getById', this.props.bId)
                        .then((behaviour) => {
                            this.setState({
                                id: behaviour.id,
                                name: behaviour.name,
                                description: behaviour.description,
                                threshold: behaviour.threshold,
                                queries: behaviour.queries
                            });
                        })
                        .catch((e) => {
                            this.setState({error: e});
                        })
                });
            }
        },

        onSave(e) {
            e.preventDefault();

            if(!this.validateForm())
                return;

            bcApi.connect().then(({ dataRequest }) => {
                dataRequest('behaviour', 'addOrEdit', this.props.mode, this.state)
                    .then(() => {
                        this.props.changeAppMode('list');
                    })
                    .catch((e) => {
                        this.setState({error: e});
                    });
            });
        },

        validateForm() {
            let errorMsg = [];

            if(!this.state.threshold)
                errorMsg.push('Threshold is required');
            else if(this.state.threshold <= 0)
                errorMsg.push('Threshold must be a positive number');

            if(this.state.queries.length == 0)
                errorMsg.push("There are no questions defined");

            if(errorMsg.length > 0) {
                this.setState({error: {statusText: errorMsg}});
                return false;
            } else
                return true;
        },

        handleAlertDismiss() {
            this.setState({
                error: null
            });
        },

        updateQueryRow(row) {
            let copyOfQueryData = this.state.queries.slice(0);
            copyOfQueryData[row.index].savedSearchId = row.original.savedSearchId;
            copyOfQueryData[row.index].score = row.original.score;
            this.setState({
                queries: copyOfQueryData
            });
        },

        addQueryRow(event) {
            event.preventDefault();
            let copyOfQueryData = this.state.queries.slice(0);
            copyOfQueryData.push({
                savedSearchId: null,
                score: 0
            })
            this.setState({
                queries: copyOfQueryData
            });
        },

        deleteQueryRow(event, row) {
            event.preventDefault();
            let copyOfQueryData = this.state.queries.slice(0);
            copyOfQueryData.splice(row.index, 1);
            this.setState({
                queries: copyOfQueryData
            });
        },

        render () {
            var modeText = (this.props.mode === 'edit') ? 'Edit' : 'Add';

            return (
                <div className="panel">
                    <div className="panel-heading">
                        <div className="panel-heading-title">{modeText} Behaviour</div>
                    </div>

                    <div className="panel-body">
                        <form onSubmit={this.onSave} className="form-horizontal">
                        <Alert error={this.state.error} onDismiss={this.handleAlertDismiss}/>

                        <div className="form-group">
                            <label className="col-sm-2 control-label" htmlFor="inputName">Name:</label>
                            <div className="col-sm-5">
                                <input type="text"
                                       className="form-control"
                                       id="inputName"
                                       value={this.state.name}
                                       required
                                       placeholder="Behaviour name"
                                       onChange={(e) => { this.setState({ name: e.target.value }) }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="col-sm-2 control-label" htmlFor="inputDescription">Description:</label>
                            <div className="col-sm-5">
                                <input type="text"
                                       className="form-control"
                                       id="inputDescription"
                                       value={this.state.description}
                                       placeholder="Behaviour description"
                                       onChange={(e) => { this.setState({ description: e.target.value }) }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="col-sm-2 control-label" htmlFor="inputThreshold">Threshold:</label>
                            <div className="col-sm-5">
                                <input type="text"
                                       className="form-control"
                                       id="inputThreshold"
                                       value={this.state.threshold}
                                       required
                                       placeholder="Behaviour threshold (numeric)"
                                       onChange={(e) => { this.setState({ threshold: e.target.value }) }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <div className="col-sm-12">
                                <BehaviourQueryTable
                                    addQueryRow={this.addQueryRow}
                                    updateQueryRow={this.updateQueryRow}
                                    deleteQueryRow={this.deleteQueryRow}
                                    queryData={this.state.queries}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <div className="col-sm-12 text-center">
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

    return BehaviourForm;

});
