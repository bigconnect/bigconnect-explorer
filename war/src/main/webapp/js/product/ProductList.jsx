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
    './ProductListItem',
    'public/v1/api',
    'px-libs/toastr'
], function(createReactClass, ProductListItem, bcApi, toastr) {
    'use strict';

    const ProductList = createReactClass({
        render() {
            const { products, previewHashes, status, onCreate, types, workspace, user, ...rest } = this.props;
            const { loading, loaded } = status;
            if (!workspace) return null;
            if (!user) return null;
            const editable = workspace.editable && user.privileges.includes('EDIT')

            if (!loaded && !loading) {
                this.props.onLoadProducts();
                return null;
            }

            var itemElements = products.map(product => (
                    <ProductListItem
                        key={product.id}
                        product={product}
                        previewHash={previewHashes[product.id]}
                        editable={editable}
                        {...rest} />
                )),
                content = loading ? (<div className="message">{i18n('product.empty.message')}</div>) :
                    loaded && itemElements.length ? itemElements :
                    loaded ? (<div className="message">{i18n('product.empty.message')}</div>) :
                    (<div></div>);

            return (
                <div className="products-container">
                    <ul className="products-list nav nav-list">
                        <li className="nav-header">{i18n('product.list.header')}<span className={loading ? 'loading badge' : 'badge'}></span></li>

                        {editable ?
                            (
                                <li className="toolbar">
                                    <div className="new btn-group">
                                        <a className="btn dropdown-toggle btn-sm btn-blue" data-toggle="dropdown">{i18n('product.list.create')}</a>
                                        <ul className="dropdown-menu">
                                        {_.sortBy(types, t => i18n(`${t}.name`)).map(type => {
                                            return (
                                                <li key={type}><a onClick={onCreate.bind(this, type)} key={type}>{i18n(type + '.name')}</a></li>
                                            )
                                        })}
                                        </ul>
                                    </div>
                                </li>
                            ) : null}
                    </ul>

                    <div className="products-list-items">
                        {content}
                    </div>
                </div>
            );

        },
    });

    return ProductList;
});
