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
    'react-redux',
    'create-react-class',
    'react-table',
    '../../components/ConfirmDialog',
    '../../components/InfoModal',
    '../../components/Alert'
], function(React, redux, createReactClass, ReactTableDef, ConfirmDialog, InfoModal, Alert) {
    'use strict';

    const ReactTable = ReactTableDef.default;

    const DataConnectionList = createReactClass({
        tableInstance: null,

        getInitialState() {
            return {
                data: [],
                sorted: [{ id: 'name', desc: false }],
                loading: true,
                dsError: null,
                dcError: null,
                expandedRow: {}
            };
        },

        componentDidUpdate() {
            $('.showToolTip').tooltip();
        },

        fetchData (state, instance) {
            // Whenever the table model changes, or the user sorts or changes pages, this method gets called and passed the current table model.
            // You can set the `loading` prop of the table to true to use the built-in one or show you're own loading bar if you want.
            this.tableInstance = instance;
            this.loadData();
        },

        loadData() {
            var tableState = this.tableInstance.state;
            this.setState({loading: true});

            this.props.dataRequest('dataload', 'table', {pageSisze: tableState.pageSize, page: tableState.page, sorted: tableState.sorted, filtered: tableState.filtered})
                .then((dataConnections) => {
                    this.setState({
                        data: dataConnections,
                        loading: false
                    });
                })
                .catch((e) => {
                    this.setState({dcError: e});
                })
        },

        handleEdit(event, row) {
            this.props.changeAppMode('edit', row.value, null);
        },

        handleEditDS(event, row) {
            this.props.changeAppMode('editDataSource', row.original.dcId, row.original);
        },

        handleAdd(event, row) {
            this.props.changeAppMode('create');
        },

        handleDelete(event, row) {
            var self = this;
            ConfirmDialog.showDialog('Confirm', 'Are you sure? Deleting the connection will also delete all Data Sources!')
                .then(function() {
                    self.props.dataRequest('dataload', 'delete', { dcId: row.value })
                        .then(function() {
                            self.loadData(self.state);
                        })
                        .catch(function(e) {
                            console.error(e);
                        })
                })
        },

        handleDeleteDS(event, row) {
            var self = this;
            ConfirmDialog.showDialog('Confirm', 'Are you sure?')
                .then(function() {
                    self.props.dataRequest('dataload', 'delete', { dsId: row.value })
                        .then(function() {
                            self.loadData(self.state);
                        })
                        .catch(function(e) {
                            console.error(e);
                        })
                })
        },

        handleAddDataSource(event, row) {
            this.props.changeAppMode('createDataSource', row.value, null);
        },

        handlePreviewDS(event, row) {
            InfoModal.showDialog({
                title: 'Preview',
                buttonLabel: 'Close',
                loadData: this.props.dataRequest('dataload', 'preview', row.original.dcId, row.original.sqlSelect)
                    .then((preview) => {
                        const rowData = preview.rows.map(row => {
                            return row.columns;
                        });

                        const dataCols = preview.columns.map((c, idx) => {
                            return {
                                Header: c.name,
                                id: c.name,
                                accessor: d => {
                                    return d[idx];
                                }
                            }
                        });

                        const columns = [{
                            columns: dataCols
                        }];

                        return (
                            <ReactTable
                                className='-striped -highlight'
                                data={rowData} // Set the rows to be displayed
                                columns={columns}
                                defaultPageSize={rowData.length}
                                showPageSizeOptions={false}
                                showPagination={false}
                            />
                        )
                    })
            });
        },

        handleRefresh(event) {
            this.tableInstance.fireFetchData();
        },

        handleStartDS(event, row) {
            var self = this;
            if(row.original.importRunning) {
                this.setState({
                    dsError: { statusText: 'The import is already running.' }
                });
                return;
            }

            ConfirmDialog.showDialog('Confirm', 'Are you sure you want to start the import ?')
                .then(function() {
                    self.props.dataRequest('dataload', 'import', {
                        dcId: row.original.dcId,
                        dsId: row.original.dsId,
                        name: row.original.name,
                        description: row.original.description,
                        maxRecords: row.original.maxRecords,
                        sqlSelect: row.original.sqlSelect,
                        entityMappings: row.original.entityMappings,
                        relMappings: row.original.relMappings,
                        importConfig: row.original.importConfig
                    }).done(() => {
                        self.tableInstance.fireFetchData();
                    });
                })
        },

        handleDsAlertDismiss() {
            this.setState({
                dsError: null
            });
        },

        handleDcAlertDismiss() {
            this.setState({
                dcError: null
            });
        },

        render() {
            const filterComponent = ({ filter, onChange }) =>
                <input type="text" className="form-control" style={{width: '100%'}}
                       onChange={event => onChange(event.target.value)} />;

            const columns = [{
                Header: 'Name',
                accessor: 'name',
                Filter: filterComponent
            }, {
                Header: 'Description',
                accessor: 'description',
                Filter: filterComponent
            }, {
                Header: 'Driver',
                accessor: 'driverClass',
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
                            <button title="Add Data Source" data-placement='bottom' className="btn btn-link showToolTip"
                                    href="#" onClick={(e) => this.handleAddDataSource(e, row)}>
                                <i className="material-icons md-18">add_circle_outline</i>
                            </button>
                        </div>
                    </div>
                )
            }];

            const dataSourceColumns = [{
                Header: 'Name',
                accessor: 'name'
            }, {
                Header: 'Description',
                accessor: 'description'
            }, {
                id: 'importRunning',
                Header: 'Import Running',
                accessor: row => String(row.importRunning)
            }, {
                Header: 'Last Import',
                accessor: 'lastImportDate'
            }, {
                Header: 'Actions',
                accessor: 'dsId',
                width: 190,
                filterable: false,
                sortable: false,
                Cell: row => (
                    <div className="text-center">
                        <div className="btn-group btn-group-sm">
                            <button title="Edit" data-placement='top' className="btn btn-link showToolTip" href="#" onClick={(e) => this.handleEditDS(e, row)}><i className="material-icons md-18">create</i></button>
                            <button title="Delete" data-placement='top' className="btn btn-link showToolTip" href="#" onClick={(e) => this.handleDeleteDS(e, row)}><i className="material-icons md-18">delete_forever</i></button>
                            <button title="Preview" data-placement='top' className="btn btn-link showToolTip" href="#" onClick={(e) => this.handlePreviewDS(e, row)}><i className="material-icons md-18">grid_on</i></button>
                            <button title="Start Import" data-placement='top' className="btn btn-link showToolTip" href="#" onClick={(e) => this.handleStartDS(e, row)}><i className="material-icons md-18">play_arrow</i></button>
                        </div>
                    </div>
                )
            }];

            return (
                <div className="panel panelFileIngest">
                    <div className="panel-heading">
                        <div className="panel-heading-title">Data Ingestion</div>
                        <div className="panel-heading-subtitle text-muted">
                            Incarca din surse JDBC
                        </div>

                        <div className="btn-group">
                            <button className="btn btn-blue m-x-1" onClick={(e) => this.handleAdd(e)}>Add</button>
                            <button className="btn btn-blue" style={{marginRight: '10px'}} onClick={(e) => this.handleRefresh(e)}>Refresh</button>
                            <button className="btn btn-warning" style={{marginRight: '10px'}} onClick={() => this.props.onSetLoadType('')}>Cancel</button>
                        </div>
                    </div>

                    <div className="panel-body">
                        <Alert error={this.state.dcError} onDismiss={this.handleDcAlertDismiss}/>

                        <ReactTable
                            className='-striped'
                            data={this.state.data}
                            loading={this.state.loading}
                            onFetchData={this.fetchData}
                            columns={columns}
                            defaultPageSize={10}
                            filterable
                            sortable={false}
                            sorted={this.state.sorted}
                            expanded={this.state.expandedRow}
                            onExpandedChange={(newExpanded, index, event) => {
                                this.setState({expandedRow : newExpanded})
                            }}
                            SubComponent={(row) => {
                                return (
                                    <div style={{padding: '15px', backgroundColor: '#ddf0ef'}}>
                                        <h4 style={{paddingBottom: '10px', margin: '0'}}>Data Sources</h4>
                                        <Alert error={this.state.dsError} onDismiss={this.handleDsAlertDismiss}/>

                                        <ReactTable
                                            className='DataSourceTable -striped'
                                            data={row.original.dataSources}
                                            columns={dataSourceColumns}
                                            showPagination={false}
                                            defaultPageSize={row.original.dataSources.length}
                                        />
                                    </div>
                                )
                            }}
                        />
                    </div>
                </div>
            )
        }
    });

    return DataConnectionList;
});
