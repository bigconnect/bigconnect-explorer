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

/**
 * Allows a user to select an ontology property from a searchable dropdown component.
 *
 * @module components/PropertySelect
 * @flight Dropdown selection component for selecting properties from the ontology
 * @attr {Array.<object>=} properties The ontology properties to populate the list with, if not provided will use visible properties
 * @attr {string} [placeholder=Select Property] the placeholder text to display
 * @attr {boolean} [creatable=true] Allow creation of new properties if the user has ONTOLOGY_ADD privilege
 * @attr {boolean} [limitParentConceptId=''] Only show properties that are attached to this concept or it's descendents
 * @attr {boolean} [onlySearchable=false] Only show properties that have searchable attribute equal to true in ontology
 * @attr {boolean} [onlySortable=false] Only show properties that have sortable attribute equal to true in ontology
 * @attr {string} [onlyDataTypes=[]] Only show properties that have matching data type in ontology
 * @attr {boolean} [rollupCompound=true] Hide all dependant properties and only show the compound/parent fields
 * @attr {boolean} [focus=false] Activate the field for focus when finished rendering
 * @attr {string} [selectedProperty=''] Default the selection to this property IRI
 * @fires module:components/PropertySelect#propertyselected
 * @listens module:components/PropertySelect#filterProperties
 * @listens module:components/PropertySelect#selectProperty
 * @example
 * dataRequest('ontology', 'properties').then(function(properties) {
 *     PropertySelect.attachTo(node, {
 *         properties: properties
 *     })
 * })
 */
define([
    'flight/lib/component',
    'util/component/attacher'
], function(defineComponent, attacher) {

    var HIDE_PROPERTIES = [ONTOLOGY_CONSTANTS.PROP_COMMENT_ENTRY];

    return defineComponent(PropertySelect);

    function PropertySelect() {
        this.after('teardown', function () {
            this.attacher.teardown();
        });

        this.after('initialize', function () {
            if ('unsupportedProperties' in this.attr) {
                console.warn('Attribute `unsupportedProperties` no longer used. Use filter attributes to customize list');
            }

            if ('maxItems' in this.attr) {
                console.warn('maxItems is no longer supported');
            }

            /**
             * Trigger to change the filters or list of properties the component works with.
             *
             * @event module:components/PropertySelect#filterProperties
             * @property {module:components/PropertySelect#filters} filters Attributes used to filter the properties in the component
             * @example
             * PropertySelect.attachTo($node)
             * //...
             * $node.trigger('filterProperties', { properties: newList })
             * $node.trigger('filterProperties', { conceptId: null }) //clear a filter
             * $node.trigger('filterProperties', { searchable: true, sortable: true, dataType: null }) //set multiple at once
             */
            this.on('filterProperties', function(event, filter) {
                const params = this.attacher._params;
                const nextFilter = _.omit({ ...params.filter, ...filter }, value => value === null);

                this.attacher.params({ ...params, filter: nextFilter }).attach();
            });

            /**
             * Trigger to change the the selected property (or clear it.)
             *
             * @event module:components/PropertySelect#selectProperty
             * @property {object} data
             * @property {string} data.property The property iri to select
             * @example
             * PropertySelect.attachTo($node)
             * //...
             * $node.trigger('selectProperty', { property: ONTOLOGY_CONSTANTS.PROP_TITLE })
             * $node.trigger('selectProperty') // Clear
             */
            this.on('selectProperty', function(event, data) {
                const params = this.attacher._params;
                this.attacher.params({
                    ...params,
                    value: data && data.property || null
                }).attach();
            });

            const {
                filter = {},
                rollupCompound = true,
                hideCompound = false,
                focus,
                placeholder,
                properties,
                onlySearchable,
                onlySortable,
                onlyDataTypes,
                domainType,
                showAdminProperties,
                limitParentConceptId
            } = this.attr;

            if (_.isArray(onlyDataTypes)) {
                filter.dataTypes = onlyDataTypes
            }
            if (domainType) {
                filter.domainType = domainType;
            }
            if (onlySearchable === true) {
                filter.searchable = true;
            }
            if (showAdminProperties === true) {
                filter.userVisible = null;
            }
            if (onlySortable === true) {
                filter.sortable = true
            }
            if (limitParentConceptId) {
                filter.conceptId = limitParentConceptId;
            }
            if (properties) {
                filter.properties = _.indexBy(properties, 'title');
            }

            this.attacher = attacher()
                .node(this.node)
                .params({
                    properties: this.attr.properties,
                    filter: {
                        ...filter,
                        rollupCompound,
                        hideCompound
                    },
                    value: this.attr.selectedProperty,
                    autofocus: focus === true,
                    creatable: this.attr.creatable !== false,
                    placeholder
                })
                .behavior({
                    onSelected: (attacher, property) => {
                        /**
                         * When the user selects a property, this event will be
                         * triggered
                         *
                         * @event module:components/PropertySelect#propertyselected
                         * @property {object} data
                         * @property {object} data.property The property object that was selected
                         * @example
                         * $node.on('propertyselected', function(event, data) {
                         *     console.log(data.property)
                         * })
                         * PropertySelect.attachTo($node)
                         */
                        this.trigger('propertyselected', { property: property });
                    }
                })
                .path('components/ontology/PropertySelector');

            this.attacher.attach();
        });
    }
});
