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
    'flight/lib/component',
    './edge-item.hbs',
    'util/requirejs/promise!util/service/ontologyPromise',
    'util/vertex/justification/viewer',
    'util/withDataRequest',
    'util/vertex/formatters'
], function (defineComponent,
    template,
    ontology,
    JustificationViewer,
    withDataRequest,
    F) {
    'use strict';

    return defineComponent(EdgeItem, withDataRequest);

    function EdgeItem() {

        this.after('initialize', function () {
            const edge = this.attr.item,
                ontologyRelation = ontology.relationships.byTitle[edge.label],
                title = ontologyRelation.titleFormula ? F.edge.title(edge) : ontologyRelation.displayName,
                subtitle = ontologyRelation.subtitleFormula ? F.edge.subtitle(edge) : null,
                timeSubtitle = ontologyRelation.timeFormula ? F.edge.time(edge) : null;

            this.$node.data('edgeId', edge.id);

            Promise.all([
                this.dataRequest('vertex', 'store', {vertexIds: [edge.inVertexId, edge.outVertexId]}),
                this.dataRequest('config', 'properties')
            ])
                .spread((vertices, properties) => {
                    const inVertex = _.findWhere(vertices, {id: edge.inVertexId});
                    const outVertex = _.findWhere(vertices, {id: edge.outVertexId});
                    this.$node
                        .addClass('default')
                        .addClass('edge-item')
                        .addClass(timeSubtitle ? 'has-timeSubtitle' : '')
                        .addClass(subtitle ? 'has-subtitle' : '')
                        .html(template({
                            title: title,
                            timeSubtitle: timeSubtitle,
                            subtitle: subtitle,
                            inVertex: this.getData(inVertex),
                            outVertex: this.getData(outVertex),
                        }));

                    if (properties['field.justification.validation'] !== 'NONE' &&
                        this.attr.usageContext === 'detail/multiple') {
                        this.renderJustification();
                    }
                });
        });

        this.getData = function (vertex) {
            if (!vertex) {
                return {
                    title: i18n('element.unauthorized'),
                    image: 'img/glyphicons/glyphicons_194_circle_question_mark@2x.png',
                    custom: false
                }
            }
            return {
                title: F.vertex.title(vertex),
                image: F.vertex.image(vertex, null, 80),
                custom: !F.vertex.imageIsFromConcept(vertex)
            };
        };

        this.renderJustification = function() {
            const edge = this.attr.item,
                titleSpan = this.$node.children('span.title'),
                justification = _.findWhere(edge.properties, { name: ONTOLOGY_CONSTANTS.PROP_JUSTIFICATION }),
                sourceInfo = _.findWhere(edge.properties, { name: '_sourceMetadata' });

            if (justification || sourceInfo) {
                titleSpan.empty();
                JustificationViewer.attachTo(titleSpan, {
                    justificationMetadata: justification && justification.value,
                    sourceMetadata: sourceInfo && sourceInfo.value
                });
            }
        };

        this.before('teardown', function () {
            this.$node.removeData('edgeId');
            this.$node.removeClass('edge-item has-timeSubtitle has-subtitle');
            this.$node.empty();
        });
    }
});
