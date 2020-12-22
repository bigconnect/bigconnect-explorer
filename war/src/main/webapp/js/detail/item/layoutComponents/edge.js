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
    'util/vertex/formatters',
    'util/withDataRequest',
    'util/requirejs/promise!util/service/ontologyPromise'
    ], function(F, dataRequest, ontology) {
    'use strict';

    var conceptDisplay = _.compose(_.property('displayName'), F.vertex.concept),
        vertexStore = function(vertexId) {
            return dataRequest.dataRequest('vertex', 'store', { vertexIds: vertexId })
        },
        vertexDisplayId = function(vertexId) {
            return vertexStore(vertexId).then(F.vertex.title)
        },
        edgeLabelDisplay = function(edge) {
            const ontologyEdge = ontology.relationships.byTitle[edge.label];
            return (ontologyEdge) ? ontology.relationships.byTitle[edge.label].displayName : edge.label;
        },
        outVertexDisplay = _.compose(vertexDisplayId, _.property('outVertexId')),
        inVertexDisplay = _.compose(vertexDisplayId, _.property('inVertexId')),
        outVertexConceptDisplay = function(edge) {
            return vertexStore(edge.outVertexId).then((vertex) => vertex && !_.isArray(vertex) ? conceptDisplay(vertex) : '');
        },
        inVertexConceptDisplay = function(edge) {
            return vertexStore(edge.inVertexId).then((vertex) => vertex && !_.isArray(vertex) ? conceptDisplay(vertex) : '');
        };

    return [
        {
            applyTo: { type: 'edge' },
            identifier: 'org.bigconnect.layout.root',
            layout: { type: 'flex', options: { direction: 'column' }},
            componentPath: 'detail/item/edge',
            children: [
                { ref: 'org.bigconnect.layout.header', style: { flex: '0 0 auto' } },
                { ref: 'org.bigconnect.layout.body', style: { flex: '1 1 auto', overflow: 'auto' } }
            ]
        },
        {
            applyTo: { type: 'edge' },
            identifier: 'org.bigconnect.layout.header.text',
            className: 'edge-heading',
            children: [
                { ref: 'org.bigconnect.layout.text', className: 'edge-label', model: edgeLabelDisplay },
                { ref: 'org.bigconnect.layout.text', style: 'title', className: 'vertex-out', model: outVertexDisplay },
                { ref: 'org.bigconnect.layout.text', style: 'subtitle', model: outVertexConceptDisplay },
                { ref: 'org.bigconnect.layout.text', style: 'title', className: 'vertex-in', model: inVertexDisplay },
                { ref: 'org.bigconnect.layout.text', style: 'subtitle', model: inVertexConceptDisplay }
            ]
        },

    ];
});
