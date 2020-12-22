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
    '../../../components/Alert',
    'public/v1/api'
], function (React, ReactDOM, PropTypes, createReactClass, ReactTableDef, Alert, bcApi) {
    'use strict';

    const ReactTable = ReactTableDef.default;

    const DataSourceMappingReview = createReactClass({
        propTypes: {
            changeAppMode: PropTypes.func.isRequired,
            getStore: PropTypes.func.isRequired,
            updateStore: PropTypes.func.isRequired
        },

        getInitialState() {
            return {
                error: null,
                saving: false
            }
        },

        isValidated() {
            this.setState({saving: true});

            return this.props.dataRequest('dataload', 'saveDataSource', this.props.getStore())
                .then((dataSource) => {
                    if(this.props.getStore().importConfig.runNow) {
                        this.props.updateStore({ dsId: dataSource.dsId });
                        return this.props.dataRequest('dataload', 'import', this.props.getStore())
                            .then((preview) => {
                                this.setState({ saving: false });
                                return true;
                            })
                            .catch((e) => {
                                this.setState({error: { statusText: "There was a problem starting the import" }, saving: false});
                                return false;
                            });
                    } else {
                        this.setState({saving: false});
                        return true;
                    }
                })
                .catch((e) => {
                    this.setState({error: { statusText: "There was a problem saving the Data Source" }, saving: false});
                    return false;
                })

            return true;
        },

        handleAlertDismiss() {
            this.setState({
                error: null
            });
        },

        render() {
            const incrementalImport = this.props.getStore().importConfig.incremental;
            const runNow = this.props.getStore().importConfig.runNow;

            const mappingsByEntityId =  _.chain(this.props.getStore().entityMappings)
                .filter(m => m.colEntityId && m.colConcept && m.colProperty)
                .groupBy(m => m.colEntityId)
                .value();

            const entityMappingColumns = [{
                columns: [{
                    Header: 'Data column',
                    accessor: 'colName'
                }, {
                    Header: 'Data type',
                    accessor: 'colType'
                }, {
                    Header: 'Entity Id',
                    accessor: 'colEntityId'
                }, {
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
            const entityMappings = this.props.getStore().entityMappings;

            const relMappingColumns = [{
                columns: [{
                    Header: 'Source Entity',
                    accessor: 'sourceId'
                }, {
                    Header: 'Target Entity',
                    accessor: 'targetId'
                }, {
                    Header: 'Visibility',
                    accessor: 'relVisibility',
                    Cell: row => {
                        let displayValue = row.value === '' ? 'Public' : row.value;
                        return (<div>{displayValue}</div>);
                    }
                }]
            }];
            const relMappings = this.props.getStore().relMappings;

            return (
                <div className='step-progress'>
                    <div className="container-fluid" style={{marginTop: '30px'}}>
                        <div className="row text-center">
                            <h3>Review Final Configuration</h3>
                        </div>
                        <div className="row">
                            <div className="col-md-6">
                                <blockquote>
                                    <p>Data Source Details</p>
                                </blockquote>
                                <table className="table table-striped table-bordered">
                                    <tbody>
                                    <tr>
                                        <td>Name:</td>
                                        <td>{this.props.getStore().name}</td>
                                    </tr>
                                    <tr>
                                        <td>Description:</td>
                                        <td>{this.props.getStore().description}</td>
                                    </tr>
                                    <tr>
                                        <td>Max Records:</td>
                                        <td>{this.props.getStore().maxRecords}</td>
                                    </tr>
                                    <tr>
                                        <td>Select Statement:</td>
                                        <td>{this.props.getStore().sqlSelect}</td>
                                    </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-md-6">
                                <blockquote>
                                    <p>Data Mapping - Entities</p>
                                </blockquote>
                                <ReactTable
                                    className='-striped -highlight'
                                    data={entityMappings}
                                    columns={entityMappingColumns}
                                    defaultPageSize={entityMappings.length}
                                    showPageSizeOptions={false}
                                    showPagination={false}
                                />
                            </div>

                            <div className="col-md-6">
                                <blockquote>
                                    <p>Data Mapping - Relationships</p>
                                </blockquote>
                                <ReactTable
                                    className='-striped -highlight'
                                    data={relMappings || []}
                                    columns={relMappingColumns}
                                    defaultPageSize={relMappings ? relMappings.length : 0}
                                    showPageSizeOptions={false}
                                    showPagination={false}
                                />
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-md-6" style={{marginTop: '20px'}}>
                                <blockquote>
                                    <p>Identifier values</p>
                                </blockquote>
                                <table className="table table-striped table-bordered">
                                    <tbody>
                                    {_.map(_.keys(mappingsByEntityId), k => {
                                      let mappingsWithIdentifier = mappingsByEntityId[k].filter(m => m.colIdentifier),
                                          sortedMappings = _.sortBy(mappingsWithIdentifier, m => m.colProperty),
                                          idKeys = _.map(sortedMappings, m => m.colProperty);

                                      if(idKeys.length > 0) {
                                          idKeys.push(sortedMappings[0].colConcept);

                                          return (
                                              <tr key={k}>
                                                  <td>{k}</td>
                                                  <td>{idKeys.join('|')}</td>
                                              </tr>
                                          )
                                      } else {
                                          return null;
                                      }
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-md-6" style={{marginTop: '20px'}}>
                                <blockquote>
                                    <p>Job Settings</p>
                                </blockquote>
                                <table className="table table-striped table-bordered">
                                    <tbody>

                                    <tr>
                                        <td>Run on finish:</td>
                                        <td>{String(runNow)}</td>
                                    </tr>

                                    <tr>
                                        <td>Incremental import:</td>
                                        <td>{String(incrementalImport)}</td>
                                    </tr>

                                    {incrementalImport && <tr>
                                        <td>Check column:</td>
                                        <td>{this.props.getStore().importConfig.checkColumn}</td>
                                    </tr> }
                                    {incrementalImport && <tr>
                                        <td>Mode:</td>
                                        <td>{this.props.getStore().importConfig.incrementalMode}</td>
                                    </tr> }
                                    {incrementalImport && <tr>
                                        <td>Last value:</td>
                                        <td>{this.props.getStore().importConfig.lastValue}</td>
                                    </tr> }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <Alert error={this.state.error} onDismiss={this.handleAlertDismiss}/>
                    </div>
                </div>
            );
        }
    });

    return DataSourceMappingReview;
});
