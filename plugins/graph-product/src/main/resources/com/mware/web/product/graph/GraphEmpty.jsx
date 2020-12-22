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
], function() {
    'use strict';

    const GraphEmpty = function(props) {
        const { panelPadding, onSearch, onCreate, editable } = props;

        return (
            <div className="products-empty-wrap" style={{ ...panelPadding }}>
                <div className="products-empty">
                    <h1>{i18n('org.bigconnect.web.product.graph.empty.title')}</h1>
                    {editable ? (<h2>{i18n('org.bigconnect.web.product.graph.empty.subtitle')}</h2>) : null}
                    {editable ? (
                    <ul className="createGraph">
                        <li>
                            <strong>Add dataset</strong>
                            <p>Choose an existing dataset from the toolbar to add to the graph</p>
                        </li>
                        <li onClick={onSearch}>
                            <strong>{i18n('org.bigconnect.web.product.graph.empty.search')}</strong>
                            <p>{i18n('org.bigconnect.web.product.graph.empty.search.description.prefix')} <a href="#" onClick={onSearch}>{i18n('org.bigconnect.web.product.graph.empty.search')}</a> {i18n('org.bigconnect.web.product.graph.empty.search.description.suffix')}</p>
                        </li>
                        <li onClick={onCreate}>
                            <strong>{i18n('org.bigconnect.web.product.graph.empty.upload')}</strong>
                            <p>{i18n('org.bigconnect.web.product.graph.empty.upload.description.prefix')} <a href="#" onClick={onCreate}>{i18n('org.bigconnect.web.product.graph.empty.upload')}</a> {i18n('org.bigconnect.web.product.graph.empty.upload.description.suffix')}</p>
                        </li>
                        <li onClick={onCreate}>
                            <strong>{i18n('org.bigconnect.web.product.graph.empty.create')}</strong>
                            <p>{i18n('org.bigconnect.web.product.graph.empty.create.description.prefix')} <a href="#" onClick={onCreate}>{i18n('org.bigconnect.web.product.graph.empty.create')}</a> {i18n('org.bigconnect.web.product.graph.empty.create.description.suffix')}</p>
                        </li>
                    </ul>
                    ) : null}
                </div>
            </div>
        )
    };

    return GraphEmpty;
});
