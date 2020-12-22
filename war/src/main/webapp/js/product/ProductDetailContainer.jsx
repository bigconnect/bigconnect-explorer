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
    'react-redux',
    'configuration/plugins/registry',
    './ProductDetail',
    './ProductDetailEmpty',
    './ProductDetailNoSelection',
    'data/web-worker/store/product/actions',
    'data/web-worker/store/product/selectors'
], function(
    createReactClass,
    redux,
    registry,
    ProductDetail,
    ProductDetailEmpty,
    ProductDetailNoSelection,
    productActions,
    productSelectors) {
    'use strict';

    const DEFAULT_PADDING = { top: 0, left: 0, right: 0, bottom: 0 };

    const ProductDetailContainer = createReactClass({
        render() {
            const props = this.props;
            var { product, products, extensions } = props;

            if (product) {
                return (<ProductDetail {...props} />);
            } else if (products && products.length) {
                return (<ProductDetailNoSelection {...props} />);
            } else if (extensions) {
                return (<ProductDetailEmpty {...props} />);
            }

            return null
        }
    })

    return redux.connect(

        (state, props) => {
            const product = productSelectors.getProduct(state);
            const { loading, loaded } = productSelectors.getStatus(state);
            const extensions = registry.extensionsForPoint('org.bigconnect.workproduct');
            const workspace = state.workspace.currentId ?
                state.workspace.byId[state.workspace.currentId] : null;

            if (product) {
                const productExtensions = _.where(extensions, { identifier: product.kind });

                if (productExtensions.length === 0) {
                    throw Error('No org.bigconnect.workproduct extensions registered for: ' + product.kind)
                }
                if (productExtensions.length !== 1) {
                    throw Error('Multiple org.workproduct extensions registered for: ' + product.kind)
                }
                return {
                    padding: DEFAULT_PADDING,
                    product,
                    hasPreview: Boolean(productSelectors.getPreviewHash(state)),
                    extension: productExtensions[0],
                    workspace
                }
            } else if (extensions.length && loaded) {
                const user = state.user.current;
                return {
                    padding: DEFAULT_PADDING,
                    products: productSelectors.getProducts(state),
                    extensions,
                    editable: workspace && user ?
                        workspace.editable && user.privileges.includes('EDIT') :
                        false,
                    workspace
                };
            }
            return {}
        },

        (dispatch) => {
            return {
                onGetProduct: (id) => dispatch(productActions.get(id)),
                onCreateProduct: (kind) => dispatch(productActions.create(i18n('product.item.title.default'), kind))
            }
        }

    )(ProductDetailContainer);
});
