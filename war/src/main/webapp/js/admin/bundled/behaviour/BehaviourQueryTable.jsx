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
    'react-dom',
    'prop-types',
    'create-react-class',
    'react-virtualized-select',
    'react-table',
    '../../../components/ConfirmDialog'
], function(bcApi, React, ReactDOM, PropTypes, createReactClass, { default: VirtualizedSelect }, ReactTableDef, ConfirmDialog) {

    const ReactTable = ReactTableDef.default;

    const BehaviourQueryTable = createReactClass({
        tableInstance: null,

        propTypes: {
            addQueryRow: PropTypes.func.isRequired,
            updateQueryRow: PropTypes.func.isRequired,
            deleteQueryRow: PropTypes.func.isRequired,
            queryData: PropTypes.array.isRequired
        },

        getInitialState() {
            return {
                savedSearches: null,
                selectorLoading: true
            };
        },

        componentDidMount() {
            bcApi.connect().then(({ dataRequest }) => {
                dataRequest('search', 'all')
                    .then((savedSearches) => {
                        let selectOptions = _.map(savedSearches, search => {
                            return {
                                label: search.name,
                                value:search.id
                            };
                        })
                        this.setState({
                            savedSearches: selectOptions,
                            selectorLoading: false
                        });
                    })
                    .catch((e) => {
                        this.setState({error: e});
                    })
            });
        },

        componentDidUpdate() {
            $('.showToolTip').tooltip();
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
                .then(function() {
                    self.dataRequest('behaviour', 'delete', row.value)
                        .then(function() {
                            self.loadData(self.state);
                        })
                        .catch(function(e) {
                            console.error(e);
                        })
                })
        },

        render() {
            const queryTableClumns = [{
                Header: 'Queries',
                columns: [{
                    Header: 'Saved Search',
                    accessor: 'savedSearchId',
                    Cell: row => (
                        <VirtualizedSelect
                            className="form-control"
                            options={this.state.savedSearches}
                            multi={false}
                            value={row.original.savedSearchId}
                            onChange={(val) => {
                                row.original.savedSearchId = (val && val.value) || null;
                                this.props.updateQueryRow(row);
                            }}
                            isLoading={this.state.selectorLoading}
                        />
                    )
                }, {
                    Header: 'Score',
                    accessor: 'score',
                    Cell: row => (
                        <input type="text"
                               className="form-control"
                               value={row.original.score}
                               required
                               placeholder="Question score (numeric)"
                               onChange={(e) => {
                                   row.original.score = e.target.value;
                                   this.props.updateQueryRow(row);
                               }}
                        />
                    )
                }, {
                    Header: 'Actions',
                    accessor: 'id',
                    width: 150,
                    filterable: false,
                    sortable: false,
                    Cell: row => (
                        <div className="text-center">
                            <div className="btn-group btn-group-sm">
                                <button title="Delete" data-placement='bottom' className="btn btn-default showToolTip" href="#" onClick={(e) => this.props.deleteQueryRow(e, row)}><i className="material-icons md-18">delete_forever</i></button>
                            </div>
                        </div>
                    )
                }]
            }];

            return (
                <div className="container-fluid">
                    <div className="col-sm-12">
                        <div className="tableButtonBar">
                            <div className="btn-group pull-right">
                                <button className="btn btn-blue" onClick={(e) => { this.props.addQueryRow(e)}}>Add Query</button>
                            </div>
                        </div>
                    </div>

                    <div className="col-sm-12">
                        <div className='table-wrap'>
                            <ReactTable
                                data={this.props.queryData} // Set the rows to be displayed
                                columns={queryTableClumns}
                                defaultPageSize={10}
                                showPagination={false}
                            />
                        </div>
                    </div>
                </div>
            )
        }
    });


    return BehaviourQueryTable;
});
