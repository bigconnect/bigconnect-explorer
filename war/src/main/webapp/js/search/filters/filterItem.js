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
    './filterItemTpl.hbs'
], function(
    defineComponent,
    FieldSelection,
    template) {
    'use strict';

    const PREDICATES = {
            HAS: 'has',
            HAS_NOT: 'hasNot',
            CONTAINS: '~',
            EQUALS: '=',
            IN: 'in',
            LESS_THAN: '<',
            LESS_THAN_EQUAL: '<=',
            GREATER_THAN: '>',
            GREATER_THAN_EQUAL: '>=',
            BETWEEN: 'range'
    };

    const GEO_PREDICATES = {
        DISJOINT: 'disjoint',
        WITHIN: 'within'
    }

    const DATA_TYPES = [
        {
            title: 'dataType:geoLocation',
            dataType: 'geoLocation',
            displayName: i18n('ontology.property.data.types.geolocation')
        }
    ]

    return defineComponent(FilterItem);

    function FilterItem() {

        this.defaultAttrs({
            fieldsSelector: '.current-property .fields',
            fieldSelector: '.configuration',
            propertySelectionSelector: '.property-selector',
            currentPropertySelector: '.current-property',
            removeSelector: '.header button.remove-icon',
            predicateSelector: '.current-property .header .dropdown .dropdown-menu li a',
			
			upSelector:'.header button.group-icon-up',
			downSelector:'.header button.group-icon-down',
			leftSelector:'.header button.group-icon-left',
			rightSelector:'.header button.group-icon-right',
			groupSelector: '.header button.group-icon-group'
        });

        this.before('teardown', function() {
            this.select('fieldSelector').teardownAllComponents();
            this.trigger('filterItemChanged', { removed: true });
        });

        this.after('initialize', function() {
            this.on('propertychange', this.onPropertyChanged);
            this.on('propertyselected', this.onPropertySelected);
            this.on('propertyinvalid', this.onPropertyInvalid);
            this.on('filterProperties', this.onFilterProperties);
            this.on('click', {
                predicateSelector: this.onPredicateClick,
                removeSelector: this.onRemoveRow,
				upSelector: this.onMoveUp,
				downSelector: this.onMoveDown,
				leftSelector: this.onMoveLeft,
				rightSelector: this.onMoveRight,
				groupSelector: this.onGroupField
            });

            this.$node.html(template({}));

            if (this.attr.property) {
                this.setCurrentProperty(this.attr);
            } else {
                this.createFieldSelection();
                this.trigger('fieldRendered');
            }
        });

        this.predicateNeedsValues = function() {
            return (this.filter.predicate !== PREDICATES.HAS && this.filter.predicate !== PREDICATES.HAS_NOT);
        };

        this.isValid = function() {
            var hasPredicateAndProperty = this.filter.predicate && (this.filter.propertyId || this.filter.dataType);
            if (hasPredicateAndProperty) {
                var propertyFieldRequired = this.predicateNeedsValues(),
                    rangeFilter = this.filter.predicate === PREDICATES.BETWEEN;

                if (rangeFilter) {
                    return !_.isEmpty(this.filter.values) && this.filter.values.length === 2;
                }
                if (propertyFieldRequired) {
                    return !_.isEmpty(this.filter.values);
                }
                return true;
            }
            return false;
        };

        this.triggerChange = function() {
            let valid = this.isValid();
            const { values, ...filter } = this.filter;

            if (this.predicateNeedsValues()) {

                if (this.filter.predicate === PREDICATES.BETWEEN) {
                    filter.values = _.sortBy(this.filter.values, function(val) {
                        if (_.isObject(val) &&
                            ('amount' in val) && ('unit' in val) &&
                            '_date' in val) {
                            return val._date;
                        }
                        return val;
                    });
                } else if (Object.keys(GEO_PREDICATES).some(predicate => GEO_PREDICATES[predicate] === this.filter.predicate)) {
                    var geo = _.first(this.filter.values);
                    filter.values = geo ? [geo.latitude, geo.longitude, geo.radius] : new Array(3);
                } else if (this.filter.predicate === PREDICATES.IN) {
                    filter.values = this.filter.values.slice(0);
                } else {
                    filter.values = this.filter.values.slice(0, 1);
                }

                valid = valid && _.every(filter.values, function(v) {
                    return !_.isUndefined(v) && !(_.isObject(v) && _.isEmpty(v));
                });
            }

            this.$node.toggleClass('invalid', !valid);

            // Omit all underscore keys
            if (filter.values) {
                filter.values = filter.values.map(function(val) {
                    return _.isObject(val) ? _.omit(val, function(val, key) {
                        return (/^_/).test(key);
                    }) : val;
                });
            }

            this.trigger('filterItemChanged', {
                valid: valid,
                filter: filter
            });
        };

        this.onFilterProperties = function(event, filter) {
            if ($(event.target).is(this.$node)) {
                if (!filter) {
                    this.listFilter = null;
                } else {
                    this.listFilter = filter;
                }

                this.select('propertySelectionSelector').trigger('filterProperties', this.listFilter);
            }
        };

        this.onRemoveRow = function(event, data) {
			var $before = this.$node.prev();
			if ($before.hasClass('logical-operators-li')) {
				$before.remove();
			}
			this.teardown();
			this.removeEmptyOperators();
			this.removeEmptyGroups();
        };
		
		this.removeEmptyOperators = function() {
			var $operator = $(".header-control-filters").next();
			if ($operator.hasClass("logical-operators-li")) {
				$operator.remove();
			}
			
			$(".field-group-ul").each(
				function() {
					var elem = $(this);
					if (elem.children().length <= 2 ) {
						elem.find('.logical-operators-li').remove();
						var $filter = elem.find('.filter');
						$filter.insertBefore(elem.parent());
					}
				}
			);
		}
		
		this.removeEmptyGroups = function(){
			$(".field-group-ul").each(
				function() {
					var elem = $(this);
					if (elem.children().length == 0) {
						elem.parent().remove();
					}
				}
			);
		}
		
        this.onPredicateClick = function(event) {
            var $anchor = $(event.target);
            this.filter.predicate = $anchor.data('value');
            $anchor.closest('.dropdown').find('.dropdown-toggle').text($anchor.text());
            this.attachFields().done();
        };

        this.onPropertyChanged = function(event, data) {
            event.stopPropagation();
            var index = $(event.target).closest('.configuration').index();
            if (this.filter.predicate === PREDICATES.BETWEEN) {
                if (!this.filter.values) {
                    this.filter.values = [undefined, undefined];
                }
                this.filter.values[index] = data.value;
            } else {
                if (index !== 0) return;
                this.filter.values = _.isArray(data.value) ? data.value : [data.value];
            }
            this.filter.metadata = data.metadata;

            this.triggerChange();
        };

        this.onPropertySelected = function(event, data) {
            this.setCurrentProperty(data);
        };

        this.onPropertyInvalid = function(event, data) {
            var index = $(event.target).closest('.configuration').index();
            if (this.filter.predicate === PREDICATES.BETWEEN) {
                if (this.filter.values && index < this.filter.values.length) {
                    this.filter.values.splice(index, 1, undefined);
                }
            } else {
                if (index !== 0) return;
                this.filter.values = [];
            }
            this.triggerChange();
        };

        this.setCurrentProperty = function(data) {
            var self = this,
                property = data.property,
                hasProperty = !!property;

            this.currentProperty = property;
            if (data.predicate === 'equal') {
                data.predicate = '=';
            }

            const filter = {
                predicate: data.predicate,
                propertyId: property && property.title,
                values: data.values || []
            };

            if (property && property.title.startsWith('dataType:')) {
                switch (property.dataType) {
                    case 'geoLocation':
                        filter.dataType = 'GEO_LOCATION';
                        break;
                    default:
                        throw new Error('Unknown datatype: ' + property.dataType);
                }
            } else {
                filter.propertyId = property && property.title;
            }

            this.filter = filter;
            this.select('propertySelectionSelector')
                .toggle(!hasProperty);
            this.select('currentPropertySelector')
                .find('label span')
                .text(property.displayName)
                .end()
                .find('.dropdown-menu')
                .html(this.predicateItemsForProperty(property))
                .each(function() {
                    var selected = $(this).find('.selected a');
                    if (!selected.length) {
                        selected = $(this).children('li').first().find('a');
                    }
                    self.filter.predicate = selected.data('value');
                    $(this).parent().find('.dropdown-toggle').text(selected.text());
                })
                .end()
                .toggle(hasProperty);

            if (hasProperty) {
                var values = this.filter.values;
                if (property.dataType === 'geoLocation' && values.length > 1) {
                    this.filter.values = [{
                        latitude: values[0] || '',
                        longitude: values[1] || '',
                        radius: values[2] || ''
                    }];
                }
                this.attachFields();
            }
        };

        this.focusField = function() {
            if (_.isEmpty(this.filter.values) && this.predicateNeedsValues()) {
                var index = 0;
                if (!_.isUndefined(this.filter.values[0]) &&
                    this.filter.predicate === PREDICATES.BETWEEN &&
                    (this.filter.values.length < 2 || _.isUndefined(this.filter.values[1]))) {
                    index = 1;
                }
                this.select('fieldSelector').eq(index).trigger('focusPropertyField');
            }
        };

        this.attachFields = function() {
            var self = this,
                fieldComponent,
                property = this.currentProperty,
                isCompoundField = property && property.dependentPropertyIris && property.dependentPropertyIris.length;

            if (isCompoundField) {
                fieldComponent = 'fields/compound/compound';
            } else if (property.displayType === 'duration') {
                fieldComponent = 'fields/duration';
            } else if (property.dataType === 'date') {
                fieldComponent = 'search/filters/dateField';
            } else if (property.dataType === 'directory/entity') {
                fieldComponent = 'search/filters/directoryEntityField';
            } else {
                fieldComponent = property.possibleValues ? 'fields/restrictValuesMulti' : 'fields/' + property.dataType;
            }

            return Promise.require(fieldComponent).then(function(PropertyFieldItem) {
                var node = self.select('fieldSelector'),
                    nodesRendered = _.reduce(node.toArray(), function(sum, el) {
                        return sum + ($(el).lookupComponent(PropertyFieldItem) ? 1 : 0);
                    }, 0),
                    fieldsToRender = 1 - nodesRendered;

                if (self.filter.predicate === PREDICATES.BETWEEN) {
                    fieldsToRender = 2 - nodesRendered;
                    node.show();
                    if (node.length < 2) {
                        node = node.add($('<div class="configuration">').appendTo(self.select('fieldsSelector')));
                    }
                } else if (self.predicateNeedsValues()) {
                    node.eq(0).show();
                    node.eq(1).hide();
                    if (self.filter.predicate === PREDICATES.IN) {
                        self.filter.values = _.isArray(self.filter.values) ? self.filter.values : [self.filter.values];
                    }
                } else {
                    node.hide();
                }

                if (fieldsToRender > 0) {
                    self.on('fieldRendered', function rendered(event) {
                        fieldsToRender--;
                        if (fieldsToRender === 0) {
                            self.off(event.type, rendered);
                            self.focusField();
                        }
                    })
                } else {
                    self.focusField();
                }
                if (isCompoundField) {
                    throw new Error('Compound properties not supported in filters.');
                } else {
                    node.each(function(i, el) {
                        PropertyFieldItem.attachTo(el, {
                            onlySearchable: true,
                            focus: false,
                            property: property,
                            value: !self.filter.values[i] ? '' : self.filter.values[i]
                        });
                    })
                }

                self.triggerChange();
            });
        };
        this.predicatesForProperty = function(property) {
            var standardPredicates = [PREDICATES.HAS, PREDICATES.HAS_NOT];

            if (property.possibleValues) {
                return [PREDICATES.IN].concat(standardPredicates);
            }

             if (property.title.startsWith('dataType:')) {
                switch (property.dataType) {
                    case 'geoLocation': return [
                           GEO_PREDICATES.WITHIN,
                           GEO_PREDICATES.DISJOINT
                       ].concat(standardPredicates);
                    default:
                        throw new Error('Unknown datatype: ' + property.dataType);

                }
            }

            switch (property.dataType) {
                case 'string': return [
                        PREDICATES.CONTAINS,
                        PREDICATES.EQUALS
                    ].concat(standardPredicates);

                case 'geoLocation': return [
                        GEO_PREDICATES.WITHIN,
                        GEO_PREDICATES.DISJOINT
                    ].concat(standardPredicates);

                case 'boolean': return [
                        PREDICATES.EQUALS
                    ].concat(standardPredicates);

                case 'directory/entity': return [
                    PREDICATES.EQUALS
                ].concat(standardPredicates);

                case 'date': return [
                    PREDICATES.LESS_THAN,
                    PREDICATES.LESS_THAN_EQUAL,
                    PREDICATES.GREATER_THAN,
                    PREDICATES.GREATER_THAN_EQUAL,
                    PREDICATES.BETWEEN,
                    PREDICATES.EQUALS
                ].concat(standardPredicates);

                case 'currency':
                case 'double':
                case 'integer':
                case 'number': return [
                    PREDICATES.LESS_THAN,
                    PREDICATES.LESS_THAN_EQUAL,
                    PREDICATES.GREATER_THAN,
                    PREDICATES.GREATER_THAN_EQUAL,
                    PREDICATES.EQUALS
                ].concat(standardPredicates);

                default:
                    throw new Error('Unknown datatype: ' + property.dataType);
            }
        };

        this.predicateItemsForProperty = function(property) {
            if (!property) return '';

            var self = this;

            return $.map(this.predicatesForProperty(property), function(predicate, i) {
                var displayText = (
                        property.displayType &&
                        i18n(true, 'search.filters.predicates.' + property.dataType + '.' + property.displayType + '.' + predicate, property.displayName)
                    ) ||
                    i18n(true, 'search.filters.predicates.' + property.dataType + '.' + predicate, property.displayName) ||
                    i18n('search.filters.predicates.' + predicate, property.displayName);
                return $('<li><a></a></li>')
                    .toggleClass('selected', self.filter.predicate ? self.filter.predicate === predicate : i === 0)
                    .find('a')
                        .text(displayText)
                        .attr('title', displayText)
                        .data('value', predicate)
                    .end();
            });
        };

        this.createFieldSelection = function() {
            const properties = [
                ..._.sortBy(this.attr.properties, 'displayName'),
                {
                    title: 'data-types-header',
                    displayName: i18n('ontology.property.header.data.types'),
                    header: true
                },
                ..._.sortBy(DATA_TYPES, 'displayName'),
            ];

            FieldSelection.attachTo(this.select('propertySelectionSelector'), {
                properties,
                onlySearchable: true,
                creatable: false,
                placeholder: i18n('search.filters.add_filter.placeholder'),
                rollupCompound: false,
                hideCompound: true,
                filter: { ...this.attr.listFilter, userVisible: true }
            });
        };

		
		this.onMoveUp = function (event, data) {
			this.trigger("moveUpField", data);
		}
		
		this.onMoveDown = function (event, data) {
			this.trigger("moveDownField", data);
		}
		
		this.onMoveLeft = function (event, data) {
			this.trigger("moveLeftField", data);
		}

		this.onMoveRight = function (event, data) {
			this.trigger("moveRightField", data);
		}

		this.onGroupField = function (event, data) {
			this.trigger("groupField", data);
		}
    }
});
