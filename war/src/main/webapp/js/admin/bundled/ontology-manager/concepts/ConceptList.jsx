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
    'public/v1/api', 'react', 'create-react-class', '../../../../components/Tree', './ConceptForm', 'swal'
], function(bcApi, React, createReactClass, Tree, ConceptForm, swal) {
    'use strict';

    const OntologyEntities = createReactClass({
        getInitialState() {
            return {
                concepts:[],
                properties: [],
                treeData: {},
                selectedConcept: null,
                selectedWorkspace: ONTOLOGY_CONSTANTS.PUBLIC_ONTOLOGY,
                workspaces: []
            };
        },

        componentDidMount() {
            this.loadWorkspaces();
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
            bcApi.connect().then(({ dataRequest }) => {
                let dataRequestPromise = this.state.selectedWorkspace === ONTOLOGY_CONSTANTS.PUBLIC_ONTOLOGY ? dataRequest('admin', 'publicOntology')
                    : dataRequest('admin', 'workspaceOntology', this.state.selectedWorkspace);

                dataRequestPromise.then((ontology) => {
                    const concepts = _.chain(ontology.concepts).filter(c => (!c.coreConcept || c.id === ONTOLOGY_CONSTANTS.THING_CONCEPT)).value();
                    const conceptsById = _.indexBy(concepts, 'id');
                    const properties = _.chain(ontology.properties).filter(p => p.userVisible).indexBy('title').value();
                    const treeData = {
                        core: {
                            force_text: true,
                            multiple : false,
                            animation: 0,
                            check_callback: true,
                            data: concepts.map(c => {
                                return {
                                    id: c.id,
                                    parent: c.parentConcept ? c.parentConcept : '#',
                                    text: c.displayName,
                                    icon: `/${c.glyphIconHref}`,
                                    state: { opened: true }
                                };
                            })
                        },
                        plugins : [ 'contextmenu', 'sort' ],
                        contextmenu: {
                            items: {
                                createItem: {
                                    label: "Create",
                                    action: function (data) {
                                        var inst = $.jstree.reference(data.reference),
                                            obj = inst.get_node(data.reference);
                                        inst.deselect_node(obj);
                                        inst.create_node(obj, {id:`new#${new Date().getTime()}`}, "last", function (new_node) {
                                            inst.select_node(new_node);
                                        });
                                    }
                                },
                            }
                        }
                    };

                    this.setState({ concepts : conceptsById, properties, treeData });
                })
                .catch((e) => {
                    this.setState({error: e});
                })
            });
        },

        workspaceChanged(newWorkspaceId) {
            this.setState({
                concepts:[],
                properties: [],
                treeData: {},
                selectedConcept: null,
                selectedWorkspace: newWorkspaceId
            }, () => this.loadData());
        },

        handleChange(e, data) {
            if(data.action === 'select_node') {
                this.setState({
                    selectedConcept: data.node.id.startsWith('new#') ?
                        {
                            coreConcept: false,
                            id: data.node.id,
                            parentConcept: data.node.parent,
                            title: '',
                            displayName: '',
                            userVisible: true,
                            searchable: true,
                            deleteable: true,
                            updateable: true,
                            intents: [],
                            displayType: '',
                            color: '',
                            glyphIconHref: '',
                            titleFormula: '',
                            subtitleFormula: '',
                            timeFormula: '',
                        }
                        : this.state.concepts[data.node.id]
                });
            }
        },

        handleConceptSave(concept) {
            this.loadData();
            this.setState({selectedConcept: null});

            swal({
                title: 'Actualizare cu succes',
                text: 'Va rugam sa va reconectati la sistem',
                type: 'info',
            });
        },

        render() {
            if(this.state.concepts.length == 0) {
                return <div/>;
            }

            const workspaceOptions = this.state.workspaces.map(w => (
                <option key={w.workspaceId} value={w.workspaceId}>{w.title}</option>
            ));

            return (
                <div className="container-fluid">
                    <div className="row">
                        <div className="col-md-3">
                            <div className="form-group" style={{display: 'none'}}>
                                <label className="control-label" htmlFor="workspaceSelector">Spatii de lucru</label>
                                <select className="custom-select form-control" id="workspaceSelector"
                                        value={this.state.selectedWorkspace}
                                        onChange={(e) => { this.workspaceChanged(e.target.value) }}>
                                    <option key={ONTOLOGY_CONSTANTS.PUBLIC_ONTOLOGY} value={ONTOLOGY_CONSTANTS.PUBLIC_ONTOLOGY}>General</option>
                                </select>
                            </div>

                           <Tree
                               treeData={this.state.treeData}
                               onChange={(e, data) => this.handleChange(e, data)}
                           />
                        </div>
                        <div className="col-md-9">
                            {this.state.selectedConcept &&
                                <ConceptForm
                                    workspaceId={this.state.selectedWorkspace}
                                    concept={this.state.selectedConcept}
                                    saveHandler={this.handleConceptSave}
                                />
                            }
                        </div>
                    </div>
                </div>
            )
        }
    });

    return OntologyEntities;
});

