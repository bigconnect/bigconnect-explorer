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
    'react-table',
    '../../../components/ConfirmDialog'
], function (React, ReactDOM, PropTypes, createReactClass, ReactTableDef, ConfirmDialog) {
    'use strict';

    const ReactTable = ReactTableDef.default;

    const RegexList = createReactClass({
        tableInstance: null,

        propTypes: {
            changeAppMode: PropTypes.func.isRequired
        },

        getInitialState() {
            return {
                data: [],
                pages: null,
                loading: true,
                sorted: [{id: 'name', desc: false}]
            };

            this.fetchData = this.fetchData.bind(this)
        },

        componentWillMount() {
            this.dataRequest = this.props.bcApi.v1.dataRequest;
        },

        componentDidUpdate() {
            $('.showToolTip').tooltip();
        },

        fetchData(state, instance) {
            // Whenever the table model changes, or the user sorts or changes pages, this method gets called and passed the current table model.
            // You can set the `loading` prop of the table to true to use the built-in one or show you're own loading bar if you want.
            this.tableInstance = instance;
            this.loadData();
        },

        loadData() {
            var tableState = this.tableInstance.state;
            this.setState({loading: true})
            this.dataRequest('regex', 'table', {
                pageSize: tableState.pageSize,
                page: tableState.page,
                sorted: tableState.sorted,
                filtered: tableState.filtered
            })
                .then((regexes) => {
                    this.setState({
                        data: regexes,
                        pages: 1,
                        loading: false
                    });
                })
                .catch((e) => {
                    this.setState({error: e});
                })
        },

        handleEdit(event, row) {
            this.props.changeAppMode('edit', row.value);
        },

        handleAdd(event, row) {
            this.props.changeAppMode('create');
        },

        handleDelete(event, row) {
            var self = this;
            ConfirmDialog.showDialog('Are you sure?')
                .then(function () {
                    self.dataRequest('regex', 'delete', row.value)
                        .then(function () {
                            self.loadData(self.state);
                        })
                        .catch(function (e) {
                            console.error(e);
                        })
                })
        },

        render() {
            const filterComponent = ({filter, onChange}) =>
                <input type="text" className="form-control" style={{width: '100%'}}
                       onChange={event => onChange(event.target.value)}/>;

            const columns = [{
                Header: 'Name',
                accessor: 'name',
                Filter: filterComponent
            }, {
                Header: 'Pattern',
                accessor: 'pattern',
                className: 'regex-column',
                Filter: filterComponent
            }, {
                Header: 'Concept',
                accessor: 'concept',
                Filter: filterComponent
            }, {
                Header: 'Actions',
                accessor: 'id',
                width: 150,
                filterable: false,
                sortable: false,
                Cell: row => (
                    <div className="text-center">
                        <div className="btn-group btn-group-sm">
                            <button title="Edit" data-placement='bottom' className="btn btn-link showToolTip"
                                    href="#" onClick={(e) => this.handleEdit(e, row)}>
                                <i className="material-icons md-18">create</i>
                            </button>
                            <button title="Delete" data-placement='bottom' className="btn btn-link showToolTip"
                                    href="#" onClick={(e) => this.handleDelete(e, row)}>
                                <i className="material-icons md-18">delete_forever</i>
                            </button>
                        </div>
                    </div>
                )
            }];

            return (
                <div className="panel">
                    <div className="panel-heading">
                        <div className="panel-heading-title">RegEx Extractors</div>
                        <div className="panel-heading-subtitle text-muted">
                            Extract entities from text using RegEx expressions
                        </div>

                        <div className="btn-group">
                            <button className="btn btn-blue" onClick={(e) => {
                                this.handleAdd(e)
                            }}>Add
                            </button>
                        </div>
                    </div>


                    <div className="panel-body">
                        <ReactTable
                            className='-striped -highlight'
                            data={this.state.data} // Set the rows to be displayed
                            loading={this.state.loading} // Display the loading overlay when we need it
                            onFetchData={this.fetchData} // Request new data when things change
                            columns={columns}
                            defaultPageSize={10}
                            filterable
                            sorted={this.state.sorted}
                            noDataText={'No records'}
                        />
                    </div>
                </div>
            )
        }
    });


    return RegexList;
});
