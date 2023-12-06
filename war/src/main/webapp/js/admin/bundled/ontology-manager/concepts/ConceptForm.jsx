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
    'react', 'create-react-class', 'prop-types', 'util/deepEquals', 'public/v1/api',
    '../../../../components/field/GlyphSelector', '../../../../components/field/ColorSelector',
    '../properties/PropertiesList', 'swal'
], function(React, createReactClass, PropTypes, deepEquals, bcApi, GlyphSelector, ColorSelector, PropertiesList, swal) {
    'use strict';

    const ConceptForm = createReactClass({
        propTypes: {
            workspaceId: PropTypes.string.isRequired,
            concept: PropTypes.object.isRequired,
            saveHandler: PropTypes.func.isRequired
        },

        getInitialState() {
            return {
                extra_errors: [],
                concept: this.props.concept,
                properties: [],
                showInheritedProps: false
            };
        },

        componentWillReceiveProps(nextProps) {
            if(!deepEquals(this.props.concept, nextProps.concept)) {
                this.setState({ concept: nextProps.concept});
                this.loadProperties();
            }
        },

        loadProperties() {
            bcApi.connect().then(({ dataRequest }) => {
                let dataRequestPromise = this.props.workspaceId === ONTOLOGY_CONSTANTS.PUBLIC_ONTOLOGY ? dataRequest('admin', 'publicOntology')
                    : dataRequest('admin', 'workspaceOntology', this.props.workspaceId);

                dataRequestPromise.then((ontology) => {
                    this.setState({
                        properties: ontology.properties,
                    });
                })
                .catch((e) => {
                    this.setState({error: e});
                })
            });
        },

        delete() {
            swal({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                type: 'warning',
                showCancelButton: true
            }).then((result) => {
                if (result.value) {
                    bcApi.connect().then(({ dataRequest }) => {
                        dataRequest('admin', 'ontologyConceptDelete', this.props.workspaceId, this.state.concept.id)
                            .then(() => this.props.saveHandler(this.state.concept))
                            .catch(e => {
                                let text = 'The concept cannot be deleted';
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

        save() {
            if(this.valid()) {
                bcApi.connect().then(({ dataRequest }) => {
                    dataRequest('admin', 'ontologyConceptSave', this.props.workspaceId, this.normalizeKeys(this.state.concept))
                        .then(() => this.props.saveHandler(this.state.concept))
                        .catch(e => {
                            swal({
                                title: 'Eroare!',
                                text: 'Conceptul nu a putut fi salvat',
                                type: 'error',
                            });
                        })
                });
            }
        },

        valid() {
            const concept = this.state.concept;
            let errors = [];

            if(!concept.title) {
                errors.push('Titlul este obligatoriu');
            }

            if(!concept.displayName) {
                errors.push('Nume Display este obligatoriu');
            }

            this.setState({extra_errors: errors});

            return errors.length === 0;
        },

        normalizeKeys(c) {
            const isKeyDefined = (c, p) => c.hasOwnProperty(p) && c[p] != null && c[p] != undefined;

            if(!isKeyDefined(c, 'userVisible')) c.userVisible = false;
            if(!isKeyDefined(c, 'searchable')) c.searchable = false;
            if(!isKeyDefined(c, 'updateable')) c.updateable = false;
            if(!isKeyDefined(c, 'intents')) c.intents = [];
            if(!isKeyDefined(c, 'displayType')) c.displayType = '';
            if(!isKeyDefined(c, 'color')) c.color = '';
            if(!isKeyDefined(c, 'titleFormula')) c.titleFormula = '';
            if(!isKeyDefined(c, 'subtitleFormula')) c.subtitleFormula = '';
            if(!isKeyDefined(c, 'timeFormula')) c.timeFormula = '';
            return c;
        },

        setConceptState(key, value) {
            this.setState({ concept: {
                    ...this.state.concept,
                    [key]: value
                }
            });
        },

        render() {
            const concept = this.state.concept;
            const isNewConcept = concept.id.startsWith('new#');

            return (
                <div className="row">
                    <div className="col-md-12">
                        <div className="panel">
                            <div className="panel-heading">
                                <div className="panel-heading-title">{concept.title ? 'Concept: '+concept.title : 'Concept nou'}</div>
                            </div>

                            <div className="panel-body">
                                <ul className="nav nav-tabs nav-justified">
                                    <li className="active">
                                        <a href="#general" aria-controls="general" role="tab" data-toggle="tab">General</a>
                                    </li>
                                    <li style={{visibility: isNewConcept ? 'hidden' : 'visible'}}>
                                        <a href="#props" aria-controls="props" role="tab" data-toggle="tab">Proprietati</a>
                                    </li>
                                </ul>

                                <div className="tab-content">
                                    <div role="tabpanel" className="tab-pane active" id="general">
                                        <div className="errors">
                                            {this.state.extra_errors.length > 0 && (
                                                <div className="alert alert-danger">
                                                    <ul>
                                                        {this.state.extra_errors.map((err, index) => (
                                                            <li key={`err${index}`}>{err}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        <div className="form-horizontal">
                                            <div className="panel-group" id="accordion">
                                                {/* General options */}
                                                <div className="panel panel-default">
                                                    <div className="panel-body">
                                                        <div className="form-group">
                                                            <label htmlFor="title" className="col-md-3 control-label">Cod</label>
                                                            <div className="col-md-9">
                                                                <input id="title" type="text" className="form-control" placeholder="Codul intern"
                                                                       required
                                                                       value={concept.title}
                                                                       disabled={concept.coreConcept || !isNewConcept}
                                                                       onChange={(e) => { this.setConceptState('title', e.target.value) }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="form-group">
                                                            <label htmlFor="displayName" className="col-md-3 control-label">Nume</label>
                                                            <div className="col-md-9">
                                                                <input id="displayName" type="text" className="form-control" placeholder="Numele sub care este afisat"
                                                                       required
                                                                       disabled={concept.coreConcept}
                                                                       value={concept.displayName}
                                                                       onChange={(e) => { this.setConceptState('displayName', e.target.value) }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="form-group">
                                                            <label htmlFor="glyphIconHref" className="col-md-3 control-label">Imagine</label>
                                                            <div className="col-md-9">
                                                                <GlyphSelector
                                                                    placeholder='Concept icon'
                                                                    search={concept.glyphIconHref}
                                                                    onSelected={(c) => {
                                                                        this.setConceptState('glyphIconHref', c)}
                                                                    } />
                                                            </div>
                                                        </div>

                                                        <div className="form-group">
                                                            <div className="col-md-offset-3 col-md-9">
                                                                <div className="togglebutton">
                                                                    <label className="custom-control custom-checkbox">
                                                                        <input type="checkbox" className="custom-control-input"
                                                                               disabled={concept.coreConcept}
                                                                               checked={concept.userVisible}
                                                                               onChange={(e) => { this.setConceptState('userVisible', e.target.checked ) }}
                                                                        />
                                                                        <span className="custom-control-indicator"></span>
                                                                        Vizibil
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="form-group">
                                                            <div className="col-md-offset-3 col-md-9">
                                                                <div className="togglebutton">
                                                                    <label className="custom-control custom-checkbox">
                                                                        <input type="checkbox" className="custom-control-input"
                                                                               disabled={concept.coreConcept}
                                                                               checked={concept.searchable}
                                                                               onChange={(e) => { this.setConceptState('searchable', e.target.checked ) }}
                                                                        />
                                                                        <span className="custom-control-indicator"></span>
                                                                        Se poate cauta
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="form-group">
                                                            <div className="col-md-offset-3 col-md-9">
                                                                <div className="togglebutton">
                                                                    <label className="custom-control custom-checkbox">
                                                                        <input type="checkbox" className="custom-control-input"
                                                                               disabled={concept.coreConcept}
                                                                               checked={concept.deleteable}
                                                                               onChange={(e) => { this.setConceptState('deleteable', e.target.checked ) }}
                                                                        />
                                                                        <span className="custom-control-indicator"></span>
                                                                        Se poate sterge
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="form-group">
                                                            <div className="col-md-offset-3 col-md-9">
                                                                <div className="togglebutton">
                                                                    <label className="custom-control custom-checkbox">
                                                                        <input type="checkbox" className="custom-control-input"
                                                                               disabled={concept.coreConcept}
                                                                               checked={concept.updateable}
                                                                               onChange={(e) => { this.setConceptState('updateable', e.target.checked ) }}
                                                                        />
                                                                        <span className="custom-control-indicator"></span>
                                                                        Se poate edita
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="form-group" style={{display: 'none'}}>
                                                            <label htmlFor="intents" className="col-md-3 control-label">Intentii</label>
                                                            <div className="col-md-9">
                                                                <input id="intents" type="text" className="form-control" placeholder="Comma separated values"
                                                                       value={concept.intents ? concept.intents.join(',') : ''}
                                                                       disabled={concept.coreConcept}
                                                                       onChange={(e) => {
                                                                           const v = e.target.value.length == 0 ? [] : e.target.value.split(',');
                                                                           this.setConceptState('intents', v )}
                                                                       }
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Display options */}
                                                <div className="panel panel-default">
                                                    <div className="panel-heading">
                                                        <h4 data-toggle="collapse" data-parent="#accordion" href="#collapse2" className="panel-title expand">
                                                            <a href="#">Afisare</a>
                                                        </h4>
                                                    </div>
                                                    <div className="panel-body">
                                                        <div className="form-group">
                                                            <label htmlFor="dataType" className="col-md-3 control-label">Tip</label>
                                                            <div className="col-md-9">
                                                                <select id="displayType" className="custom-select form-control" required
                                                                        value={concept.displayType}
                                                                        disabled={concept.coreConcept}
                                                                        onChange={(e) => { this.setConceptState('displayType', e.target.value)} }
                                                                >
                                                                    <option value="">None</option>
                                                                    <option value="audio">Audio</option>
                                                                    <option value="image">Image</option>
                                                                    <option value="video">Video</option>
                                                                    <option value="document">Document</option>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div className="form-group">
                                                            <label htmlFor="color" className="col-md-3 control-label">Culoare</label>
                                                            <div className="col-md-9">
                                                                <ColorSelector value={concept.color} onSelected={(c) => this.setConceptState('color', c)} />
                                                            </div>
                                                        </div>

                                                        <div className="form-group">
                                                            <label htmlFor="titleFormula" className="col-md-3 control-label">Formula Titlu</label>
                                                            <div className="col-md-9">
                                                                    <textarea id="titleFormula" rows="5" className="form-control" placeholder="Snippet JavaScript cu instructiune de return"
                                                                              value={concept.titleFormula}
                                                                              onChange={(e) => { this.setConceptState('titleFormula', e.target.value) }}
                                                                    />
                                                            </div>
                                                        </div>

                                                        <div className="form-group">
                                                            <label htmlFor="subtitleFormula" className="col-md-3 control-label">Formula Subtitlu</label>
                                                            <div className="col-md-9">
                                                                    <textarea id="subtitleFormula" rows="5" className="form-control" placeholder="Snippet JavaScript cu instructiune de return"
                                                                              value={concept.subtitleFormula}
                                                                              onChange={(e) => { this.setConceptState('subtitleFormula', e.target.value) }}
                                                                    />
                                                            </div>
                                                        </div>

                                                        <div className="form-group">
                                                            <label htmlFor="timeFormula" className="col-md-3 control-label">Formula Timp</label>
                                                            <div className="col-md-9">
                                                                    <textarea id="timeFormula" rows="5" className="form-control" placeholder="Snippet JavaScript cu instructiune de return"
                                                                              value={concept.timeFormula}
                                                                              onChange={(e) => { this.setConceptState('timeFormula', e.target.value) }}
                                                                    />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className='form-footer'>
                                            <div className='text-center'>
                                                <button
                                                    style={{display: (concept.coreConcept || isNewConcept) ? 'none' : 'inline-block'}}
                                                    role='abort'
                                                    type='button'
                                                    className='btn btn-raised btn-danger'
                                                    onClick={this.delete}
                                                >Sterge</button>
                                                {' '}
                                                <button
                                                    role='confirm'
                                                    type='button'
                                                    className='btn btn-raised btn-primary'
                                                    onClick={this.save}
                                                >Salveaza</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div role="tabpanel" className="tab-pane" id="props">
                                        { !isNewConcept && (
                                            <div>
                                                <div className="row">
                                                    <div className="col-md-4 col-centered">
                                                        {/* Properties */}
                                                        <div style={{'paddingTop': '2em'}}>
                                                            <div className="togglebutton">
                                                                <label className="switcher switcher-primary" htmlFor="inheritedSwitcher">
                                                                    <input type="checkbox" id="inheritedSwitcher"
                                                                           checked={this.state.showInheritedProps}
                                                                           onChange={(e) => { this.setState({showInheritedProps: e.target.checked}) }}
                                                                    />
                                                                    <div className="switcher-indicator">
                                                                        <div className="switcher-yes">YES</div>
                                                                        <div className="switcher-no">NO</div>
                                                                    </div>
                                                                    Arata proprietatile mostenite
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="row">
                                                    <div className="col-md-12">
                                                        <PropertiesList
                                                            workspaceId={this.props.workspaceId}
                                                            conceptId={concept.id}
                                                            showInheritedProps={this.state.showInheritedProps}
                                                            showWorkspaceSelector={false}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    });

    return ConceptForm;
});
