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
    'react-virtualized-select', '../../../../components/field/ColorSelector',
    '../properties/PropertiesList', 'swal', '../../../../components/Modal',
], function(React, createReactClass, PropTypes, deepEquals, bcApi, { default: VirtualizedSelect },
            ColorSelector, PropertiesList, swal, Modal) {

    const RelationshipForm = createReactClass({
        propTypes: {
            relationship: PropTypes.object.isRequired,
            addmode: PropTypes.bool.isRequired,
            ontology: PropTypes.object.isRequired
        },

        getInitialState() {
            const visibleRels = _.filter(this.props.ontology.relationships, r => {
                return !r.coreConcept && r.id != ONTOLOGY_CONSTANTS.EDGE_THING &&
                    (!this.props.addmode && r.id !== this.props.relationship.title)
            });

            return this.props.addmode ? {
                extra_errors: [],
                showInheritedProps: false,
                relationship: {
                    parentIri: ONTOLOGY_CONSTANTS.EDGE_THING,
                    deleteable: true,
                    updateable: true,
                    userVisible: true,
                },
                visibleRels
            } : {
                extra_errors: [],
                showInheritedProps: false,
                relationship: this.props.relationship,
                visibleRels
            }
        },

        componentWillMount() {
            this.promise = new $.Deferred();
        },

        save() {
            if(this.valid()) {
                this.promise.resolve({
                    relationship: this.normalizeKeys(this.state.relationship),
                    operation: 'save'
                });
            }
        },

        delete() {
            swal({
                title: 'Sunteti sigur?',
                text: "Aceasta actiune este ireversibila",
                type: 'warning',
                showCancelButton: true
            }).then((result) => {
                if (result.value) {
                    this.promise.resolve({
                        relationship: this.normalizeKeys(this.state.relationship),
                        operation: 'delete'
                    });
                }
            });
        },

        valid() {
            const relationship = this.state.relationship;
            let errors = [];

            if(!relationship.title) {
                errors.push('Codul este obligatoriu');
            }

            if(!relationship.displayName) {
                errors.push('Numele este obligatoriu');
            }

            if(!relationship.domainConceptIris) {
                errors.push('Sursa este obligatoriu');
            }

            if(!relationship.rangeConceptIris) {
                errors.push('Destinatie este obligatoriu');
            }

            if(errors.length > 0) {
                this.setState({extra_errors: errors});
            } else
                return true;
        },

        normalizeKeys(c) {
            const isKeyDefined = (c, p) => c.hasOwnProperty(p) && c[p] != null && c[p] != undefined;

            if(!isKeyDefined(c, 'userVisible')) c.userVisible = false;
            if(!isKeyDefined(c, 'deleteable')) c.deleteable = false;
            if(!isKeyDefined(c, 'updateable')) c.updateable = false;
            if(!isKeyDefined(c, 'color')) c.color = '';
            if(!isKeyDefined(c, 'titleFormula')) c.titleFormula = '';
            if(!isKeyDefined(c, 'subtitleFormula')) c.subtitleFormula = '';
            if(!isKeyDefined(c, 'timeFormula')) c.timeFormula = '';

            return c;
        },

        setRelState(key, value) {
            const relationship = this.state.relationship;
            relationship[key] = value;
            this.setState({ relationship });
        },

        render() {
            const rel = this.state.relationship;
            const isNewRel = this.props.addmode === true;
            const selectableConcepts = _.chain(this.props.ontology.concepts)
                .filter(c => (!c.coreConcept || c.id === ONTOLOGY_CONSTANTS.THING_CONCEPT))
                .map(c => {
                    return {
                        label: c.title,
                        value: c.id
                    }
                })
                .value();

            const selectableInverseRels = _.map(this.state.visibleRels, r => {
                return {
                    label: r.title,
                    value: r.title
                }
            });

            return (
                <Modal width={'800px'}>
                    <div className='modal-header'>
                        <h4 className='modal-title'>Editare Relatie</h4>
                    </div>

                    <div className='modal-body'>

                        <ul className="nav nav-tabs nav-justified" role="tablist">
                            <li role="presentation" className="active">
                                <a href="#general" aria-controls="general" role="tab" data-toggle="tab">General</a>
                            </li>
                            <li role="presentation" style={{visibility: isNewRel ? 'hidden' : 'visible'}}>
                                <a href="#props" aria-controls="props" role="tab" data-toggle="tab">Proprietati</a>
                            </li>
                        </ul>

                        <div className="tab-content">
                            <div role="tabpanel" className="tab-pane active" id="general">
                                {this.state.extra_errors.length > 0 && (
                                    <div className="alert alert-danger">
                                        <ul>
                                            {this.state.extra_errors.map((err, index) => (
                                                <li key={`err${index}`}>{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="form-horizontal">
                                    {/* General options */}
                                    <div className="panel">
                                        <div className="panel-heading">
                                            <h4 className="panel-title">
                                                <a href="#">General</a>
                                            </h4>
                                        </div>

                                        <div className="panel-body">
                                            <div className="form-group">
                                                <label htmlFor="title" className="col-md-3 control-label">Cod</label>
                                                <div className="col-md-9">
                                                    <input id="title" type="text" className="form-control" placeholder="Cod intern"
                                                           required
                                                           disabled={rel.coreConcept || !isNewRel}
                                                           value={rel.title}
                                                           onChange={(e) => { this.setRelState('title', e.target.value) }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="displayName" className="col-md-3 control-label">Nume</label>
                                                <div className="col-md-9">
                                                    <input id="displayName" type="text" className="form-control" placeholder="Numele sub care este afisata"
                                                           required
                                                           disabled={rel.coreConcept}
                                                           value={rel.displayName}
                                                           onChange={(e) => { this.setRelState('displayName', e.target.value) }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label className="col-md-3 control-label" htmlFor="sourceConcepts">Concepte sursa:</label>
                                                <div className="col-md-9">
                                                    <VirtualizedSelect
                                                        id="sourceConcepts"
                                                        name="form-field-prvileges"
                                                        options={selectableConcepts}
                                                        multi={true}
                                                        value={rel.domainConceptIris}
                                                        onChange={(val) => { this.setRelState('domainConceptIris', !val ? [] : val.split(',')) }}
                                                        simpleValue
                                                        clearable
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label className="col-md-3 control-label" htmlFor="targetConcepts">Concepte destinatie:</label>
                                                <div className="col-md-9">
                                                    <VirtualizedSelect
                                                        id="targetConcepts"
                                                        name="form-field-prvileges"
                                                        options={selectableConcepts}
                                                        multi={true}
                                                        value={rel.rangeConceptIris}
                                                        onChange={(val) => { this.setRelState('rangeConceptIris', !val ? [] : val.split(',')) }}
                                                        simpleValue
                                                        clearable
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label className="col-md-3 control-label" htmlFor="inverseOf">Inversa relatiei:</label>
                                                <div className="col-md-9">
                                                    <VirtualizedSelect
                                                        id="inverseOf"
                                                        name="form-field-prvileges"
                                                        options={selectableInverseRels}
                                                        multi={true}
                                                        value={rel.inverseOfs ? _.map(rel.inverseOfs, r => r.iri) : []}
                                                        onChange={(val) => { this.setRelState('inverseOf', {primaryIri : rel.id, iri: val}) }}
                                                        simpleValue
                                                        clearable
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <div className="col-md-offset-3 col-md-9">
                                                    <div className="togglebutton">
                                                        <label className="custom-control custom-checkbox">
                                                            <input type="checkbox" className="custom-control-input"
                                                                   disabled={rel.coreConcept}
                                                                   checked={rel.userVisible}
                                                                   onChange={(e) => { this.setRelState('userVisible', e.target.checked ) }}
                                                            />
                                                            <span className="custom-control-indicator"></span>
                                                            Vizibila
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <div className="col-md-offset-3 col-md-9">
                                                    <div className="togglebutton">
                                                        <label className="custom-control custom-checkbox">
                                                            <input type="checkbox" className="custom-control-input"
                                                                   disabled={rel.coreConcept}
                                                                   checked={rel.deleteable}
                                                                   onChange={(e) => { this.setRelState('deleteable', e.target.checked ) }}
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
                                                                   disabled={rel.coreConcept}
                                                                   checked={rel.updateable}
                                                                   onChange={(e) => { this.setRelState('updateable', e.target.checked ) }}
                                                            />
                                                            <span className="custom-control-indicator"></span>
                                                            Se poate edita
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="form-group" style={{display: 'none'}}>
                                                <label htmlFor="intents" className="col-md-3 control-label">Intents</label>
                                                <div className="col-md-9">
                                                    <input id="intents" type="text" className="form-control" placeholder="Comma separated values"
                                                           value={rel.intents ? rel.intents.join(',') : ''}
                                                           disabled={rel.coreConcept}
                                                           onChange={(e) => {
                                                               const v = e.target.value.length == 0 ? [] : e.target.value.split(',');
                                                               this.setRelState('intents', v )}
                                                           }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Display options */}
                                    <div className="panel panel-default">
                                        <div className="panel-heading">
                                            <h4 className="panel-title expand">
                                                <a href="#">Afisare</a>
                                            </h4>
                                        </div>

                                        <div className="panel-body">
                                            <div className="form-group">
                                                <label htmlFor="color" className="col-md-3 control-label">Culoare</label>
                                                <div className="col-md-9">
                                                    <ColorSelector value={rel.color} onSelected={(c) => this.setRelState('color', c)} />
                                                </div>
                                            </div>


                                            <div className="form-group">
                                                <label htmlFor="titleFormula" className="col-md-3 control-label">Formula titlu</label>
                                                <div className="col-md-9">
                                                                <textarea id="titleFormula" rows="5" className="form-control" placeholder="Snippet JavaScript cu instructiune de return"
                                                                          value={rel.titleFormula}
                                                                          onChange={(e) => { this.setRelState('titleFormula', e.target.value) }}
                                                                />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="subtitleFormula" className="col-md-3 control-label">Formula subtitlu</label>
                                                <div className="col-md-9">
                                                                <textarea id="subtitleFormula" rows="5" className="form-control" placeholder="Snippet JavaScript cu instructiune de return"
                                                                          value={rel.subtitleFormula}
                                                                          onChange={(e) => { this.setRelState('subtitleFormula', e.target.value) }}
                                                                />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="timeFormula" className="col-md-3 control-label">Formula timp</label>
                                                <div className="col-md-9">
                                                                <textarea id="timeFormula" rows="5" className="form-control" placeholder="Snippet JavaScript cu instructiune de return"
                                                                          value={rel.timeFormula}
                                                                          onChange={(e) => { this.setRelState('timeFormula', e.target.value) }}
                                                                />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className='form-footer'>
                                    <div className='text-center'>
                                        <button
                                            role='abort'
                                            type='button'
                                            className='btn btn-raised btn-danger'
                                            onClick={this.promise.reject}
                                        >Anuleaza</button>
                                        {' '}
                                        <button
                                            style={{display: (rel.coreConcept || isNewRel) ? 'none' : 'inline-block'}}
                                            role='abort'
                                            type='button'
                                            className='btn btn-danger'
                                            onClick={this.delete}
                                        >Delete</button>
                                        {' '}
                                        <button
                                            role='confirm'
                                            type='button'
                                            className='btn btn-primary'
                                            onClick={this.save}
                                        >Save</button>
                                    </div>
                                </div>
                            </div>

                            <div role="tabpanel" className="tab-pane" id="props">
                                {/* Properties */}
                                { !isNewRel && (
                                    <div>
                                        <div className="row">
                                            <div className="col-md-4 col-centered">
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
                                                    relId={rel.title}
                                                    showInheritedProps={this.state.showInheritedProps}
                                                    showWorkspaceSelector={false}/>
                                            </div>
                                        </div>

                                        <div className="row">
                                            <div className="col-md-12">
                                                <div className='form-footer p-t-3'>
                                                    <div className='text-center'>
                                                        <button
                                                            role='abort'
                                                            type='button'
                                                            className='btn btn-raised btn-danger'
                                                            onClick={this.promise.reject}
                                                        >Anuleaza</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal>
            );
        }
    });

    return RelationshipForm;
});
