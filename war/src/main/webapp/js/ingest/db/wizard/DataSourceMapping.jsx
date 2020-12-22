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
    './EntityPropertyMapper',
    './RelationshipMapper',
    '../../../components/Alert',
    'public/v1/api'
], function (React, ReactDOM, PropTypes, createReactClass, ReactTableDef, EntityPropertyMapper, RelationshipMapper, Alert, bcApi) {
    'use strict';

    const ReactTable = ReactTableDef.default;

    const DataSourceMapping = createReactClass({
        propTypes: {
            changeAppMode: PropTypes.func.isRequired,
            getStore: PropTypes.func.isRequired,
            updateStore: PropTypes.func.isRequired
        },

        getInitialState() {
            if(!this.props.getStore().entityMappings) {
                this.props.updateStore({ entityMappings: this.props.getStore().preview.columns.map(c => {
                    return {
                        colName: c.name,
                        colType: c.typeName,
                        colTable: c.table,
                        colConcept: null,
                        colEntityId: null,
                        colProperty: null,
                        colIdentifier: false,
                        colEntityVisibility: null,
                        colPropVisibility: null,
                        colPropTrueValues: null,
                        colPropFalseValues: null,
                        colPropDateFormat: null
                    }
                }) });
            }

            return {
                selectedRow: null
            };
        },

        selectRow(rowInfo) {
            var selectedRow = this.props.getStore().entityMappings[rowInfo.index];
            this.setState({selectedRow: selectedRow});
        },

        saveEntityMapping(rowInfo) {
            if(rowInfo == null) {
                // mapping was cancelled.
                this.setState({selectedRow: null});
                return;
            }

            if(rowInfo.colEntityId === EntityPropertyMapper.NEW_ENTITYID_VALUE) {
                rowInfo.colEntityId = this.generateEntityId(rowInfo.colConcept)
            }

            this.props.updateStore({
                entityMappings: _.map(this.props.getStore().entityMappings, (r) => {
                    return (r.colTable === rowInfo.colTable && r.colName === rowInfo.colName) ? rowInfo : r;
                })
            });

            this.setState({selectedRow: null});
        },

        generateEntityId(conceptType) {
            let existingMappings = _.chain(this.props.getStore().entityMappings)
                .filter((r) => {
                    return r.colEntityId != EntityPropertyMapper.NEW_ENTITYID_VALUE && r.colConcept && r.colConcept.id === conceptType.id;
                })
                .map((r) => {return r.colEntityId.substr(r.colEntityId.lastIndexOf('#')+1)})
                .value();

            if(existingMappings.length == 0) {
                return conceptType.displayName+'#1';
            } else {
                existingMappings = existingMappings.sort((a, b) => parseInt(b) - parseInt(a));
                let lastIndexStr = existingMappings.shift();
                let newIndex = parseInt(lastIndexStr) + 1;
                return conceptType.displayName+'#'+newIndex;
            }
        },

        isValidated() {
            // check to see if we have at least one mapping
            var entMappings = this.props.getStore().entityMappings
                .filter(e => e.colEntityId && e.colConcept && e.colProperty);

            if(entMappings.length == 0) {
                this.setError('At least one mapping must exist');
                return false;
            }

            return true;
        },

        setError(msg) {
            this.setState({ error: { statusText: msg} });
        },

        handleAlertDismiss() {
            this.setState({
                error: null
            });
        },

        render() {
            const columns = [{
                Header: 'Map data',
                columns: [{
                    Header: 'Data column',
                    accessor: 'colName'
                }, {
                    Header: 'Table',
                    accessor: 'colTable'
                }, {
                    Header: 'Data type',
                    accessor: 'colType'
                }, {
                    Header: 'Entity Id',
                    accessor: 'colEntityId'
                },{
                    Header: 'Concept',
                    accessor: 'colConcept.displayName'
                }, {
                    Header: 'Property',
                    accessor: 'colProperty',
                    Cell: row => {
                        let displayValue = row.original.colIdentifier ? '*' + row.value : row.value;
                        return (<div>{displayValue}</div>);
                    }
                }]
            }];

            return (
                <div className='step-progress'>
                    <div className="container-fluid" style={{paddingTop: '30px'}}>
                        <div className="row">
                            <div className="col-md-6">
                                <div className='table-wrap'>
                                    <ReactTable
                                        className='-striped -highlight'
                                        data={this.props.getStore().entityMappings}
                                        columns={columns}
                                        defaultPageSize={this.props.getStore().entityMappings.length}
                                        showPageSizeOptions={false}
                                        showPagination={false}
                                        getTrProps={(state, rowInfo, column, instance) => {
                                            let trProps = {
                                                onClick: e => { this.selectRow(rowInfo) }
                                            };
                                            if (rowInfo.original == this.state.selectedRow) {
                                                trProps.style = {'backgroundColor': '#08c', color: 'white'}
                                            }
                                            return trProps;
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="col-md-6">
                                <div className="container-fluid">
                                    <div className="row">
                                        <div className="col-md-12">
                                            <h4>Data Mapping</h4>
                                            <blockquote>
                                                <p>Select columns from the left and map them to entity properties.</p>
                                                <p>If you have at least two different entities, you can also define relationships between them.</p>
                                            </blockquote>

                                        </div>
                                    </div>

                                    <div className="row" style={{ display: (this.state.selectedRow) ? 'block' : 'none' }}>
                                        <div className="container-fluid">
                                            <EntityPropertyMapper
                                                saveMapping={this.saveEntityMapping}
                                                selectedRow={this.state.selectedRow}
                                                {...this.props}
                                            />
                                        </div>
                                    </div>

                                    <div className="row" style={{ display: (this.state.selectedRow) ? 'none' : 'block' }}>
                                        <div className="container-fluid">
                                            <RelationshipMapper
                                                rowData={this.props.getStore().entityMappings}
                                                {...this.props}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    });

    return DataSourceMapping;
});
