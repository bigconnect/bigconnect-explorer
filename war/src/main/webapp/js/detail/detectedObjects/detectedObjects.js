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
    'util/withDataRequest',
    'util/vertex/formatters',
    'util/privileges',
    'util/dnd',
    'd3',
    'require'
], function(
    defineComponent,
    withDataRequest,
    F,
    Privileges,
    dnd,
    d3,
    require) {
    'use strict';

    var PERCENT_CLOSE_FOR_ROUNDING = 5; // Used for sorting x/y coordinates of detected objects
                                        // This is the distance (%) at which
                                        // objects are considered positioned similarly


    return defineComponent(DetectedObjects, withDataRequest);

    function DetectedObjects() {

        this.attributes({
            detectedObjectTagSelector: '.detected-object-tag',
            detectedObjectSelector: '.detected-object',
            model: null
        })

        this.after('initialize', function() {
            this.model = this.attr.model;

            this.on('updateModel', this.onUpdateModel);
            this.on('closeDropdown', this.onCloseDropdown);
            this.on('click', {
                detectedObjectSelector: this.onDetectedObjectClicked
            });

            var root = this.$node.closest('.org-bigconnect-layout-root');
            this.on(root, 'detectedObjectEdit', this.onDetectedObjectEdit);
            this.on(root, 'detectedObjectDoneEditing', this.onDetectedObjectDoneEditing);
            this.updateDetectedObjects();
        });

        this.onCloseDropdown = function(event) {
            var self = this;
            _.defer(function() {
                self.trigger('detectedObjectDoneEditing');
            })
        };

        this.onDetectedObjectDoneEditing = function(event, data) {
            this.$node.find('.underneath').teardownAllComponents().remove();
        };

        this.onDetectedObjectEdit = function(event, data) {
            if (data) {
                this.showForm(data, this.node);
            } else {
                this.$node.find('.underneath').teardownAllComponents();
            }
        };

        this.onUpdateModel = function(event, data) {
            this.model = data.model;
            this.updateDetectedObjects();
        };

        this.onDetectedObjectClicked = function(event) {
            if (Privileges.missingEDIT) {
                return;
            }

            event.preventDefault();

            var self = this,
                $target = $(event.target),
                propertyKey = $target.closest('.label-info').attr('data-property-key'),
                property = _.first(F.vertex.props(this.model, ONTOLOGY_CONSTANTS.PROP_DETECTED_OBJECT, propertyKey));

            if (!property) {
                throw new Error('Unable to find detected object matching key:' + propertyKey);
            }
            this.$node.find('.focused').removeClass('focused');
            $target.closest('.detected-object').parent().addClass('focused');

            require(['util/actionbar/actionbar'], function(ActionBar) {
                ActionBar.teardownAll();
                self.$node.off('.actionbar')

                if ($target.hasClass('resolved')) {
                    const unresolve = Privileges.canEDIT &&
                        self.attr.model.sandboxStatus !== 'PUBLIC';

                    ActionBar.attachTo($target, {
                        alignTo: 'node',
                        actions: $.extend({
                            Open: 'open.actionbar'
                        }, unresolve ? {
                            Unresolve: 'unresolve.actionbar'
                        } : {})
                    });

                    self.on('open.actionbar', function() {
                        self.trigger('selectObjects', { vertexIds: [property.value.resolvedVertexId] });
                    });
                    self.on('unresolve.actionbar', function() {
                        self.dataRequest('vertex', 'store', { vertexIds: property.value.resolvedVertexId })
                            .done(function(vertex) {
                                self.showForm({
                                    property: property,
                                    value: property.value,
                                    title: F.vertex.title(vertex),
                                    unresolve: true
                                },
                                    //$.extend({}, property.value, {
                                        //title: F.vertex.title(vertex),
                                        //propertyKey: property.key
                                    //}),
                                    $target
                                );
                            });
                    });

                } else if (Privileges.canEDIT) {

                    ActionBar.attachTo($target, {
                        alignTo: 'node',
                        actions: {
                            Resolve: 'resolve.actionbar'
                        }
                    });

                    self.on('resolve.actionbar', function(event) {
                        self.trigger('detectedObjectEdit', {
                            property: property,
                            value: property.value
                        });
                    })
                }
            });
        };

        this.showForm = function(data, $target) {
            var self = this;

            require(['../dropdowns/termForm/termForm'], function(TermForm) {
                const $form = self.$node.show().find('.underneath');
                const termForm = $form.lookupComponent(TermForm);

                if (!termForm || (data.property && data.property.key) !== termForm.attr.dataInfo.originalPropertyKey) {
                    $form.teardownComponent(TermForm);

                    const root = $('<div class="underneath text-left">');

                    if (data.property) {
                        root.appendTo(self.node);
                    } else {
                        root.prependTo(self.node);
                    }

                    TermForm.attachTo(root, {
                        artifactData: self.model,
                        dataInfo: _.extend({}, data.property, {
                            originalPropertyKey: data.property && data.property.key,
                            title: data.title
                        }, data.value),
                        restrictConcept: data.value.concept,
                        existing: Boolean(data.property && data.property.resolvedVertexId),
                        detectedObject: true,
                        unresolve: data.unresolve || false,
                        conceptType: F.vertex.concept(self.model).id
                    });
                }
            })
        };

        this.updateDetectedObjects = function() {
            var self = this,
                vertex = this.model,
                wasResolved = {},
                needsLoading = [],
                detectedObjects = vertex && F.vertex.props(vertex, ONTOLOGY_CONSTANTS.PROP_DETECTED_OBJECT) || [],
                container = this.$node.toggle(detectedObjects.length > 0);

            this.$node.addClass('bc-detectedObjects text-center');

            var tagProperties = vertex && F.vertex.props(vertex, ONTOLOGY_CONSTANTS.PROP_IMAGE_TAG);
			if (tagProperties != null && tagProperties.length > 0) {
				var root = this.$node.closest('.org-bigconnect-layout-root');
				var imageNode = root.find('.org-bigconnect-image');
				imageNode.after( "<div class='org-bigconnect-detectedTags text-center'></div>" );
				var tagsDiv = root.find(".org-bigconnect-detectedTags");

				_.each(tagProperties, (tagProperty) => {
				    let score = 'n/a';
				    if (F.vertex.hasMetadata(tagProperty, [ ONTOLOGY_CONSTANTS.PROP_METADATA_IMAGE_SCORE ])) {
				        score = tagProperty.metadata[ONTOLOGY_CONSTANTS.PROP_METADATA_IMAGE_SCORE]
                    }
                    tagsDiv.append(`<div data-toggle='tooltip' title='Confidence: ${score}' class='label label-info detected-tag' style='cursor: pointer;'>${tagProperty.value}</div>`);

                })

				$(document).ready(function() {
					$("body").tooltip({ selector: '[data-toggle=tooltip]' });
				});
			}

            detectedObjects.forEach(function(detectedObject) {
                var key = detectedObject.value.originalPropertyKey,
                    resolvedVertexId = detectedObject.value.resolvedVertexId;

                if (key) {
                    wasResolved[key] = true;
                }

                if (resolvedVertexId) {
                    needsLoading.push(resolvedVertexId);
                }
            });

            Promise.all([
                this.dataRequest('vertex', 'store', { vertexIds: needsLoading }),
                this.dataRequest('ontology', 'concepts')
            ]).done(function(results) {
                var vertices = results[0],
                    concepts = results[1],
                    verticesById = _.indexBy(vertices, 'id'),
                    roundCoordinate = function(percentFloat) {
                        return PERCENT_CLOSE_FOR_ROUNDING *
                            (Math.round(percentFloat * 100 / PERCENT_CLOSE_FOR_ROUNDING));
                    },
                    detectedObjectKey = _.property('key');

                d3.select(container.get(0))
                    .selectAll('.detected-object-tag')
                    .data(detectedObjects, detectedObjectKey)
                    .call(function() {
                        this.enter()
                            .append('div')
                            .attr('class', 'detected-object-tag')
                            .attr('data-vertex-id', function(detectedObject) {
                                return detectedObject.value.resolvedVertexId;
                            })
                            .append('div');

                        this.sort(function(a, b) {
                                var sort =
                                    roundCoordinate((a.value.y2 - a.value.y1) / 2 + a.value.y1) -
                                    roundCoordinate((b.value.y2 - b.value.y1) / 2 + b.value.y1)

                                if (sort === 0) {
                                    sort =
                                        roundCoordinate((a.value.x2 - a.value.x1) / 2 + a.value.x1) -
                                        roundCoordinate((b.value.x2 - b.value.x1) / 2 + b.value.x1)
                                }

                                return sort;
                            })
                            .style('display', function(detectedObject) {
                                if (wasResolved[detectedObject.key]) {
                                    return 'none';
                                }
                            })
                            .select('div')
                                .attr('data-vertex-id', function(detectedObject) {
                                    return detectedObject.value.resolvedVertexId;
                                })
                                .attr('data-property-key', function(detectedObject) {
                                    return detectedObject.key;
                                })
                                .attr('class', function(detectedObject) {
                                    var classes = 'label label-info detected-object opens-dropdown';
                                    if (detectedObject.value.edgeId) {
                                        return classes + ' resolved vertex'
                                    }
                                    return classes;
                                })
                                .text(function(detectedObject) {
                                    var resolvedVertexId = detectedObject.value.resolvedVertexId,
                                        resolvedVertex = resolvedVertexId && verticesById[resolvedVertexId];
                                    if (resolvedVertex) {
                                        return F.vertex.title(resolvedVertex);
                                    } else if (resolvedVertexId) {
                                        return i18n('detail.detected_object.vertex_not_found');
                                    }
                                    return concepts.byId[detectedObject.value.concept] ?
                                        concepts.byId[detectedObject.value.concept].displayName.displayName :
                                        detectedObject.value.concept;
                                })
                    })
                    .exit().remove();

                    self.$node
                        .off('.detectedObject')
                        .on('mouseenter.detectedObject mouseleave.detectedObject',
                            self.attr.detectedObjectTagSelector,
                            self.onDetectedObjectHover.bind(self)
                        );

                    if (vertices.length) {
                        self.updateDraggables();
                    }
                });
        };

        this.onDetectedObjectHover = function(event) {
            var $target = $(event.target),
                tag = $target.closest('.detected-object-tag'),
                badge = tag.find('.label-info'),
                propertyKey = badge.attr('data-property-key');

            this.trigger(event.type === 'mouseenter' ? 'detectedObjectEnter' : 'detectedObjectLeave',
                F.vertex.props(this.model, ONTOLOGY_CONSTANTS.PROP_DETECTED_OBJECT, propertyKey)
            );
        };

        this.updateDraggables = function() {
            var self = this,
                objects = this.$node.children();

            objects.each(function(i, object) {
                $(object)
                    .attr('draggable', true)
                    .off('dragstart')
                    .on('dragstart', function(event) {
                        const vertexId = $(event.target).data('vertexId');
                        const elements = { vertexIds: [vertexId] };
                        const dt = event.originalEvent.dataTransfer;

                        dnd.setDataTransferWithElements(dt, elements);
                    });
            })
        };
    }
});
