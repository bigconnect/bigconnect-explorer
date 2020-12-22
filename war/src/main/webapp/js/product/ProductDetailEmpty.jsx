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
    'prop-types'
], function(createReactClass, PropTypes) {
    'use strict';

    const ProductDetailEmpty = createReactClass({
        propTypes: {
            editable: PropTypes.bool.isRequired,
            extensions: PropTypes.array.isRequired,
            padding: PropTypes.shape({
                left: PropTypes.number.isRequired,
                right: PropTypes.number.isRequired,
                top: PropTypes.number.isRequired,
                bottom: PropTypes.number.isRequired
            }),
            onCreateProduct: PropTypes.func.isRequired
        },
        render() {
            const { extensions, padding, editable } = this.props;
            const extensionItems = _.sortBy(extensions, e => i18n(e.identifier + '.name').toLowerCase())
                .map(e => {
                    const { identifier } = e;
                    return (

                        <li key={identifier}>
                            <div className="contain">
                                <div onClick={this.onClick.bind(null, identifier)} className={"productImg " + (i18n(identifier + '.name'))}>
                                    <div className="hoverContent"> <span>Add New</span> {i18n(identifier + '.name')}</div>
                                </div>
                            </div>
                            <h3>{i18n(identifier + '.name')}</h3>
                            <p>{i18n(identifier + '.name')}</p>
                            <div className="info">
                                <div className="moreInfo">{i18n(identifier + '.name')}</div>
                            </div>
                        </li>
                    );
                })
            return (
                <div className="products-empty-wrap" style={{ ...padding }}>
                    <div className="products-empty">
                        <h1>{i18n('product.empty.message')}</h1>
                        {editable ?
                            (<h2>{i18n('product.empty.create')}</h2>) :
                            (<h2>{i18n('product.empty.readonly')}</h2>)}
                        {editable ? (<ul>{extensionItems}</ul>) : null}
                    </div>
                </div>
            )
        },
        onClick(identifier) {
            this.props.onCreateProduct(identifier);
        }
    });

    return ProductDetailEmpty;
});
