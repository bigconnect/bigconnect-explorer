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
    'create-react-class',
    'prop-types',
    './util',
    'util/formatters'
], function(React, createReactClass, PropTypes, util, F) {
    'use strict';

    const VISIBILITY_NAME = ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON;

    const StructuredIngestTextSection = createReactClass({
        getInitialState() {
            return { rows: null, total: null, error: false }
        },
        componentDidMount() {
            this.analyze();
        },
        render() {
            const { rows, error, total } = this.state;

            return (
                <div className="com-bc-structuredFile-text-table">
                  <div className="buttons">
                    <button onClick={this.onClick} className="btn btn-primary btn-sm btn-raised">{i18n('csv.file_import.mapping.button')}</button>
                  </div>
                  <div className="table">
                    { error ? i18n('csv.file_import.errors.analyzing.file') :
                      rows ? (
                          <table>
                            {rows.length && total ? (
                                <thead>
                                    <tr>
                                        <th style={{ fontWeight: 'normal', fontStyle: 'italic'}} 
                                            colSpan={rows[0].columns.length}>
                                            {i18n('csv.file_import.mapping.summary', rows.length, F.number.pretty(total))}
                                        </th>
                                    </tr>
                                </thead>
                            ) : null}
                            <tbody>
                                {rows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className={row.isBlank ? 'isBlank' : ''}>
                                    {row.columns.map((c, colIndex) => (
                                        <td key={colIndex} title={c}>{row.isBlank ? '&nbsp' : c}</td>
                                    ))}
                                    </tr>
                                ))}
                            </tbody>
                          </table>
                      ) :
                      i18n('csv.file_import.mapping.loading')
                    }
                    </div>
                </div>
            )
        },
        onClick() {
            const { vertex, propertyName, propertyKey } = this.props;
            const property = _.findWhere(vertex.properties, { key: propertyKey, name: propertyName });
            const visibilitySource = property.metadata
                && property.metadata[VISIBILITY_NAME]
                && property.metadata[VISIBILITY_NAME].source;

            require([
                'structuredIngest/form',
                'structuredIngest/templates/modal.hbs'
            ], (CSVMappingForm, template) => {
                const $modal = $(template({})).appendTo('#app');
                CSVMappingForm.attachTo($modal, { vertex, visibilitySource });
            });
        },
        analyze() {
            util.analyze(this.props.vertex.id, { hasHeaderRow: false })
                .then(result => {
                    const { rows, total } = result;
                    this.setState({ error: false, rows, total })
                })
                .catch(error => {
                    console.error(error);
                    this.setState({ error: true })
                })
        }
    });

    return StructuredIngestTextSection;
});
