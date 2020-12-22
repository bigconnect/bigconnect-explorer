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
    './templates/autoMap.hbs',
    './util',
    'util/ontology/conceptSelect',
    'util/withDataRequest',
    'util/vertex/formatters',
    'util/visibility/edit'
], function(
    defineComponent,
    template,
    util,
    ConceptSelect,
    withDataRequest,
    F,
    Visibility) {
    'use strict';

    return defineComponent(AutoMapper, withDataRequest);

    function AutoMapper() {
        this.defaultAttrs({
            selectSelector: 'select.entity',
            addMappingButtonSelector: '.add-mapping',
            closeSelector: 'button.cancel-mapping',
            newEntitySelector: '.new-entity'
        });

        this.after('initialize', function() {
            this.on('visibilitychange', this.onVisibilityChanged);
            this.on('conceptSelected', this.onConceptSelected);

            this.on('change', {
                selectSelector: this.onChangeEntity
            });

            this.on('click', {
                closeSelector: this.onClose,
                addMappingButtonSelector: this.onAdd
            });

            this.render();
        });

        this.render = function() {
            this.$node.html(template(this.attr));
            this.prepareForNewEntity();
        };

        this.onChangeEntity = function(event) {
            var $select = $(event.target),
                selectedId = $select.val();

            if (selectedId) {
                this.selectedVertex = _.findWhere(this.attr.vertices, { id: selectedId });
                this.select('addMappingButtonSelector').prop('disabled', false);
                this.$node.find('.concept,.entity-visibility').hide();
            }  else {
                this.prepareForNewEntity();
            }
        };

        this.prepareForNewEntity = function() {
            ConceptSelect.attachTo(this.$node.find('.concept').teardownComponent(ConceptSelect).show(), {
                defaultText: i18n('csv.file_import.concept.select.placeholder')
            });
            const visibilityAttr = { placeholder: i18n('csv.file_import.entity.visibility.placeholder') };
            if (this.attr.defaultVisibilitySource) {
                visibilityAttr.value = this.entityVisibility || this.attr.defaultVisibilitySource;
            }

            Visibility.attachTo(this.$node.find('.entity-visibility').teardownComponent(Visibility).show(), visibilityAttr);

            this.$node.find(this.attr.newEntitySelector).show();
        };

        this.onVisibilityChanged = function(event, data) {
            if ($(event.target).is('.entity-visibility')) {
                if (this.selectedVertex) {
                    this.selectedVertex.visibilitySource = data.value;
                }
                this.entityVisibility = data.value
            } else {
                this.mapping.visibilitySource = data.value;
            }
        };

        this.onConceptSelected = function(event, data) {
            if (data.concept) {
                this.selectedVertex = {
                    id: 'vertex-0',
                    visibilitySource: this.entityVisibility,
                    displayName: data.concept.displayName + ' #AUTOMAP',
                    properties: [
                        {
                            name: util.CONCEPT_TYPE,
                            value: data.concept.id
                        }
                    ]
                };

                this.select('addMappingButtonSelector').prop('disabled', false);
            }
        };

        this.onClose = function() {
            this.trigger('updateMappedObject');
        };

        this.onAdd = function() {
            this.trigger('updateMappedObject', {
                type: 'vertex',
                finished: true,
                object: this.selectedVertex,
                automap: true
            })
            this.teardown();
        }

        this.after('teardown', function() {
            this.$node.empty();
        });

    }

});
