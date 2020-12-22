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
    'util/ontology/conceptSelect',
    'util/ontology/relationshipSelect',
    'util/withFormFieldErrors',
    'util/withDataRequest',
    'util/vertex/formatters',
    '../withPopover'
], function(
    defineComponent,
    ConceptSelector,
    RelationshipSelector,
    withFormFieldErrors,
    withDataRequest,
    F,
    withPopover) {
    'use strict';

    return defineComponent(AddRelatedPopover, withPopover, withFormFieldErrors, withDataRequest);

    function AddRelatedPopover() {

        this.defaultAttrs({
            addButtonSelector: '.add',
            searchButtonSelector: '.search',
            cancelButtonSelector: '.cancel',
            promptAddButtonSelector: '.prompt-add'
        });

        this.before('initialize', function(node, config) {
            if (config.vertex) {
                config.multiple = config.vertex.length > 1;
                if (config.multiple) {
                    config.title = i18n('popovers.add_related.title_multiple', config.vertex.length);
                } else {
                    config.title = '"' + F.vertex.title(config.vertex[0]) + '"';
                }
            } else {
                console.warn('vertex attribute required');
                config.title = i18n('popovers.add_related.title_unknown');
            }
            config.template = 'addRelated/template';
        });

        this.after('initialize', function() {
            var self = this;

            this.after('setupWithTemplate', function() {
                this.on(this.popover, 'conceptSelected', this.onConceptSelected);
                this.on(this.popover, 'relationshipSelected', this.onRelationshipSelected);
                this.on(this.popover, 'click', {
                    addButtonSelector: this.onAdd,
                    cancelButtonSelector: this.onCancel,
                    searchButtonSelector: this.onSearch,
                    promptAddButtonSelector: this.onPromptAdd
                });

                this.enterShouldSubmit = 'addButtonSelector';

                ConceptSelector.attachTo(self.popover.find('.concept'), {
                    focus: true,
                    defaultText: i18n('popovers.add_related.concept.default_text')
                });

                RelationshipSelector.attachTo(self.popover.find('.relationship'), {
                    defaultText: i18n('popovers.add_related.relationship.default_text')
                });

                this.positionDialog();
            });
        });

        this.onRelationshipSelected = function(event, data) {
            this.relationshipId = data.relationship && data.relationship.title;
            this.checkValid();
        };

        this.onConceptSelected = function(event, data) {
            this.conceptId = data.concept && data.concept.id;
            this.checkValid();
            this.trigger(this.popover.find('.relationship'), 'limitParentConceptId', {
                conceptId: this.conceptId
            });
        };

        this.checkValid = function() {
            var searchButton = this.popover.find('.search').hide(),
                promptAdd = this.popover.find('.prompt-add').hide(),
                cancelButton = this.popover.find('.cancel').show(),
                addButton = this.popover.find('.add');

            if (this.relatedRequest && this.relatedRequest.cancel) {
                this.relatedRequest.cancel();
            }
            this.clearFieldErrors(this.popover);
            searchButton.hide();
            promptAdd.hide();
            cancelButton.hide();
            addButton.show();
        };

        this.onSearch = function(event) {
            this.trigger(document, 'searchByRelatedEntity', {
                vertexIds: this.attr.relatedToVertexIds,
                conceptId: this.conceptId,
                relationshipId: this.relationshipId
            });
            this.teardown();
        };

        this.onPromptAdd = function(event) {
            var self = this;

            this.trigger('addRelatedDoAdd', {
                addVertices: this.promptAddVertices,
                relatedToVertexIds: self.attr.relatedToVertexIds
            })

            this.teardown();
        };

        this.onCancel = function() {
            if (this.relatedRequest) {
                this.relatedRequest.cancel();
            }
        };

        this.onAdd = function(event) {
            var self = this,
                searchButton = this.popover.find('.search').hide(),
                promptAdd = this.popover.find('.prompt-add').hide(),
                cancelButton = this.popover.find('.cancel').show(),
                button = $(event.target).addClass('loading').prop('disabled', true);

            Promise.all([
                this.dataRequest('config', 'properties'),
                (
                    this.relatedRequest = this.dataRequest('vertex', 'related', this.attr.relatedToVertexIds, {
                        limitEdgeLabel: this.relationshipId,
                        limitParentConceptId: this.conceptId
                    })
                )
            ])
                .finally(function() {
                    button.removeClass('loading').prop('disabled', false);
                    searchButton.hide();
                    promptAdd.hide();
                    cancelButton.hide();
                    self.clearFieldErrors(self.popover);
                })
                .then(function(results) {
                    var config = results.shift(),
                        related = results.shift(),
                        count = related.count,
                        vertices = related.elements,
                        forceSearch = count > config['vertex.loadRelatedMaxForceSearch'],
                        promptBeforeAdding = count > config['vertex.loadRelatedMaxBeforePrompt'];

                    if (count === 0) {
                        self.markFieldErrors(i18n('popovers.add_related.no_vertices'), self.popover);
                    } else if (forceSearch) {
                        self.markFieldErrors(i18n('popovers.add_related.too_many'), self.popover);
                        button.hide();
                        searchButton.show();
                    } else if (promptBeforeAdding) {
                        button.hide();
                        searchButton.show();
                        self.promptAddVertices = vertices;
                        promptAdd.text(i18n('popovers.add_related.button.prompt_add', count)).show();
                    } else {
                        _.defer(function() {
                            self.trigger('addRelatedDoAdd', {
                                addVertices: vertices,
                                relatedToVertexIds: self.attr.relatedToVertexIds
                            })
                        });
                        self.teardown();
                    }

                })
                .catch(function() {
                    self.markFieldErrors(i18n('popovers.add_related.error'));
                })
        };
    }
});
