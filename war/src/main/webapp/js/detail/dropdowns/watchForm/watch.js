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
    'require',
    'flight/lib/component',
    'util/withDropdown',
    './propForm.hbs',
    'util/ontology/propertySelect',
    'util/ontology/relationshipSelect',
    'util/withTeardown',
    'util/vertex/vertexSelect',
    'util/vertex/formatters',
    'util/withDataRequest',
    'util/acl',
    'util/messages'
], function(
    require,
    defineComponent,
    withDropdown,
    template,
    FieldSelection,
    RFieldSelection,
    withTeardown,
    VertexSelector,
    F,
    withDataRequest,
    acl,
    i18n
) {
    'use strict';

    return defineComponent(PropertyForm, withDropdown, withTeardown, withDataRequest);

    function PropertyForm() {

        this.defaultAttrs({
            propertyListSelector: '.property-list',
            relationshipListSelector: '.relationship-list',
            saveButtonSelector: '.btn-primary',
            switchSelector: '.wc-switch',
            mode: 'property'
        });

        this.before('initialize', function(n, c) {
            c.manualOpen = true;
        });

        this.after('initialize', function() {
            var self = this;

            this.on('click', {
                saveButtonSelector: this.onSave,
                switchSelector: this.onSwitch
            });
            this.on('propertyselected', this.onPropertySelected);
            this.on('relationshipSelected', this.onRelationshipSelected);

            this.$node.html(template());

            this.select('saveButtonSelector').hide();
            this.setupPropertySelectionField();
            if (F.vertex.isVertex(this.attr.data)) {
                this.setupRelationshipSelectionField();
                this.select('relationshipListSelector').hide();
            } else {
                this.select('switchSelector').hide();
            }
        });

        this.setupPropertySelectionField = function() {
            var self = this,
                ontologyRequest;

            if (F.vertex.isEdge(this.attr.data)) {
                ontologyRequest = this.dataRequest('ontology', 'propertiesByRelationship', this.attr.data.label);
            } else {
                ontologyRequest = this.dataRequest('ontology', 'propertiesByConceptId',
                    F.vertex.prop(this.attr.data, 'conceptType'));
            }

            ontologyRequest.then(function(ontologyProperties) {
                acl.getPropertyAcls(self.attr.data)
                    .then(elementProperties => {
                        FieldSelection.attachTo(self.select('propertyListSelector'), {
                            properties: _.filter(ontologyProperties.list, p => p.userVisible),
                            focus: true,
                            placeholder: i18n('property.form.field.selection.placeholder'),
                            unsupportedProperties: _.pluck(_.where(elementProperties, {addable: false}), 'name')
                        });
                        self.manualOpen();
                    });

            });
        };

        this.setupRelationshipSelectionField = function() {
            var self = this,
                ontologyRequest,
                conceptType = F.vertex.prop(self.attr.data,'CONCEPT');

            ontologyRequest = this.dataRequest('ontology', 'relationships');

            ontologyRequest.then(function(relationshipProperties) {
                RFieldSelection.attachTo(self.select('relationshipListSelector'), {
                    limitParentConceptId: conceptType,
                    focus: true,
                    placeholder: 'Select Relationship'
                });
                self.manualOpen();
            });
        };

        this.onPropertySelected = function(event, data) {
            var self = this,
                property = data.property;

            this.currentProperty = property;
            this.select('saveButtonSelector').show();
        }

        this.onRelationshipSelected = function(event, data) {
            var self = this,
                relationship = data.relationship;

            this.currentProperty = relationship;
            this.select('saveButtonSelector').show();
        }

        this.after('teardown', function() {
            if (this.$node.closest('.buttons').length === 0) {
                this.$node.closest('tr').remove();
            }
        });

        this.onSave = function(evt) {
            var elementId = this.attr.data.id,
                propertyName = this.currentProperty.title,
                self = this;

            _.defer(this.buttonLoading.bind(this, this.attr.saveButtonSelector));

            this.$node.find('input').tooltip('hide');

            if (propertyName.length) {
                this.dataRequest('watchlist', 'create', elementId, propertyName)
                    .done(() => {
                        self.teardown();
                    });
            }
        };

        this.onSwitch = function() {
            this.select('saveButtonSelector').hide();

            if (this.attr.mode === 'property') {
                this.attr.mode = 'relationship';
                this.select('switchSelector').text('Properties');
                this.select('propertyListSelector').hide();
                this.select('relationshipListSelector').show();
            } else {
                this.attr.mode = 'property';
                this.select('switchSelector').text('Relationships');
                this.select('propertyListSelector').show();
                this.select('relationshipListSelector').hide();
            }
        }
    }
});
