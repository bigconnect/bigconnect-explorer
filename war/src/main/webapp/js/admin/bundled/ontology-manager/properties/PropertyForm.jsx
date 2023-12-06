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
    'react', 'react-dom', 'prop-types', 'create-react-class',
    '../../../../components/Modal', 'util/deepEquals', './timezones', 'swal'
], function(React, ReactDOM, PropTypes, createReactClass, Modal, deepEquals, timezones, swal) {
    'use strict';

    const PropertyForm = createReactClass({
        propTypes: {
            property: PropTypes.object,
            addmode: PropTypes.bool.isRequired
        },

        getInitialState() {
            const initialState = this.props.addmode ? {
                extra_errors: [],
                property: {
                    dataType: 'string',
                    addable: true,
                    deleteable: true,
                    searchable: true,
                    sortable: true,
                    updateable: true,
                    userVisible: true,
                    possibleValues: {}
                },
            } : {
                extra_errors: [],
                property: this.props.property
            };

            if(initialState.property.possibleValues)
                initialState.property.possibleValues = JSON.stringify(initialState.property.possibleValues);

            return initialState;
        },

        componentWillMount() {
            this.promise = new $.Deferred();
        },

        save() {
            if(this.valid()) {
                this.promise.resolve({
                    property: this.normalizeKeys(this.state.property),
                    operation: 'save'
                });
            }
        },

        delete() {
            swal({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                type: 'warning',
                showCancelButton: true
            }).then((result) => {
                if (result.value) {
                    this.promise.resolve({
                        property: this.normalizeKeys(this.state.property),
                        operation: 'delete'
                    });
                }
            });
        },

        valid() {
            const property = this.state.property;
            let errors = [];

            if(!property.title) {
                errors.push('Title is required');
            }

            if(!property.displayName) {
                errors.push('Display Name is required');
            }

            if(!property.dataType) {
                errors.push('Data Type is required');
            }

            if(property.possibleValues) {
                try {
                    JSON.parse(property.possibleValues)
                } catch (e) {
                    errors.push('Property values is invalid: '+e.message);
                }
            }

            if(errors.length > 0) {
                this.setState({extra_errors: errors});
            } else
                return true;
        },

        normalizeKeys(c) {
            const isKeyDefined = (c, p) => c.hasOwnProperty(p) && c[p] != null && c[p] != undefined;

            if(!isKeyDefined(c, 'userVisible')) c.userVisible = false;
            if(!isKeyDefined(c, 'searchable')) c.searchable = false;
            if(!isKeyDefined(c, 'searchFacet')) c.searchFacet = false;
            if(!isKeyDefined(c, 'textIndexHints')) c.textIndexHints = [];
            if(!isKeyDefined(c, 'deleteable')) c.deleteable = false;
            if(!isKeyDefined(c, 'addable')) c.addable = false;
            if(!isKeyDefined(c, 'updateable')) c.updateable = false;
            if(!isKeyDefined(c, 'intents')) c.intents = [];
            if(!isKeyDefined(c, 'aggType')) c.aggType = '';
            if(!isKeyDefined(c, 'aggInterval')) c.aggInterval = '';
            if(!isKeyDefined(c, 'aggMinDocumentCount')) c.aggMinDocumentCount = 1;
            if(!isKeyDefined(c, 'aggCalendarField')) c.aggCalendarField = '';
            if(!isKeyDefined(c, 'aggTimeZone')) c.aggTimeZone = '';
            if(!isKeyDefined(c, 'aggPrecision')) c.aggPrecision = 1;
            if(!isKeyDefined(c, 'displayType')) c.displayType = '';
            if(!isKeyDefined(c, 'propertyGroup')) c.propertyGroup = '';
            if(!isKeyDefined(c, 'possibleValues')) c.possibleValues = {};
            else c.possibleValues = JSON.parse(c.possibleValues);
            if(!isKeyDefined(c, 'displayFormula')) c.displayFormula = '';
            if(!isKeyDefined(c, 'validationFormula')) c.validationFormula = '';
            return c;
        },

        setPropertyState(key, value) {
            const property = this.state.property;
            property[key] = value;
            this.setState({ property });
        },

        render() {
            const property = this.state.property;

            let textIndexHints = "NONE";

            if(property.textIndexHints) {
                if (property.textIndexHints.includes("ALL") || (property.textIndexHints.includes("EXACT_MATCH") && property.textIndexHints.includes("FULL_TEXT")))
                    textIndexHints = "ALL";
                else if (property.textIndexHints.includes("EXACT_MATCH"))
                    textIndexHints = "EXACT_MATCH";
                else if (property.textIndexHints.includes("FULL_TEXT"))
                    textIndexHints = "FULL_TEXT";
            }

            return (
                <Modal>
                    <div className='modal-header'>
                        <h4 className='modal-title'>Editare Proprietate</h4>
                    </div>
                    <div className='modal-body'>
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
                            <div className="panel-group" id="accordion">
                                {/* General options */}
                                <div className="panel">
                                    <div className="panel-heading">
                                        <h4 data-toggle="collapse" data-parent="#accordion" href="#collapse1" className="accordion-toggle panel-title">
                                            <a href="#">General</a>
                                        </h4>
                                    </div>
                                    <div id="collapse1" className="panel-collapse collapse in">
                                        <div className="panel-body">
                                            <div className="form-group">
                                                <label htmlFor="title" className="col-md-3 control-label">Cod</label>
                                                <div className="col-md-9">
                                                    <input id="title" type="text" className="form-control" placeholder="Cod intern"
                                                           required
                                                           disabled={property.systemProperty}
                                                           value={property.title}
                                                           onChange={(e) => { this.setPropertyState('title', e.target.value) }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="displayName" className="col-md-3 control-label">Nume</label>
                                                <div className="col-md-9">
                                                    <input id="displayName" type="text" className="form-control" placeholder="Numele sub care este afisat"
                                                           required
                                                           value={property.displayName}
                                                           onChange={(e) => { this.setPropertyState('displayName', e.target.value) }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="dataType" className="col-md-3 control-label">Tip</label>
                                                <div className="col-md-9">
                                                    <select id="dataType" className="custom-select form-control" required
                                                            value={property.dataType}
                                                            disabled={property.systemProperty}
                                                            onChange={(e) => { this.setPropertyState('dataType', e.target.value)} }
                                                    >
                                                        <option value="string">String</option>
                                                        <option value="integer">Integer</option>
                                                        <option value="double">Double</option>
                                                        <option value="currency">Currency</option>
                                                        <option value="date">Date</option>
                                                        <option value="boolean">Boolean</option>
                                                        <option value="geoLocation">GeoLocation (lat,lon)</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <div className="col-md-offset-3 col-md-9">
                                                    <div className="togglebutton">
                                                        <label className="custom-control custom-checkbox">
                                                            <input type="checkbox" className="custom-control-input"
                                                                   checked={property.userVisible}
                                                                   onChange={(e) => { this.setPropertyState('userVisible', e.target.checked ) }}
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
                                                                   disabled={property.systemProperty}
                                                                   checked={property.searchable}
                                                                   onChange={(e) => { this.setPropertyState('searchable', e.target.checked ) }}
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
                                                                   checked={property.searchFacet}
                                                                   onChange={(e) => { this.setPropertyState('searchFacet', e.target.checked ) }}
                                                            />
                                                            <span className="custom-control-indicator"></span>
                                                            Fateta de cautare
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="textIndexHints" className="col-md-3 control-label">Tip Index</label>
                                                <div className="col-md-9">
                                                    <select id="textIndexHints" className="form-control"
                                                            value={textIndexHints}
                                                            disabled={property.systemProperty}
                                                            onChange={(e) => {
                                                                const hints = e.target.value.length == 0 ? [] : e.target.value.split(',');
                                                                this.setPropertyState('textIndexHints', hints )}
                                                            }
                                                    >
                                                        <option value="NONE">Fara</option>
                                                        <option value="FULL_TEXT">Full-Text</option>
                                                        <option value="EXACT_MATCH">Exact Match</option>
                                                        <option value="ALL">Ambele</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <div className="col-md-offset-3 col-md-9">
                                                    <div className="togglebutton">
                                                        <label className="custom-control custom-checkbox">
                                                            <input type="checkbox" className="custom-control-input"
                                                                   disabled={property.systemProperty}
                                                                   checked={property.deleteable}
                                                                   onChange={(e) => { this.setPropertyState('deleteable', e.target.checked ) }}
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
                                                                   disabled={property.systemProperty}
                                                                   checked={property.addable}
                                                                   onChange={(e) => { this.setPropertyState('addable', e.target.checked ) }}
                                                            />
                                                            <span className="custom-control-indicator"></span>
                                                            Se poate adauga
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <div className="col-md-offset-3 col-md-9">
                                                    <div className="togglebutton">
                                                        <label className="custom-control custom-checkbox">
                                                            <input type="checkbox" className="custom-control-input"
                                                                   disabled={property.systemProperty}
                                                                   checked={property.updateable}
                                                                   onChange={(e) => { this.setPropertyState('updateable', e.target.checked ) }}
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
                                                           value={property.intents ? property.intents.join(',') : ''}
                                                           disabled={property.systemProperty}
                                                           onChange={(e) => {
                                                               const v = e.target.value.length == 0 ? [] : e.target.value.split(',');
                                                               this.setPropertyState('intents', v )}
                                                           }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Aggregation options */}
                                <div className="panel">
                                    <div className="panel-heading">
                                        <h4 data-toggle="collapse" data-parent="#accordion" href="#collapse2" className="accordion-toggle collapsed panel-title">
                                            <a href="#">Agregare</a>
                                        </h4>
                                    </div>
                                    <div id="collapse2" className="panel-collapse collapse">
                                        <div className="panel-body">
                                            <div className="form-group">
                                                <label htmlFor="aggType" className="col-md-3 control-label">Tip Agregare</label>
                                                <div className="col-md-9">
                                                    <select id="aggType" className="custom-select form-control"
                                                            value={property.aggType}
                                                            onChange={(e) => { this.setPropertyState('aggType', e.target.value)} }
                                                    >
                                                        <option value="">None</option>
                                                        <option value="term">Termeni</option>
                                                        <option value="histogram">Histograma</option>
                                                        <option value="calendar">Calendar</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="aggInterval" className="col-md-3 control-label">Interval</label>
                                                <div className="col-md-9">
                                                    <input id="aggInterval" type="text" className="form-control"
                                                           value={property.aggInterval}
                                                           onChange={(e) => { this.setPropertyState('aggInterval', e.target.value) }}
                                                    />
                                                    <p className="help-block">
                                                        Pentru tip data: year, quarter, month, week, day, hour, minute, second
                                                        Pentru tip numeric: a positive decimal
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="aggMinDocumentCount" className="col-md-3 control-label">Numar min. documente</label>
                                                <div className="col-md-9">
                                                    <input id="aggMinDocumentCount" type="number" className="form-control"
                                                           value={property.aggMinDocumentCount}
                                                           onChange={(e) => { this.setPropertyState('aggMinDocumentCount', e.target.value) }}
                                                    />
                                                </div>
                                            </div>


                                            <div className="form-group">
                                                <label htmlFor="aggCalendarField" className="col-md-3 control-label">Tip Calendar</label>
                                                <div className="col-md-9">
                                                    <select id="aggCalendarField" className="custom-select form-control"
                                                            value={property.aggCalendarField}
                                                            onChange={(e) => { this.setPropertyState('aggCalendarField', e.target.value)} }
                                                    >
                                                        <option value="">None</option>
                                                        <option value="DAY_OF_MONTH">Zi a lunii</option>
                                                        <option value="DAY_OF_WEEK">Zi a saptamanii</option>
                                                        <option value="HOUR_OF_DAY">Ora a zilei</option>
                                                        <option value="MONTH_OF_YEAR">Luna</option>
                                                        <option value="YEAR">An</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="aggTimeZone" className="col-md-3 control-label">Timezone</label>
                                                <div className="col-md-9">
                                                    <select id="aggTimeZone" className="custom-select form-control"
                                                            value={property.aggTimeZone}
                                                            onChange={(e) => { this.setPropertyState('aggTimeZone', e.target.value)} }
                                                    >
                                                        <option value="">None</option>
                                                        {
                                                            timezones.map((t,index) => (
                                                                <option key={`tz-${index}`} value={t}>{t}</option>
                                                            ))
                                                        }
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Display options */}
                                <div className="panel">
                                    <div className="panel-heading">
                                        <h4 data-toggle="collapse" data-parent="#accordion" href="#collapse3" className="accordion-toggle collapsed panel-title">
                                            <a href="#">Afisare</a>
                                        </h4>
                                    </div>
                                    <div id="collapse3" className="panel-collapse collapse">
                                        <div className="panel-body">
                                            <div className="form-group">
                                                <label htmlFor="displayType" className="col-md-3 control-label">Tip</label>
                                                <div className="col-md-9">
                                                    <select id="displayType" className="custom-select form-control"
                                                            value={property.displayType}
                                                            onChange={(e) => { this.setPropertyState('displayType', e.target.value)} }
                                                    >
                                                        <option value="">Ascunsa</option>
                                                        <option value="longText">Text lung</option>
                                                        <option value="link">Web Link</option>
                                                        <option value="duration">Durata</option>
                                                        <option value="bytes">Dimensiune (Bytes)</option>
                                                        <option value="dateOnly">Data (fara timp)</option>
                                                        <option value="heading">Heading</option>
                                                        <option value="geoLocation">Geo-Locatie</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="propertyGroup" className="col-md-3 control-label">Grup</label>
                                                <div className="col-md-9">
                                                    <input id="propertyGroup" type="text" className="form-control" placeholder="Grup"
                                                           value={property.propertyGroup}
                                                           onChange={(e) => { this.setPropertyState('propertyGroup', e.target.value) }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="possibleValues" className="col-md-3 control-label">Valori posibile</label>
                                                <div className="col-md-9">
                                                    <textarea id="possibleValues" rows="5" className="form-control"
                                                              placeholder='{ "key1": "value1", "key2": "value2" }'
                                                              value={property.possibleValues}
                                                              onChange={(e) => { this.setPropertyState('possibleValues', e.target.value) }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="displayFormula" className="col-md-3 control-label">Formula afisare</label>
                                                <div className="col-md-9">
                                                    <textarea id="displayFormula" rows="5" className="form-control" placeholder="Snippet JavaScript cu instructiune de return"
                                                              value={property.displayFormula}
                                                              onChange={(e) => { this.setPropertyState('displayFormula', e.target.value) }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="validationFormula" className="col-md-3 control-label">Formula validare</label>
                                                <div className="col-md-9">
                                                    <textarea id="validationFormula" rows="5" className="form-control" placeholder="Snippet JavaScript cu instructiune de return"
                                                              value={property.validationFormula}
                                                              onChange={(e) => { this.setPropertyState('validationFormula', e.target.value) }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='modal-footer'>
                        <div className='text-center'>
                            <button
                                role='abort'
                                type='button'
                                className='btn btn-raised btn-danger'
                                onClick={this.promise.reject}
                            >Anuleaza</button>
                            {' '}
                            <button
                                style={{display: (this.props.addmode || property.systemProperty) ? 'none' : 'inline-block'}}
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
                </Modal>
            );
        }
    });

    return PropertyForm;
});
