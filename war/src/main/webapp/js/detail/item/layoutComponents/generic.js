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
define(['util/vertex/formatters'], function(F) {
    'use strict';

    return [
        {
            identifier: 'org.bigconnect.layout.text',
            render: function(el, model, config) {
                if (config && config.style && _.isString(config.style)) {
                    var cls = config.style;
                    switch (config.style) {
                      case 'title':
                      case 'subtitle':
                      case 'heading1':
                      case 'heading2':
                      case 'heading3':
                      case 'body':
                      case 'footnote':
                        break;
                      default:
                        throw new Error('Unknown config style: ' + config.style)
                    }
                    el.classList.add(config.style)
                }

                if (config.truncate) {
                    const text = String(model);
                    el.textContent = F.string.truncate(text, config.truncate);
                    el.title = text;
                } else {
                    el.textContent = String(model);
                }
            }
        },
        {
            identifier: 'org.bigconnect.layout.body',
            applyTo: function(model, options) {
                var enoughWidth = !_.contains(options.constraints, 'width');
                if (enoughWidth) {
                    var comment = _.findWhere(model.properties, { name: ONTOLOGY_CONSTANTS.PROP_COMMENT_ENTRY }),
                        hasRelations = !_.isEmpty(model.edgeLabels);
                    return comment || hasRelations;
                }
                return false;
            },
            children: [
                { ref: 'org.bigconnect.layout.body.split' },
                { componentPath: 'detail/text/text', className: 'org-bigconnect-texts' }
            ]
        },
        {
            identifier: 'org.bigconnect.layout.body.split',
            layout: { type: 'flex', options: { direction: 'row' }},
            children: [
                { ref: 'org.bigconnect.layout.body.left', style: { flex: 1 }},
                { ref: 'org.bigconnect.layout.body.right', style: { flex: 1 }}
            ]
        },
        {
            identifier: 'org.bigconnect.layout.body.left',
            children: [
                { componentPath: 'detail/properties/properties', className: 'org-bigconnect-properties', modelAttribute: 'data' }
            ]
        },
        {
            identifier: 'org.bigconnect.layout.body.right',
            children: [
                { componentPath: 'comments/comments', className: 'org.bigconnect-comments', modelAttribute: 'data' },
                { componentPath: 'detail/relationships/relationships', className: 'org-bigconnect-relationships', modelAttribute: 'data' }
            ]
        },
        {
            identifier: 'org.bigconnect.layout.body',
            children: [
                { componentPath: 'detail/properties/properties', className: 'org-bigconnect-properties', modelAttribute: 'data' },
                { componentPath: 'comments/comments', className: 'org.bigconnect-comments', modelAttribute: 'data' },
                { componentPath: 'detail/relationships/relationships', className: 'org-bigconnect-relationships', modelAttribute: 'data' },
                { componentPath: 'detail/text/text', className: 'org-bigconnect-texts' }
            ]
        },
        {
            identifier: 'org.bigconnect.layout.header',
            children: [
                { ref: 'org.bigconnect.layout.header.text' },
                { componentPath: 'detail/toolbar/toolbar', className: 'bc-toolbar' }
            ]
        }
    ];
});
