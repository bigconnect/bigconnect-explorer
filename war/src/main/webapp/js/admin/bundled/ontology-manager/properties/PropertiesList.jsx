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
    'public/v1/api', 'react', 'react-dom', 'prop-types', 'create-react-class', 'react-table',
    '../../../../components/Modal', './PropertyForm', './SelectPropertyForm', 'swal'
], function(bcApi, React, ReactDOM, PropTypes, createReactClass,
            ReactTableDef, Modal, PropertyForm, SelectPropertyForm, swal)
{
    'use strict';

    const ReactTable = ReactTableDef.default;

    const PropertiesList = createReactClass({
        propTypes: {
            workspaceId: PropTypes.string,
            conceptId: PropTypes.string,
            relId: PropTypes.string,
            showInheritedProps: PropTypes.bool,
            showWorkspaceSelector: PropTypes.bool
        },

        tableInstance: null,

        getDefaultProps() {
            return {
                showWorkspaceSelector: true,
            };
        },

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

        loadWorkspaces() {
            bcApi.connect().then(({ dataRequest }) => {
                dataRequest('workspace', 'all')
                    .then((workspaces) => {
                        this.setState({workspaces});
                    });
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

        fetchData (state, instance) {
            // Whenever the table model changes, or the user sorts or changes pages, this method gets called and passed the current table model.
            // You can set the `loading` prop of the table to true to use the built-in one or show you're own loading bar if you want.
            this.tableInstance = instance;
            this.loadData();
        },

        componentDidMount() {
            if(this.props.showWorkspaceSelector) {
                this.loadWorkspaces()
            }
        },

        componentWillReceiveProps() {
            this.loadData();
        },

        loadData() {
            this.setState({loading: true})
            bcApi.connect().then(({ dataRequest }) => {
                let dataRequestPromise = this.getWorkspaceIdOrDefault() === ONTOLOGY_CONSTANTS.PUBLIC_ONTOLOGY ? dataRequest('admin', 'publicOntology')
                    : dataRequest('admin', 'workspaceOntology', this.getWorkspaceIdOrDefault());

                dataRequestPromise.then((ontology) => {
                        let ontologyProperties = [];

                        if(this.props.conceptId) {
                            ontologyProperties = this.getPropertiesByConcept(this.props.conceptId, ontology, this.props.showInheritedProps);
                        } else if(this.props.relId) {
                            ontologyProperties = this.getPropertiesByRelationship(this.props.relId, ontology, this.props.showInheritedProps);
                        } else
                            ontologyProperties = ontology.properties;

                        this.setState({
                            data: ontologyProperties,
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

        getWorkspaceIdOrDefault() {
            if(this.props.showWorkspaceSelector) {
                return this.state.selectedWorkspace;
            } else if(this.props.workspaceId) {
                return this.props.workspaceId
            } else
                return ONTOLOGY_CONSTANTS.PUBLIC_ONTOLOGY;
        },

        getPropertiesByConcept(conceptId, ontology, includeInherited = false) {
            var conceptsById = _.indexBy(ontology.concepts, "id");
            var propertiesByTitle = _.indexBy(ontology.properties, 'title');

            var propertyIds = [],
                collectPropertyIds = function(conceptId) {
                    var concept = conceptsById[conceptId],
                        properties = concept && concept.properties,
                        parentConceptId = concept && concept.parentConcept;

                    if (properties && properties.length) {
                        propertyIds.push.apply(propertyIds, properties);
                    }
                    if (parentConceptId && includeInherited) {
                        collectPropertyIds(parentConceptId);
                    }
                };

            collectPropertyIds(conceptId);

            return _.chain(propertyIds)
                .uniq()
                .map(function(pId) {
                    return propertiesByTitle[pId];
                })
                // .filter(p => !p.systemProperty)
                .value();
        },

        getPropertiesByRelationship(relId, ontology, includeInherited = false) {
            var relsById = _.indexBy(ontology.relationships, "title");
            var propertiesByTitle = _.indexBy(ontology.properties, "title");

            var propertyIds = [],
                collectPropertyIds = function(relId) {
                    var rel = relsById[relId],
                        properties = rel && rel.properties,
                        parentRelId = rel && rel.parentIri;

                    if (properties && properties.length) {
                        propertyIds.push.apply(propertyIds, properties);
                    }
                    if (parentRelId && includeInherited) {
                        collectPropertyIds(parentRelId);
                    }
                };

            collectPropertyIds(relId);

            return _.chain(propertyIds)
                .uniq()
                .map(function(pId) {
                    return propertiesByTitle[pId];
                })
                .filter(p => !p.systemProperty)
                .value();
        },

        handleAdd() {
            Modal.showModal(PropertyForm, {property: {}, addmode: true})
                .then((response) => {
                    const { property, operation } = response;

                    if(operation === 'save') {
                        bcApi.connect().then(({dataRequest}) => {
                            dataRequest('admin', 'ontologyProperySave', property, this.props.conceptId, this.props.relId, this.getWorkspaceIdOrDefault())
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

        handleSelectProperty() {
            // remove existing & inherited properties from list
            const existingProps = this.props.conceptId ? this.getPropertiesByConcept(this.props.conceptId, this.state.ontology, true) :
                this.getPropertiesByRelationship(this.props.relId, this.state.ontology, true)

            const propsToSelect = _.chain(this.state.ontology.properties)
                .difference(existingProps)
                .filter(p => !p.systemProperty)
                .value();

            Modal.showModal(SelectPropertyForm, {properties: propsToSelect})
                .then((property) => {
                    bcApi.connect().then(({dataRequest}) => {
                        dataRequest('admin', 'ontologyProperyAddExisting', property, this.props.conceptId, this.props.relId, this.getWorkspaceIdOrDefault())
                            .then(() => this.loadData())
                            .catch(e => {
                                swal({
                                    title: 'Error!',
                                    text: 'The property could not be added',
                                    type: 'error',
                                });
                            })
                    });
                });
        },

        handleEdit(event, row) {
            Modal.showModal(PropertyForm, {property: row.original, addmode: false})
                .then((response) => {
                    bcApi.connect().then(({ dataRequest }) => {
                        const { property, operation } = response;

                        if(operation === 'save') {
                            dataRequest('admin', 'ontologyProperySave', property, this.props.conceptId, this.props.relId, this.getWorkspaceIdOrDefault())
                                .then(() => { this.refreshAppMessage(); this.loadData() })
                                .catch(e => {
                                    swal({
                                        title: 'Error!',
                                        text: 'The property could not be updated',
                                        type: 'error',
                                    });
                                })
                        } else if(operation === 'delete') {
                            dataRequest('admin', 'ontologyProperyDelete', property.title, this.getWorkspaceIdOrDefault())
                                .then(() => { this.refreshAppMessage(); this.loadData(); })
                                .catch(e => {
                                    swal({
                                        title: 'Error!',
                                        text: 'The property could not be deleted',
                                        type: 'error',
                                    });
                                })
                        }
                    });
                });
        },

        refreshAppMessage() {
            swal({
                title: 'Ontology updated',
                text: 'Please relogin for changes to take effect',
                type: 'info',
            });
        },

        isSystemProperty(row) {
            return row.original.systemProperty;
        },

        isDirectProperty(row) {
            let directProperties = this.props.conceptId ?
                this.getPropertiesByConcept(this.props.conceptId, this.state.ontology, false) :
                this.getPropertiesByRelationship(this.props.relId, this.state.ontology, false);

            directProperties = _.indexBy(directProperties, 'title');

            const propId = row.original.title;

            return directProperties[propId];
        },

        handleDelete(event, row) {
            const propId = row.original.title;

            swal({
                title: 'Are you sure ?',
                text: "This action cannot be undone",
                type: 'warning',
                showCancelButton: true,
            }).then((result) => {
                if (result.value) {
                    bcApi.connect().then(({ dataRequest }) => {
                        dataRequest('admin', 'ontologyProperyDelete', propId, this.getWorkspaceIdOrDefault())
                            .then(() => this.loadData())
                            .catch(e => {
                                swal({
                                    title: 'Error!',
                                    text: 'The property could not be deleted',
                                    type: 'error',
                                });
                            })
                    });
                }
            });
        },

        handleUnassign(event, row) {
            const propId = row.original.title;

            swal({
                title: 'Question',
                text: "Unassign property from object ?",
                type: 'info',
                showCancelButton: true,
                confirmButtonText: 'Unassign',
            }).then((result) => {
                if (result.value) {
                    bcApi.connect().then(({ dataRequest }) => {
                        dataRequest('admin', 'ontologyProperyRemoveExisting', propId, this.props.conceptId, this.props.relId, this.getWorkspaceIdOrDefault())
                            .then(() => this.loadData())
                            .catch(e => {
                                swal({
                                    title: 'Error!',
                                    text: 'The property could not be unassigned',
                                    type: 'error',
                                });
                            })
                    });
                }
            });
        },

        render() {
            const workspaceOptions = this.state.workspaces.map(w => (
                <option key={w.workspaceId} value={w.workspaceId}>{w.title}</option>
            ));

            const columns = [{
                Header: 'Name',
                accessor: 'title'
            }, {
                id: 'displayName',
                Header: 'Display name',
                accessor: (row) => (row.displayName && row.displayName.length > 30) ? row.displayName.substring(0, 20) + '...' : row.displayName
            }, {
                Header: 'Data Type',
                accessor: 'dataType'
            }, {
                id: 'systemProperty',
                Header: 'System',
                accessor: (row) => String(row.systemProperty)
            }, {
                Header: 'Actions',
                accessor: 'id',
                width: 150,
                filterable: false,
                sortable: false,

                Cell: row => (
                    <div className="text-center">
                        <div className="btn-group btn-group-sm">
                            <button title="Edit" data-placement='bottom' className="btn btn-link  showToolTip"
                                    onClick={(e) => this.handleEdit(e, row)}>
                                <i className="material-icons md-18">create</i>
                            </button>

                            {this.isDirectProperty(row) && (
                                <button title="Unassign" data-placement='bottom' className="btn btn-link  showToolTip"
                                        disabled={this.isSystemProperty(row)}
                                        onClick={(e) => this.handleUnassign(e, row)}>
                                    <i className="material-icons md-18">radio_button_unchecked</i>
                                </button>
                            )}

                            {this.isDirectProperty(row) && (
                                <button title="Delete" data-placement='bottom' className="btn btn-link showToolTip"
                                        disabled={this.isSystemProperty(row)}
                                        onClick={(e) => this.handleDelete(e, row)}>
                                    <i className="material-icons md-18">delete_forever</i>
                                </button>
                            )}
                        </div>
                    </div>
                )
            }];

            return (
                <div className="container-fluid">
                    {(this.props.conceptId || this.props.relId) &&
                        (<div className="col-sm-12">
                            <div className="tableButtonBar">
                                <div className="btn-group pull-right">
                                    <button className="btn btn-blue m-x-1" onClick={this.handleSelectProperty}>Assign existing</button>
                                    <button className="btn btn-blue" onClick={this.handleAdd}>Add new</button>
                                </div>
                            </div>
                        </div>)
                    }

                    {this.props.showWorkspaceSelector &&
                        (<div className="col-sm-12">
                            <div className="form-group">
                                <label className="control-label" htmlFor="workspaceSelector">Workspace</label>
                                <select className="custom-select form-control" id="workspaceSelector"
                                        value={this.state.selectedWorkspace}
                                        onChange={(e) => { this.workspaceChanged(e.target.value) }}>
                                    <option key={ONTOLOGY_CONSTANTS.PUBLIC_ONTOLOGY} value={ONTOLOGY_CONSTANTS.PUBLIC_ONTOLOGY}>PUBLIC</option>
                                    {workspaceOptions}
                                </select>
                            </div>
                        </div>)
                    }

                    <div className="col-sm-12 p-t-1">
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

    return PropertiesList;
});
