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
    'react', 'create-react-class', 'react-table', 'public/v1/api',
    '../../../../components/Modal', './RelationshipForm', 'swal'
], function(React, createReactClass, ReactTableDef, bcApi, Modal, RelationshipForm, swal) {
    'use strict';

    const ReactTable = ReactTableDef.default;

    const RelationshipList = createReactClass({
        tableInstance: null,

        getInitialState() {
            return {
                data: [],
                ontology: {},
                pages: null,
                loading: true,
                sorted: [{ id: 'name', desc: false }],
                selectedWorkspace: ONTOLOGY_CONSTANTS.PUBLIC_ONTOLOGY,
                workspaces: []
            };
        },

        componentDidMount() {
            this.loadWorkspaces();
        },

        fetchData (state, instance) {
            // Whenever the table model changes, or the user sorts or changes pages, this method gets called and passed the current table model.
            // You can set the `loading` prop of the table to true to use the built-in one or show you're own loading bar if you want.
            this.tableInstance = instance;
            this.loadData();
        },

        componentWillReceiveProps(nextProps) {
            this.loadData();
        },

        loadWorkspaces() {
            bcApi.connect().then(({ dataRequest }) => {
                dataRequest('workspace', 'all')
                    .then((workspaces) => {
                        this.setState({workspaces});
                    });
            });
        },

        loadData() {
            this.setState({loading: true})
            bcApi.connect().then(({ dataRequest }) => {
                let dataRequestPromise = this.state.selectedWorkspace === ONTOLOGY_CONSTANTS.PUBLIC_ONTOLOGY ? dataRequest('admin', 'publicOntology')
                    : dataRequest('admin', 'workspaceOntology', this.state.selectedWorkspace);

                dataRequestPromise
                    .then((ontology) => {
                        const rels = _.filter(ontology.relationships, c => !c.coreConcept);

                        this.setState({
                            data: rels,
                            ontology: ontology,
                            pages: 1,
                            loading: false
                        });
                    })
                    .catch((e) => {
                        this.setState({error: e});
                    })
            });
        },

        handleAdd() {
            Modal.showModal(RelationshipForm, {relationship: {}, addmode: true, ontology: this.state.ontology})
                .then((response) => {
                    const { relationship, operation } = response;

                    if(operation === 'save') {
                        bcApi.connect().then(({dataRequest}) => {
                            dataRequest('admin', 'ontologyRelSave', this.state.selectedWorkspace, relationship)
                                .then(() => this.loadData())
                                .catch(e => {
                                    swal({
                                        title: 'Error!',
                                        text: 'The property could not be added',
                                        type: 'error',
                                    });
                                })
                        });
                    }
                });
        },

        workspaceChanged(newWorkspaceId) {
            this.setState({
                data: [],
                ontology: {},
                pages: null,
                loading: true,
                sorted: [{ id: 'name', desc: false }],
                selectedWorkspace: newWorkspaceId
            }, () => this.loadData());
        },

        handleEdit(event, row) {
            Modal.showModal(RelationshipForm, {relationship: row.original, addmode: false, ontology: this.state.ontology})
                .then((response) => {
                    bcApi.connect().then(({ dataRequest }) => {
                        const { relationship, operation } = response;

                        if(operation === 'save') {
                            dataRequest('admin', 'ontologyRelSave', this.state.selectedWorkspace, relationship)
                                .then(() => this.loadData())
                                .catch(e => {
                                    swal({
                                        title: 'Eroare!',
                                        text: 'Relatia nu a putut fi adaugata',
                                        type: 'error',
                                    });
                                });
                        } else if(operation === 'delete') {
                            dataRequest('admin', 'ontologyRelDelete', this.state.selectedWorkspace, relationship.title)
                                .then(() => this.loadData())
                                .catch(e => {
                                    let text = 'Relatia nu a putut fi stearsa';
                                    if (e.json && e.json.error) {
                                        text = e.json.error;
                                    }
                                    swal({
                                        title: 'Eroare!',
                                        text,
                                        type: 'error',
                                    });
                                });
                        }
                    });
                });
        },

        handleDelete(event, row) {
            const relId = row.original.title;

            swal({
                title: 'Sunteti sigur?',
                text: "Aceasta actiune este ireversibila",
                type: 'warning',
                showCancelButton: true
            }).then((result) => {
                if (result.value) {
                    bcApi.connect().then(({ dataRequest }) => {
                        dataRequest('admin', 'ontologyRelDelete', this.state.selectedWorkspace, relId)
                            .then(() => this.loadData())
                            .catch(e => {
                                let text = 'Relatia nu a putut fi stearsa';
                                if (e.json && e.json.error) {
                                    text = e.json.error;
                                }
                                swal({
                                    title: 'Error!',
                                    text,
                                    type: 'error',
                                });
                            });
                    });
                }
            });
        },

        render() {
            const workspaceOptions = this.state.workspaces.map(w => (
                <option key={w.workspaceId} value={w.workspaceId}>{w.title}</option>
            ));

            const columns = [{
                Header: 'Cod',
                accessor: 'title'
            }, {
                Header: 'Nume',
                accessor: 'displayName'
            }, {
                id: 'domainConceptIris',
                Header: 'Sursa',
                accessor: (row) => String(row.domainConceptIris.join(', '))
            }, {
                id: 'rangeConceptIris',
                Header: 'Destinatie',
                accessor: (row) => String(row.rangeConceptIris.join(', '))
            }, {
                id: 'coreConcept',
                Header: 'Sistem',
                accessor: (row) => String(row.coreConcept)
            }, {
                Header: 'Actiuni',
                accessor: 'id',
                width: 150,
                filterable: false,
                sortable: false,

                Cell: row => (
                    <div className="text-center">
                        <div className="btn-group btn-group-sm">
                            <button title="Editeaza" data-placement='bottom' className="btn btn-link showToolTip"
                                    onClick={(e) => this.handleEdit(e, row)}>
                                <i className="material-icons md-18">create</i>
                            </button>

                            {!row.original.coreConcept && (
                                <button title="Sterge" data-placement='bottom' className="btn btn-link showToolTip"
                                        onClick={(e) => this.handleDelete(e, row)}>
                                    <i className="material-icons md-18">delete_forever</i>
                                </button>
                            )}
                        </div>
                    </div>
                )
            }];

            return (
                <div className="panel">
                    <div className="panel-heading">
                        <div className="panel-heading-title">Relatii</div>
                        <div className="panel-heading-subtitle text-muted">
                            Relatii posibile intre concepte
                        </div>

                        <div className="btn-group">
                            <button className="btn btn-blue" onClick={(e) => {
                                this.handleAdd(e)
                            }}>Add
                            </button>
                        </div>
                    </div>

                    <div className="panel-body">
                        <div className="form-group" style={{display: 'none'}}>
                            <label className="control-label" htmlFor="workspaceSelector">Workspace</label>
                            <select className="custom-select form-control" id="workspaceSelector"
                                    value={this.state.selectedWorkspace}
                                    onChange={(e) => { this.workspaceChanged(e.target.value) }}>
                                <option key={ONTOLOGY_CONSTANTS.PUBLIC_ONTOLOGY} value={ONTOLOGY_CONSTANTS.PUBLIC_ONTOLOGY}>PUBLIC</option>
                            </select>
                        </div>

                        <ReactTable
                            className='-striped -highlight'
                            data={this.state.data} // Set the rows to be displayed
                            loading={this.state.loading} // Display the loading overlay when we need it
                            onFetchData={this.fetchData} // Request new data when things change
                            columns={columns}
                            defaultPageSize={10}
                            filterable
                            sorted={this.state.sorted}
                        />
                    </div>
                </div>
            )

        }
    });

    return RelationshipList;
});

