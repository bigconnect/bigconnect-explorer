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
    'prop-types',
    'create-react-class',
    'react-redux',
    'data/web-worker/store/ingest/actions',
    './db/DataConnectionManager',
    './file/FileImportWizard'
], function (React, PropTypes, createReactClass, redux, ingestActions, DataConnectionManager, FileImportWizard) {
    'use strict';

    const IngestContainer = createReactClass({
        propTypes: {
            loadType: PropTypes.string.isRequired
        },

        render() {
            const { loadType, ...rest } = this.props;

            if (loadType === 'db') {
                return (
                    <DataConnectionManager {...rest}/>
                )
            } else if (loadType === 'file') {
                return (
                    <FileImportWizard {...rest}/>
                )
            } else return (
                    <div className="ingest-container">
                        <div className="container-fluid">
                            <div className="row">
                                <div className="ingest-title">
                                    <h3>Load data</h3>
                                </div>
                            </div>

                            <div className="cards">
                                <div className="card">
                                    <h3>Files</h3>
                                    <ul>
                                        <li><a onClick={() => this.props.onSetLoadType('file')}>Upload your files</a></li>
                                    </ul>
                                </div>

                                <div className="card">
                                    <h3>SQL</h3>

                                    <div style={{overflow: 'hidden'}}>
                                        <div className="pull-left" style={{width: '50%'}}>
                                            <ul>
                                                <li><a onClick={() => this.props.onSetLoadType('db')}>MySQL</a></li>
                                                <li><a onClick={() => this.props.onSetLoadType('db')}>PostgreSQL</a></li>
                                                <li><a onClick={() => this.props.onSetLoadType('db')}>Oracle</a></li>
                                                <li><a onClick={() => this.props.onSetLoadType('db')}>MS SQL Server</a></li>
                                            </ul>
                                        </div>

                                        <div className="pull-left" style={{width: '50%'}}>
                                            <ul>
                                                <li><a onClick={() => this.props.onSetLoadType('db')}>Amazon Redshift</a></li>
                                                <li><a onClick={() => this.props.onSetLoadType('db')}>Teradata</a></li>
                                                <li><a onClick={() => this.props.onSetLoadType('db')}>Google BigQuery</a></li>
                                                <li><a onClick={() => this.props.onSetLoadType('db')}>Other...</a></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="card">
                                    <h3>Cloud Storage</h3>

                                    <div style={{overflow: 'hidden'}}>
                                        <div className="pull-left" style={{width: '50%'}}>
                                            <ul>
                                                <li><a className="disabled">BDL Object Storage</a></li>
                                                <li><a className="disabled">Amazon S3</a></li>
                                                <li><a className="disabled">Azure Blob Storage</a></li>
                                                <li><a className="disabled">Google Cloud Storge</a></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
        }
    });

    return redux.connect(
        (state, props) => {
            return {
                loadType: state.ingest.loadType
            }
        },

        (dispatch, props) => {
            return {
                onSetLoadType: (loadType) => { dispatch(ingestActions.setLoadType(loadType)) }
            }
        }
    )(IngestContainer)
});
