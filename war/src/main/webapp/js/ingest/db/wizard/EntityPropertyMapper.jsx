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
    'react-virtualized-select',
    '../../../components/Alert',
    '../../../components/ontology/ConceptSelector',
    '../../../components/ontology/PropertySelector',
    'public/v1/api'
], function (React, ReactDOM, PropTypes, createReactClass, {default: VirtualizedSelect}, Alert, ConceptSelector, PropertySelector, bcApi) {

    const EntityPropertyMapper = createReactClass({
        propTypes: {
            getStore: PropTypes.func.isRequired,
            saveMapping: PropTypes.func.isRequired,
            selectedRow: PropTypes.object
        },

        statics: {
            NEW_ENTITYID_VALUE: '#'
        },

        getInitialState() {
            return {
                allRoles: [],
                entityIds: this.getEntityIdSelectorData(),
                rowData: null,
                conceptSelectorDisabled: false,
                error: null
            }
        },

        componentDidMount() {
            this.props.dataRequest('role', 'all')
                .done(roles => {
                    let allRoles = roles.map(r => {
                        return {
                            label: r.roleName,
                            value: r.id
                        }
                    });

                    allRoles.push({
                        label: 'Public',
                        value: ''
                    });

                    this.setState({allRoles: allRoles});
                });
        },

        componentWillReceiveProps(nextProps) {
            if (nextProps.selectedRow) {
                if (nextProps.selectedRow.colEntityId) {
                    this.setState({
                        rowData: {...nextProps.selectedRow},
                        conceptSelectorDisabled: true,
                        entityIds: this.getEntityIdSelectorData(),
                        error: null,
                    });
                } else {
                    // row is not mapped
                    this.setState({
                        rowData: {
                            ...nextProps.selectedRow,
                            colEntityId: EntityPropertyMapper.NEW_ENTITYID_VALUE
                        },
                        conceptSelectorDisabled: false,
                        entityIds: this.getEntityIdSelectorData(),
                        error: null
                    });
                }
            }
        },

        getEntityIdSelectorData() {
            let entityIds = _.chain(this.props.getStore().entityMappings)
                .filter((row) => {
                    return row.colEntityId && row.colConcept && row.colProperty
                })
                .map((row) => {
                    return {label: row.colEntityId, value: row.colEntityId}
                })
                .uniq(false, (row) => {
                    return row.value
                })
                .value();

            entityIds.push({label: 'New Entity', value: EntityPropertyMapper.NEW_ENTITYID_VALUE});
            return entityIds;
        },

        onSave(e) {
            e.preventDefault();
            if (!this.validateForm()) {
                return;
            }
            this.props.saveMapping(this.state.rowData);
        },

        validateForm() {
            if (this.state.rowData.colEntityId != EntityPropertyMapper.NEW_ENTITYID_VALUE) {
                if (!this.state.rowData.colProperty) {
                    this.setState({error: {statusText: 'Please select a valid property.'}});
                    return false;
                }

                let alreadyMappedRows = this.getMappedRows(this.state.rowData.colEntityId);

                // check for duplicate property mapping
                if (_.pluck(alreadyMappedRows, 'colProperty').indexOf(this.state.rowData.colProperty) > -1) {
                    this.setState({error: {statusText: 'This property is already mapped.'}});
                    return false;
                }
            } else {
                if (!this.state.rowData.colConcept || !this.state.rowData.colProperty) {
                    this.setState({error: {statusText: 'Please select a valid concept and property.'}});
                    return false;
                }
            }

            return true;
        },

        removeMapping(e) {
            e.preventDefault();

            this.state.rowData.colConcept = null;
            this.state.rowData.colEntityId = null;
            this.state.rowData.colProperty = null;
            this.state.rowData.colPropertyType = null;
            this.state.rowData.colIdentifier = false;
            this.state.rowData.colEntityVisibility = null;
            this.state.rowData.colPropVisibility = null;

            this.props.saveMapping(this.state.rowData);
        },

        cancelMapping(e) {
            this.props.saveMapping(null);
        },

        changeConcept(conceptType) {
            this.setState({
                rowData: {
                    ...this.state.rowData,
                    colConcept: conceptType,
                    colProperty: null,
                    colPropertyType: null
                }
            });
        },

        changeEntityId(entityId) {
            if (!this.isNewEntity(entityId)) {
                // find out entityTyoe from entityId
                let concept = this.getConceptForEntityId(entityId);

                // set the entity selector to the new entity and disable the selector
                this.setState({
                    rowData: {
                        ...this.state.rowData,
                        colConcept: concept,
                        colProperty: null,
                        colPropertyType: null,
                        colEntityId: entityId
                    },
                    conceptSelectorDisabled: true
                });
            } else {
                // 'New Entity' selected so show the entity selector
                this.setState({
                    rowData: {
                        ...this.state.rowData,
                        colConcept: null,
                        colProperty: null,
                        colPropertyType: null,
                        colEntityId: EntityPropertyMapper.NEW_ENTITYID_VALUE
                    },
                    conceptSelectorDisabled: false,
                    entityIds: this.getEntityIdSelectorData(),
                    error: null
                });
            }
        },

        changeProperty(property) {
            this.setState({
                rowData: {
                    ...this.state.rowData,
                    colProperty: property ? property.title : null,
                    colPropertyType: property ? property.dataType : null
                }
            });
        },

        getConceptForEntityId(entityId) {
            return _.chain(this.props.getStore().entityMappings)
                .filter((row) => {
                    return row.colEntityId === entityId
                })
                .map((row) => {
                    return row.colConcept
                })
                .first()
                .value();
        },

        /**
         * returns table rows (minus current row) that already have a mapping
         * for the specified entityid
         */
        getMappedRows(entityId) {
            return this.props.getStore().entityMappings.filter((row) => {
                return row.colEntityId === entityId
                    && row.colName != this.state.rowData.colName
            });
        },

        isNewEntity(entityId) {
            return entityId === EntityPropertyMapper.NEW_ENTITYID_VALUE;
        },

        handleAlertDismiss() {
            this.setState({
                error: null
            });
        },

        updateStateRowData(values) {
            this.setState({
                rowData: {
                    ...this.state.rowData,
                    ...values
                }
            })
        },

        render() {
            if (!this.state.rowData)
                return (<div/>)

            let selectedProp = this.state.rowData.colPropertyType,
                selectedPropIsBoolean = selectedProp === 'boolean',
                selectedPropIsDate = selectedProp === 'date',
                selectedPropIsGeo = selectedProp === 'geoLocation',
                selectedPropertyIsNumber = selectedProp === 'integer' || selectedProp === 'double' ;

            return (
                <form onSubmit={this.onSave} className="form-horizontal entity-property-mapper">
                    <Alert error={this.state.error} onDismiss={ this.handleAlertDismiss }/>

                    <div className="form-group">
                        <label className="col-sm-3 control-label" htmlFor="inputMapTo">Map to:</label>
                        <div className="col-sm-9">
                            <VirtualizedSelect
                                id="inputMapTo"
                                name="form-field-mapto"
                                options={this.state.entityIds}
                                value={this.state.rowData.colEntityId}
                                onChange={(val) => {
                                    this.changeEntityId(val)
                                }}
                                clearable={false}
                                simpleValue
                            />
                        </div>
                    </div>


                    <div className="form-group">
                        <label className="col-sm-3 control-label" htmlFor="inputEntities">Concept:</label>
                        <div className="col-sm-9 form-inline">
                            <div className="form-group col-sm-6">
                                <ConceptSelector
                                    creatable={true}
                                    value={this.state.rowData.colConcept ? this.state.rowData.colConcept.id : null}
                                    onSelected={this.changeConcept}
                                    placeholder={"Choose concept"}
                                    disabled={this.state.conceptSelectorDisabled}
                                    autofocus={false}
                                />
                            </div>

                            <div className="form-group col-sm-6">
                                <VirtualizedSelect
                                    options={this.state.allRoles}
                                    value={this.state.rowData.colEntityVisibility}
                                    onChange={(val) => {
                                        this.updateStateRowData({ colEntityVisibility: val.value })
                                    }}
                                    clearable={false}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="col-sm-3 control-label" htmlFor="inputProperty">Property:</label>
                        <div className="col-sm-9 form-inline">
                            <div className="form-group col-sm-6">
                                <PropertySelector
                                    value={this.state.rowData.colProperty}
                                    onSelected={this.changeProperty}
                                    placeholder={"Coose property"}
                                    autofocus={false}
                                    filter={{
                                        userVisible: true,
                                        conceptId: this.state.rowData.colConcept == null ? 'noConceptSelected' : this.state.rowData.colConcept.id
                                    }}
                                />
                            </div>
                            <div className="form-group col-sm-6 p-x-4">
                                <VirtualizedSelect
                                    options={this.state.allRoles}
                                    value={this.state.rowData.colPropVisibility}
                                    onChange={(val) => {
                                        this.updateStateRowData({ colPropVisibility: val.value })
                                    }}
                                    clearable={false}
                                />
                            </div>
                        </div>
                    </div>

                    {selectedPropIsBoolean &&
                        <div className="form-group">
                            <label className="col-sm-3 control-label" htmlFor="inputBoolTrue">True Values:</label>
                            <div className="col-sm-9">
                                <input type="text"
                                       className="form-control"
                                       id="inputBoolTrue"
                                       value={this.state.rowData.colPropTrueValues}
                                       placeholder="List of TRUE values (comma separated)"
                                       required={true}
                                       onChange={(e) => {
                                           this.updateStateRowData({ colPropTrueValues: e.target.value })
                                       }}
                                />
                                <span className="help-block">List of comma-separated values that will evaluate to TRUE</span>
                            </div>
                        </div>
                    }

                    {selectedPropIsBoolean &&
                        <div className="form-group">
                            <label className="col-sm-3 control-label" htmlFor="inputBoolTrue">False Values:</label>
                            <div className="col-sm-9">
                                <input type="text"
                                       className="form-control"
                                       id="inputBoolFalse"
                                       value={this.state.rowData.colPropFalseValues}
                                       placeholder="List of FALSE values (comma separated)"
                                       required={true}
                                       onChange={(e) => {
                                           this.updateStateRowData({ colPropFalseValues: e.target.value })
                                       }}
                                />
                                <span className="help-block">List of comma-separated values that will evaluate to FALSE</span>
                            </div>
                        </div>
                    }

                    { selectedPropIsDate &&
                        <div className="form-group">
                            <label className="col-sm-3 control-label" htmlFor="inputDateFormat">Date Format:</label>
                            <div className="col-sm-9">
                                <input type="text"
                                       className="form-control"
                                       id="inputDateFormat"
                                       value={this.state.rowData.colPropDateFormat}
                                       required={true}
                                       placeholder="Date Format"
                                       onChange={(e) => {
                                           this.updateStateRowData({ colPropDateFormat: e.target.value })
                                       }}
                                />
                                <span className="help-block">Provide a format compatible with Java SimpleDateFormat</span>
                            </div>
                        </div>
                    }

                    <div className="form-group">
                        <div className="col-sm-offset-3 col-sm-9">
                            <div className="checkbox">
                                <label>
                                    <input type="checkbox"
                                           id="inputIdentifier"
                                           checked={this.state.rowData.colIdentifier}
                                           onClick={(e) => {
                                               this.updateStateRowData({ colIdentifier: e.target.checked })
                                           }}
                                    />
                                    <span className="checkbox-material">
                                        <span className="check" />
                                    </span>

                                    Identifier
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="col-sm-offset-3 col-sm-9">
                            <div className="btn-group btn-group-sm">
                                <button className="btn btn-primary">Save</button>
                                <button className="btn btn-danger" style={{margin: '0px 10px'}} onClick={(e) => { this.removeMapping(e) }}>Remove</button>
                                <button className="btn btn-default" onClick={(e) => { this.cancelMapping(e) }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </form>
            );
        }
    });


    return EntityPropertyMapper;
});
