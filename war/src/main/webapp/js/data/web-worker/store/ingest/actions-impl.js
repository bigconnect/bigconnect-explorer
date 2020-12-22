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
define(['../actions', 'data/web-worker/util/ajax'], function(actions, ajax) {
    actions.protectFromMain();

    const api = {
        setLoadType: ({ loadType }) => ({
            type: 'SET_LOAD_TYPE',
            payload: { loadType }
        }),

        setAnapService: ({ anapService }) => ({
            type: 'SET_ANAP_SERVICE',
            payload: { anapService }
        }),


        setDbNavType: ({ navType }) => ({
            type: 'SET_DB_NAV_TYPE',
            payload: { navType }
        }),

        changeAppMode: ({ navType, dcId, dsData }) => (dispatch, getState) => {
            dispatch(api.setDbNavType({navType}));
            dispatch(api.update(dcId, dsData));
        },

        fileUploaded: ({file}) => (dispatch, getState) => {
            let formData = new FormData();
            formData.append('file', file);
            ajax('POST', '/structured-ingest/analyzeFile', formData)
                .then((result) => {
                    const options = {
                        hasHeaderRow: false
                    };

                    let sheet = (options && 'sheetIndex' in options) ?
                        result.sheets[options.sheetIndex] :
                        _.first(result.sheets),
                        allRows = (sheet || []).parsedRows.map(function(r, i) {
                            r.index = i;
                            r.isBlank = _.every(r.columns, _.isEmpty)
                            return r;
                        }),
                        headerIndex = options && options.headerIndex || 0,
                        rows = _.reject(allRows.slice(headerIndex), function(r) {
                            return r.isBlank;
                        }),
                        longestColumn = _.max(rows, function(r) {
                            return r.columns.length;
                        }).columns.length,
                        headers;

                    if (options && options.maxRows) {
                        rows = rows.slice(0, options.maxRows + 1);
                    }

                    if (options && options.addBlankLastRow) {
                        rows.push({ isBlankLastRow: true, columns: [] })
                    }

                    rows.forEach(function(row, i) {
                        while (row.columns.length < longestColumn) {
                            row.columns.push(' ');
                        }
                    });

                    if (!_.isEmpty(sheet.columns)) {
                        headers = _.pluck(sheet.columns, 'name');
                    } else if (options && options.hasHeaderRow === false) {
                        headers = _.range(longestColumn).map(function(i) {
                            return 'Column ' + (i + 1);
                        })
                    } else {
                        headerIndex = rows[0].index;
                        headers = rows && rows[0].columns || [];
                        rows.splice(0, 1);
                    }

                    dispatch(api.updateFileAnalysis({
                        error: false,
                        headerIndex: headerIndex,
                        headers: headers,
                        headerTypes: _.object(sheet.columns.map(function(c) { return [c.name, c.type] })),
                        rows: rows,
                        total: sheet.totalRows,
                        hints: result.hints,
                        sheets: _.pluck(result.sheets, 'name'),
                        tmpFile: result.tmpFile
                    }))
                })
                .catch(error => {
                    dispatch(api.updateFileAnalysis({ error: true, errorMessage: error }));
                });
        },

        update: (dcId, dsData) => ({
            type: 'DB_UPDATE',
            payload: { dcId, dsData }
        }),

        updateFileAnalysis: (analysis) => ({
            type: 'FILE_ANALYSIS_UPDATE',
            payload: { analysis }
        })
    }

    return api;
})
