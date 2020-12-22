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
    'react-redux',
    './Chart',
    'data/web-worker/store/product/selectors',
    'data/web-worker/store/product/actions',
    'data/web-worker/store/ontology/selectors',
], function(React, createReactClass, redux, Chart, productSelectors, productActions, ontologySelectors) {
    'use strict';

    const CHART_STATE_EXTENDED_DATA_KEY = 'org-bigconnect-chart-state';

    return redux.connect(
        (state, props) => {
            const product= productSelectors.getProduct(state),
                chartState = product.data[CHART_STATE_EXTENDED_DATA_KEY] ||
                    { data: null, layout: getDefaultLayout(), frames: null, id: '', name: '', datasetId: '' };

            const ontologyProperties = ontologySelectors.getProperties(state);

            return {
                ...props,
                workspaceId: state.workspace.currentId,
                product,
                chartState,
                ontologyProperties
            }
        },

        (dispatch, props) => {
            return {
                updateChartState: (productId, chartState) => dispatch(productActions.updateLocalData(
                    productId,
                    CHART_STATE_EXTENDED_DATA_KEY,
                    chartState)
                ),

                emptyChartState: (productId) => dispatch(productActions.updateLocalData(
                    productId,
                    CHART_STATE_EXTENDED_DATA_KEY,
                    { data: null, layout: getDefaultLayout(), frames: null, id: '', name: '', datasetId: '' })
                )
            }
        }
    )(Chart);

    function getDefaultLayout() {
        return {
            margin: {b: 50, r: 50, pad: 0, t: 50, l: 50},
            autosize: true
        }
    }
})
