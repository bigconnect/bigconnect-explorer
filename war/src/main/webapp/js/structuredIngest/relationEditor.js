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
    './templates/relationEditor.hbs',
    'util/withDataRequest',
    'util/vertex/formatters',
    'util/ontology/relationshipSelect',
    'util/visibility/edit',
    'require'
], function(
    defineComponent,
    template,
    withDataRequest,
    F,
    RelationshipSelector,
    Visibility,
    require) {
    'use strict';

    var idIncrementor = 0;

    return defineComponent(RelationEditor, withDataRequest);

    function RelationEditor() {

        this.defaultAttrs({
            closeSelector: '.cancel-mapping',
            selectSelector: '.selector',
            visibilitySelector: '.visibility',
            addSelector: '.add-edge'
        });

        this.after('initialize', function() {
            var self = this;

            this.on('click', {
                closeSelector: this.onClose,
                addSelector: this.onAddEdge
            });

            Promise.resolve(this.render())
                .then(function() {
                    self.trigger('fieldRendered');
                })
        });

        this.after('teardown', function() {
            this.$node.empty();
        })

        this.render = function() {
            var self = this;

            this.on('relationshipSelected', this.onRelationshipSelected);
            this.on('visibilitychange', this.onVisibilityChanged);

            this.$node.html(template(this.attr));

            return new Promise(function(fulfill) {
                self.off('rendered');
                self.on('rendered', fulfill);
                RelationshipSelector.attachTo(self.select('selectSelector'), {
                    sourceConcept: self.attr.sourceConcept,
                    targetConcept: self.attr.targetConcept
                });

                const visibilityAttr = { placeholder: i18n('csv.file_import.relationship.visibility.placeholder') };
                if (self.attr.defaultVisibilitySource) {
                    visibilityAttr.value = self.visibility || self.attr.defaultVisibilitySource;
                }

                Visibility.attachTo(self.select('visibilitySelector'), visibilityAttr);
            })
        };

        this.onVisibilityChanged = function(event, data) {
            this.visibility = data.value;
        };

        this.onRelationshipSelected = function(event, data) {
            this.selectedRelationship = data.relationship;
            this.select('addSelector').prop('disabled', !data.relationship);
        };

        this.onAddEdge = function() {
            if (this.selectedRelationship) {
                this.trigger('updateMappedObject', {
                    type: 'edge',
                    finished: true,
                    object: {
                        id: 'edge-' + (idIncrementor++),
                        displayName: [this.attr.sourceDisplayName, this.attr.targetDisplayName].join(' → '),
                        label: this.selectedRelationship.title,
                        outVertex: this.attr.sourceIndex,
                        inVertex: this.attr.targetIndex,
                        visibilitySource: this.visibility
                    }
                })
                this.teardown();
            }
        };

        this.onClose = function() {
            this.trigger('updateMappedObject');
        };
    }
});
