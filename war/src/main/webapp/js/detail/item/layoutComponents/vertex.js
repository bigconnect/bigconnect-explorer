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
    'util/vertex/formatters',
    'util/requirejs/promise!util/service/ontologyPromise'
], function(Toolbar, F, ontology) {
    'use strict';

    var conceptDisplay = _.compose(_.property('displayName'), F.vertex.concept),
        vertexDisplay = F.vertex.title;

    return [
        {
            applyTo: { type: 'vertex' },
            identifier: 'org.bigconnect.layout.root',
            layout: { type: 'flex', options: { direction: 'column' }},
            componentPath: 'detail/item/vertex',
            children: [
                { ref: 'org.bigconnect.layout.header', style: { flex: '0 0 auto' } },
                { ref: 'org.bigconnect.layout.body', style: { flex: '1 1 auto', overflow: 'auto' } }
            ]
        },
        {
            applyTo: {
                constraints: ['width', 'height'],
                contexts: ['popup'],
                type: 'vertex'
            },
            identifier: 'org.bigconnect.layout.root',
            componentPath: 'detail/item/vertex',
            className: 'popupDetailPane',
            children: [
                { ref: 'org.bigconnect.layout.header.text' },
                { ref: 'org.bigconnect.layout.body' }
            ]
        },
        {
            applyTo: {
                constraints: ['width', 'height'],
                contexts: ['popup']
            },
            identifier: 'org.bigconnect.layout.body',
            children: [
                { ref: 'org.bigconnect.layout.formulas' }
            ]
        },
        {
            identifier: 'org.bigconnect.layout.formulas',
            children: [
                { ref: 'org.bigconnect.layout.formula.item', model: _.partial(modelTransformForFormula, 'subtitle') },
                { ref: 'org.bigconnect.layout.formula.item', model: _.partial(modelTransformForFormula, 'time') }
            ]
        },
        {
            identifier: 'org.bigconnect.layout.formula.item',
            collectionItem: {
                render: function(el, model) {
                    el.textContent = model;
                }
            }
        },
        {
            applyTo: { displayType: 'video' },
            identifier: 'org.bigconnect.layout.body',
            children: [
                { componentPath: 'detail/video/video', className: 'org-bigconnect-video' },
                { componentPath: 'detail/properties/properties', className: 'org-bigconnect-properties', modelAttribute: 'data' },
                { componentPath: 'comments/comments', className: 'org.bigconnect-comments', modelAttribute: 'data' },
                { componentPath: 'detail/relationships/relationships', className: 'org-bigconnect-relationships', modelAttribute: 'data' },
                { componentPath: 'detail/text/text', className: 'org-bigconnect-texts' }
            ]
        },
        {
            applyTo: { displayType: 'video' },
            identifier: 'org.bigconnect.layout.body.split',
            children: [
                { componentPath: 'detail/video/video', className: 'org-bigconnect-video' },
                { ref: 'org.bigconnect.layout.body.split.artifact' }
            ]
        },
        {
            applyTo: { displayType: 'image' },
            identifier: 'org.bigconnect.layout.body',
            children: [
                { componentPath: 'detail/image/image', className: 'org-bigconnect-image' },
                { componentPath: 'detail/detectedObjects/detectedObjects' },
                { componentPath: 'detail/properties/properties', className: 'org-bigconnect-properties', modelAttribute: 'data' },
                { componentPath: 'comments/comments', className: 'org.bigconnect-comments', modelAttribute: 'data' },
                { componentPath: 'detail/relationships/relationships', className: 'org-bigconnect-relationships', modelAttribute: 'data' },
                { componentPath: 'detail/text/text', className: 'org-bigconnect-texts' }
            ]
        },
        {
            applyTo: { displayType: 'image' },
            identifier: 'org.bigconnect.layout.body.split',
            children: [
                { componentPath: 'detail/image/image', className: 'org-bigconnect-image' },
                { componentPath: 'detail/detectedObjects/detectedObjects' },
                { ref: 'org.bigconnect.layout.body.split.artifact' }
            ]
        },
        {
            applyTo: { displayType: 'audio' },
            identifier: 'org.bigconnect.layout.body',
            children: [
                { componentPath: 'detail/audio/audio', className: 'org-bigconnect-audio' },
                { componentPath: 'detail/properties/properties', className: 'org-bigconnect-properties', modelAttribute: 'data' },
                { componentPath: 'comments/comments', className: 'org.bigconnect-comments', modelAttribute: 'data' },
                { componentPath: 'detail/relationships/relationships', className: 'org-bigconnect-relationships', modelAttribute: 'data' },
                { componentPath: 'detail/text/text', className: 'org-bigconnect-texts' }
            ]
        },
        {
            applyTo: { displayType: 'audio' },
            identifier: 'org.bigconnect.layout.body.split',
            children: [
                { componentPath: 'detail/audio/audio', className: 'org-bigconnect-audio' },
                { ref: 'org.bigconnect.layout.body.split.artifact' }
            ]
        },
        {
            applyTo: { displayType: 'video', constraints: ['width'] },
            identifier: 'org.bigconnect.layout.body',
            children: [
                { componentPath: 'detail/video/video', className: 'org-bigconnect-video' },
                { componentPath: 'detail/properties/properties', className: 'org-bigconnect-properties', modelAttribute: 'data' },
                { componentPath: 'comments/comments', className: 'org.bigconnect-comments', modelAttribute: 'data' },
                { componentPath: 'detail/relationships/relationships', className: 'org-bigconnect-relationships', modelAttribute: 'data' },
                { componentPath: 'detail/text/text', className: 'org-bigconnect-texts' }
            ]
        },
        {
            applyTo: { displayType: 'image', constraints: ['width'] },
            identifier: 'org.bigconnect.layout.body',
            children: [
                { componentPath: 'detail/image/image', className: 'org-bigconnect-image'},
                { componentPath: 'detail/detectedObjects/detectedObjects' },
                { componentPath: 'detail/properties/properties', className: 'org-bigconnect-properties', modelAttribute: 'data' },
                { componentPath: 'comments/comments', className: 'org.bigconnect-comments', modelAttribute: 'data' },
                { componentPath: 'detail/relationships/relationships', className: 'org-bigconnect-relationships', modelAttribute: 'data' },
                { componentPath: 'detail/text/text', className: 'org-bigconnect-texts' }
            ]
        },
        {
            applyTo: { displayType: 'audio', constraints: ['width'] },
            identifier: 'org.bigconnect.layout.body',
            children: [
                { componentPath: 'detail/audio/audio' },
                { componentPath: 'detail/properties/properties', className: 'org-bigconnect-properties', modelAttribute: 'data' },
                { componentPath: 'comments/comments', className: 'org.bigconnect-comments', modelAttribute: 'data' },
                { componentPath: 'detail/relationships/relationships', className: 'org-bigconnect-relationships', modelAttribute: 'data' },
                { componentPath: 'detail/text/text', className: 'org-bigconnect-texts' }
            ]
        },
        {
            identifier: 'org.bigconnect.layout.body.split.artifact',
            layout: { type: 'flex', options: { direction: 'row' }},
            children: [
                { ref: 'org.bigconnect.layout.body.left', style: { flex: 1 }},
                { ref: 'org.bigconnect.layout.body.right', style: { flex: 1 }}
            ]
        },
        {
            applyTo: { type: 'vertex' },
            identifier: 'org.bigconnect.layout.header.text',
            layout: { type: 'flex', options: { direction: 'column' }},
            className: 'vertex-header',
            children: [
                { componentPath: 'detail/headerImage/image', className: 'entity-glyphicon', modelAttribute: 'data' },
                { ref: 'org.bigconnect.layout.text', style: 'title', model: vertexDisplay, truncate: 12 },
                { ref: 'org.bigconnect.layout.text', style: 'subtitle', model: conceptDisplay }
            ]
        }
    ]

    function modelTransformForFormula(formula, model) {
        if (!_.contains(['subtitle', 'time', 'title'], formula)) {
            throw new Error('Not a valid formula', formula);
        }

        return Promise.require('util/vertex/formatters').then(function(F) {
            var names = [],
                subtitle = F.vertex[formula](model, names),
                propertyName = _.last(names);

            if (propertyName) {
                var ontologyProperty = ontology.properties.byTitle[propertyName];
                if (ontologyProperty) {
                    propertyName = ontologyProperty.displayName;
                }

                if (!subtitle) return [];
            }

            return _.compact([propertyName, subtitle]);
        });
    }
});
