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
    'util/ontology/propertySelect',
    './sortTpl.hbs',
    'util/requirejs/promise!util/service/ontologyPromise',
    'd3',
    'jquery-ui'
], function(
    defineComponent,
    FieldSelection,
    template,
    ontology,
    d3) {
    'use strict';

    return defineComponent(SortByFields);

    function SortByFields() {

        this.attributes({
            sorts: [],
            restrictToConceptId: '',
            propertySelector: '.property-select',
            listSelector: 'ul.fields',
            listItemSelector: 'ul.fields li',
            removeSelector: 'ul.fields li .remove-sort'
        });

        this.after('initialize', function() {
            this.sortFields = this.attr.sorts ? this.attr.sorts.slice() : [];
            this.on('click', {
                listItemSelector: this.onItemClick,
                removeSelector: this.onRemoveItemClick
            })
            this.on('setSortFields', this.onSetSortFields);
            this.on('filterProperties', this.onFilterProperties);
            this.on('propertyselected', this.onPropertySelected);
            this.on('drag dragcreate dragstart dropcreate drop dropover dropout resizecreate resizestart resizestop sort sortstart sortend sortupdate sortreceive sortbeforestop', function(event) {
                event.stopPropagation();
            });
            this.calculateSort = _.debounce(this.calculateSort.bind(this), 250);
            this.$node.html(template({}));

            this.attachPropertyField();
            this.updateSortFields(true);
        });

        this.onFilterProperties = function(event, filter) {
            if ($(event.target).is('.property-select')) return;

            if (!filter) {
                this.filter = null;
            } else {
                this.filter = {
                    ...(this.filter || {}),
                    ...filter,
                    searchable: true,
                    sortable: true,
                    userVisible: true
                };
            }

            this.$node.find('.property-select').trigger(event.type, this.filter);
        };

        this.onSetSortFields = function(event, data) {
            this.sortFields = data && data.sortFields || [];
            this.updateSortFields();
        };

        this.onItemClick = function(event) {
            var $li = $(event.target).closest('li'),
                index = $li.index(),
                sortField = this.sortFields[index],
                direction = sortField.direction;

            sortField.direction = direction === 'ASCENDING' ? 'DESCENDING' : 'ASCENDING';
            this.updateSortFields();
        };

        this.onRemoveItemClick = function(event) {
            event.stopPropagation();
            var self = this,
                $li = $(event.target).closest('li');

            event.target.blur();
            _.defer(function() {
                self.sortFields.splice($li.index(), 1);
                self.updateSortFields();
            })
        };

        this.attachPropertyField = function() {
            var node = this.$node.find('.property-select');
            node.teardownComponent(FieldSelection);
            FieldSelection.attachTo(node, {
                properties: ontology.properties.list,
                creatable: false,
                onlySearchable: true,
                onlySortable: true,
                rollupCompound: false,
                hideCompound: true,
                placeholder: i18n('search.sort.placeholder'),
                filter: { ...this.filter, userVisible: true }
            });
        };

        this.onPropertySelected = function(event, data) {
            event.stopPropagation();
            this.attachPropertyField();

            var hasSort = _.some(this.sortFields, function(sort) {
                return sort.field === data.property.title;
            });
            if (!hasSort) {
                this.sortFields.push({
                    field: data.property.title,
                    direction: 'DESCENDING'
                });
                this.updateSortFields();
            }
        };

        this.updateSortFields = function(preventTrigger) {
            var self = this,
                $list = this.select('listSelector');

            d3.select($list.get(0))
                .selectAll('li')
                .data(this.sortFields)
                .call(function() {
                    this.enter().append('li')
                        .call(function() {
                            this.append('div').call(function() {
                                this.append('a');
                                this.append('span');
                            })
                            this.append('button').attr('class', 'remove-sort remove-icon').html('&times');
                        })
                    this.exit().remove();
                })
                .order()
                .each(function(d) {
                    $(this)
                        .toggleClass('ascending', d.direction === 'ASCENDING')
                        .data('field', d.field);
                })
                .call(function() {
                    this.select('span')
                        .text(function(d) {
                            return ontology.properties.byTitle[d.field].displayName;
                        })
                        .attr('title', function(d) {
                            return ontology.properties.byTitle[d.field].displayName;
                        })
                    this.select('a').attr('title', function(d) {
                        return d.direction.toLowerCase();
                    });
                })

            $list.off('sortupdate')
                .sortable({
                    axis: 'y',
                    cursor: 'move',
                    tolerance: 'pointer',
                    containment: 'parent'
                })
                .on('sortupdate', function(event, ui) {
                    self.calculateSort();
                });

            if (preventTrigger !== true) {
                this.trigger('sortFieldsUpdated', {
                    sortFields: this.sortFields
                })
            }
        };

        this.calculateSort = function() {
            var $list = this.select('listSelector');
            this.sortFields = _.sortBy(this.sortFields, function(field) {
                var $li = $list.find('li').filter(function() {
                    return $(this).data('field') === field.field;
                })
                return $li.index();
            })
            this.updateSortFields();
        }

    }
});
