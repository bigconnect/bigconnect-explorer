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
    'util/withDataRequest',
    'util/vertex/formatters'
], function(require, defineComponent, withDataRequest, F) {
    'use strict';

    return defineComponent(CompoundField, withDataRequest);

    function CompoundField() {

        this.before('initialize', function(node, config) {
            config.asyncRender = true;
        });

        this.after('initialize', function() {
            var self = this;

            this.compoundValues = {};

            this.on('propertychange', this.onDependentPropertyChange);
            this.on('propertyinvalid', this.onDependentPropertyInvalid);

            this.dataRequest('ontology', 'properties')
                .done(function(ontologyProperties) {
                    self.ontologyProperties = ontologyProperties;
                    self.render();
                });
        });

        this.triggerFieldUpdated = function() {
            if (this.isValid()) {
                this.trigger('propertychange', {
                    propertyId: this.attr.property.title,
                    values: this.getValues()
                });
            } else {
                this.trigger('propertyinvalid', {
                    propertyId: this.attr.property.title
                });
            }
        }

        this.onDependentPropertyChange = function(event, data) {
            if ($(event.target).is(this.$node)) {
                return;
            }

            event.stopPropagation();

            this.compoundValues[data.propertyId] = data.value;

            this.triggerFieldUpdated();
        };

        this.onDependentPropertyInvalid = function(event, data) {
            if ($(event.target).is(this.$node)) {
                return;
            }

            event.stopPropagation();
            this.compoundValues[data.propertyId] = data.value;
            this.triggerFieldUpdated();
        };

        this.getValues = function() {
            var self = this;
            return _.chain(this.attr.property.dependentPropertyIris)
                .map(function(iri) {
                    var result = self.compoundValues[iri];
                    if (_.isArray(result)) {
                        return result;
                    } else if (_.isUndefined(result)) {
                        return [''];
                    }
                    return [result];
                })
                .value()
        };

        this.isValid = function() {
            var values = this.getValues();

            if (this.attr.vertex) {
                // TODO: should pass key?
                return F.vertex.propValid(this.attr.vertex, values, this.attr.property.title);
            }

            return _.any(values, function(v) {
                return v && v.length;
            })
        };

        this.render = function() {
            var self = this,
                fields = $(),
                names = _.indexBy(this.attr.values, 'name');

            Promise.all(this.attr.property.dependentPropertyIris.map(function(propertyIri, i) {
                var ontologyProperty = self.ontologyProperties.byTitle[propertyIri],
                    fieldContainer = $('<div>').addClass('compound-field'),
                    property = names[propertyIri],
                    previousValue = property ? property.value : '';

                self.compoundValues[propertyIri] = previousValue;

                return Promise.require(
                    ontologyProperty.possibleValues ?
                        'fields/restrictValues' :
                        'fields/' + ontologyProperty.dataType
                ).then(function(PropertyField) {
                    PropertyField.attachTo(fieldContainer, {
                        property: ontologyProperty,
                        newProperty: !property,
                        tooltip: {
                            title: ontologyProperty.displayName,
                            placement: 'left',
                            trigger: 'focus'
                        },
                        vertexProperty: property,
                        value: previousValue,
                        predicates: self.attr.predicates,
                        composite: true,
                        focus: i === 0
                    });
                    fields = fields.add(fieldContainer);
                })
            })).done(function() {
                self.$node.empty().append(fields);
                self.trigger('fieldRendered');
            })
        };
    }
});
