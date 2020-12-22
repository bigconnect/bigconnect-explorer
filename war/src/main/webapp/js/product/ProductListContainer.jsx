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
    'create-react-class',
    'prop-types',
    'react-redux',
    './ProductList',
    'data/web-worker/store/product/actions',
    'data/web-worker/store/product/selectors',
    'configuration/plugins/registry'
], function(createReactClass, PropTypes, redux, ProductList, productActions, productSelectors, registry) {
    'use strict';

    registry.markUndocumentedExtensionPoint('org.bigconnect.workproduct')

    var initial;

    $(document)
        .on('menubarToggleDisplay', function handler(event, data) {
            const { name, options } = data;
            if (name === 'products' && !_.isEmpty(options)) {
                if ('id' in options) {
                    const { id: productId, ...rest } = options;
                    initial = { productId, ...rest };
                    $(document).off('menubarToggleDisplay', handler)
                } else console.warn('Specify id=[product id] in url to open product. #tools=products&id=...')
            }
        })
        .on('productsPaneVisible', function handler(event, data) {
            $(document).off('productsPaneVisible', handler);
            if (initial) return;
            bcData.storePromise.then(store => {
                const state = store.getState();
                const selected = productSelectors.getSelectedId(state)
                if (!selected) {
                    const products = productSelectors.getProducts(state);
                    if (products.length) {
                        store.dispatch(productActions.select(products[0].id))
                    }
                }
            })
        })


    return redux.connect(

        (state, props) => {
            return {
                status: productSelectors.getStatus(state),
                types: productSelectors.getProductTypes(state),
                selected: productSelectors.getSelectedId(state),
                products: productSelectors.getProducts(state),
                previewHashes: productSelectors.getPreviewHashesById(state),
                user: state.user.current,
                workspace: state.workspace.currentId ?
                    state.workspace.byId[state.workspace.currentId] : null
            }
        },

        (dispatch, props) => {

            return {
                onLoadProducts: () => { dispatch(productActions.list(initial)); initial = undefined },
                onCreate: (type) => { dispatch(productActions.create('Untitled', type)) },
                onDeleteProduct: (productId) => { dispatch(productActions.delete(productId)) },
                onUpdateTitle: (productId, title) => {
                    dispatch(productActions.updateTitle(productId, title));
                },
                onUpdateExporting: (productId, exporting) => {
                    dispatch(productActions.updateExporting(productId, exporting));
                },
                onSelectProduct: (productId) => {
                    dispatch(productActions.select(productId))
                },
                onDropElements: (product, elements) => {
                    const extension = _.findWhere(registry.extensionsForPoint('org.bigconnect.workproduct'), {
                        identifier: product.kind
                    });

                    if (extension.storeActions && _.isFunction(extension.storeActions.dropElements)) {
                        dispatch(extension.storeActions.dropElements(product.id, elements, { undoable: true }));
                    }
                }
            }
        }

    )(ProductList);
});
