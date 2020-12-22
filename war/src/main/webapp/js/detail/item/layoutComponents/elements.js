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
    'detail/toolbar/toolbar',
    'util/vertex/formatters'
], function(Toolbar, F) {
    'use strict';

    return [
        {
            applyTo: { type: 'element[]' },
            identifier: 'org.bigconnect.layout.root',
            layout: { type: 'flex', options: { direction: 'column' }},
            componentPath: 'detail/item/elements',
            children: [
                { ref: 'org.bigconnect.layout.elements.header' },
                { ref: 'org.bigconnect.layout.elements.body', style: { flex: '1 1 auto', overflow: 'auto', minHeight: '5.5em' } },
                { ref: 'org.bigconnect.layout.elements.list', style: { flex: '0 0 auto' }, className: 'ui-ignore-pane-width' }
            ]
        },
        {
            identifier: 'org.bigconnect.layout.elements.header',
            children: [
                { componentPath: 'detail/toolbar/toolbar', className: 'bc-toolbar' }
            ]
        },
        {
            identifier: 'org.bigconnect.layout.elements.body',
            children: [
                { componentPath: 'detail/properties/histograms' }
            ]
        },
        {
            identifier: 'org.bigconnect.layout.elements.list',
            layout: { type: 'flex', options: { direction: 'column' }},
            children: [
                {
                    componentPath: 'util/element/list',
                    style: { overflow: 'auto', flex: 1 },
                    attributes: function(model) {
                        return {
                            items: model,
                            showSelected: false,
                            singleSelection: true,
                            ignoreUpdateModelNotImplemented: true
                        };
                    }
                }
            ]
        }
    ];
});
