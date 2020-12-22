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
    'public/v1/api'
], function(React, ReactDOM, PropTypes, createReactClass, ReactTableDef, bcApi) {
    'use strict';

    const ReactTable = ReactTableDef.default;

    const DataSourcePreview = createReactClass({
        propTypes: {
            changeAppMode: PropTypes.func.isRequired,
            getStore: PropTypes.func.isRequired,
            updateStore: PropTypes.func.isRequired
        },

        getInitialState() {
            const rowData = this.props.getStore().preview.rows.map(row => {
                return row.columns;
            });

            return {
                data: rowData,
                pages: null
            };
        },

        render() {
            const dataCols = this.props.getStore().preview.columns.map((c, idx) => {
                return {
                    Header: c.name,
                    id: c.name,
                    accessor: d => {
                        return d[idx];
                    }
                }
            });

            const columns = [{
                columns: dataCols
            }];

            return (
                <div className='step-progress'>
                    <div className="container-fluid">
                        <div className="row text-center">
                            <h3>Preview Data</h3>
                        </div>
                        <div className="row">
                            <div className='table-wrap'>
                                <ReactTable
                                    className='-striped -highlight'
                                    data={this.state.data} // Set the rows to be displayed
                                    columns={columns}
                                    defaultPageSize={this.state.data.length}
                                    showPageSizeOptions={false}
                                    showPagination={false}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    });

    return DataSourcePreview;
});
