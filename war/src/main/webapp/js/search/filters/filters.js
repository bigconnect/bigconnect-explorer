
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
    'flight/lib/registry',
    './filtersTpl.hbs',
    './filterItem',
    './relatedToItem.hbs',
    './similarToItem.hbs',
    'search/sort',
    'util/vertex/formatters',
    'util/ontology/conceptSelect',
    'util/ontology/relationshipSelect',
    'util/withDataRequest',
    'configuration/plugins/registry',
    'd3'
], function(
    defineComponent,
    flightRegistry,
    template,
    FilterItem,
    relatedToItemTemplate,
    similarToItemTemplate,
    SortFilter,
    F,
    ConceptSelector,
    RelationshipSelector,
    withDataRequest,
    registry,
    d3) {
    'use strict';

    var FILTER_SEARCH_DELAY_SECONDS = 0.5;

    return defineComponent(Filters, withDataRequest);

    function Filters() {
        this.propertyFilters = {};
        this.otherFilters = {};
        this.filterId = 0;
		this.logicalOperatorsControl = null;

        this.attributes({
            removeEntityRowSelector: '.entity-filters button.remove-icon',
            removeExtensionRowSelector: '.extension-filters button.remove-icon',
            matchTypeSelector: '.match-types input',
            extensionsSelector: '.extension-filters',
            filterItemsSelector: '.filters-container .filter',
            conceptDropdownSelector: '.concepts-dropdown',
            conceptListSelector: '.concepts-list',
            relationshipListSelector: '.edgetype-list',
            edgeLabelDropdownSelector: '.edgetype-dropdown',
            sortContentSelector: '.sort-content',
            conceptFilterSelector: '.concepts-dropdown,.concepts-list,.concept-filter-header',
            edgeLabelFilterSelector: '.edgetype-dropdown,.edgetype-list,.edgetype-filter-header',
			logicalOperatorsSelector: '.logical-operators',
			
            match: 'vertex',
            supportsMatch: true,
            supportsSorting: true,
            supportsHistogram: null,
            searchType: null
        });

        this.after('initialize', function() {
            var self = this;

			this.logicalOperatorsControl = '<div class="logical-operators-control">'+
												'<select class="custom-select form-control logical-operators">'+
													'<option value="and">And</option>'+
													'<option value="or">Or</option>'+
													'<option value="not">Not</option>'+
												'</select>'+
											'</div>';
			
            this.throttledNotifyOfFilters = _.throttle(this.notifyOfFilters.bind(this), 100);
            this.notifyOfFilters = _.debounce(this.notifyOfFilters.bind(this), FILTER_SEARCH_DELAY_SECONDS * 1000);

            this.matchType = this.attr.match;
            this.previousMatchType = this.matchType;
            this.$node.html(template({
                showMatchType: this.attr.supportsMatch !== false,
                showConceptFilter: this.attr.match === 'vertex',
                showEdgeFilter: this.attr.match === 'edge',
                showSorting: this.attr.supportsSorting
            }));

            this.on('filterItemChanged', this.onFilterItemChanged);
	    this.on('moveUpField', this.onMoveUpField);
	    this.on('moveDownField', this.onMoveDownField);
	    this.on('moveLeftField', this.onMoveLeftField);
	    this.on('moveRightField', this.onMoveRightField);
	    this.on('groupField', this.onGroupField);
			

            this.on('searchByParameters', this.onSearchByParameters);
            this.on('clearfilters', this.onClearFilters);
            this.on('sortFieldsUpdated', this.onSortFieldsUpdated);
            this.on('enableMatchSelection', this.onEnableMatchSelection);
            this.on('click', {
                removeExtensionRowSelector: this.onRemoveExtensionRow,
                removeEntityRowSelector: this.onRemoveExtensionRow
            });
            this.on('change keyup', {
                extensionsSelector: function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                }
            })
            this.on('change', {
                matchTypeSelector: this.onChangeMatchType,
                logicalOperatorsSelector: this.onLogicalOperatorsChange
            })
            this.on('conceptSelected', this.onConceptChange);
            this.on('relationshipSelected', this.onEdgeTypeChange);
            this.on('searchByRelatedEntity', this.onSearchByRelatedEntity);
            this.on('searchBySimilarEntity', this.onSearchBySimilarEntity);
            this.on('searchByProperty', this.onSearchByProperty);
            this.on('filterExtensionChanged', this.onFilterExtensionChanged);

            this.requestPropertiesByDomainType = function() {
                return this.dataRequest('ontology', 'propertiesByDomainType', this.matchType);
            };

            this.on(document, 'ontologyUpdated', function(event, { ontology }) {
                const { relationships, concepts } = ontology;
                this.conceptsById = concepts.byId;
                this.relationshipsById = relationships.byId;
                this.conceptsByParent = _.groupBy(concepts.byTitle, 'parentConcept');
                this.relationshipsByParent = _.groupBy(relationships.list, 'parentIri');
            });

            this.filtersLoaded = this.dataRequest('ontology', 'ontology').then(({ relationships, concepts }) => {
                this.conceptsById = concepts.byId;
                this.relationshipsById = relationships.byId;
                this.conceptsByParent = _.groupBy(concepts.byTitle, 'parentConcept');
                this.relationshipsByParent = _.groupBy(relationships.list, 'parentIri');

                return Promise.resolve(this.addSearchFilterExtensions())
                    .then(() => {
                        return self.loadPropertyFilters();
                    })
                    .then(function() {
                        self.loadConcepts();
                        self.loadEdgeTypes();
                        self.loadSorting();
                        self.trigger('filtersLoaded');
                    });
            });
        });
		
        this.onFilterItemChanged = function(event, data) {
            var $li = $(event.target).removeClass('newrow'),
                filterId = $li.data('filterId');

            if (_.isUndefined(filterId)) {
                console.error('Something is wrong, filter doesn\'t have id', $li[0]);
            }

            if (data.valid) {
                this.propertyFilters[filterId] = data.filter;
            } else {
                delete this.propertyFilters[filterId];
                if (data.removed) {
                    $li.remove();
                }
            }
            this.notifyOfFilters();
            this.createNewRowIfNeeded();
        };

        this.addSearchFilterExtensions = function() {
            var filterSearchType = this.attr.searchType,
                $container = this.select('extensionsSelector'),
                extensions = _.where(
                    registry.extensionsForPoint('org.bigconnect.search.filter'),
                    { searchType: filterSearchType }
                ),
                componentPromises = _.map(extensions, function(extension) {
                    return Promise.require(extension.componentPath);
                });

            if (componentPromises.length) {
                componentPromises.splice(0, 0, Promise.require('search/filters/extensionItem.hbs'))
                return Promise.all(componentPromises)
                    .then(function(components) {
                        var template = components.shift();

                        $container.html(
                            components.map(function(C, i) {
                                var extension = extensions[i];

                                if (extension.filterKeys) {
                                    extension.filterKey = JSON.stringify(extension.filterKeys);
                                }
                                var $li = $(template(extension));

                                C.attachTo($li, {
                                    configurationSelector: '.configuration',
                                    changedEventName: 'filterExtensionChanged',
                                    loadSavedQueryEvent: 'loadSavedQuery',
                                    savedQueryLoadedEvent: 'savedQueryLoaded'
                                });

                                if (extension.initHidden) {
                                    $li.hide();
                                }

                                return $li;
                            })
                        )
                    });
            } else return Promise.resolve();
        }

        this.onFilterExtensionChanged = function(event, data) {
            var self = this,
                options = data && data.options,
                newFilters = _.omit(data, 'options');

            this.disableMatchEdges = data.options && data.options.disableMatchEdges === true;
            this.clearFilters({ triggerUpdates: false }).done(function() {
                _.extend(self.otherFilters, newFilters);
                $(event.target).closest('.extension-filter-row').show();
                self.notifyOfFilters();
            })
        };

        this.onSearchByProperty = function(event, data) {
            var self = this;

            event.stopPropagation();

            this.dataRequest('ontology', 'properties')
                .done(function(ontologyProperties) {
                    var properties = data.properties || _.compact([data.property]);

                    Promise.try(function() {
                        return self.onClearFilters();
                    })
                        .then(function() {
                             self.disableNotify = true;
                             if (data.conceptId) {
                                 return self.setMatchType('vertex');
                             } else if (data.edgeLabel) {
                                 return self.setMatchType('edge');
                             }
                        })
                        .then(function() {
                             if (data.conceptId) {
                                 return self.setConceptFilter(data.conceptId);
                             } else if (data.edgeLabel) {
                                 return self.setEdgeTypeFilter(data.edgeLabel);
                             }
                        })
                        .then(function() {
                            return properties
                        })
                        .each(function(property) {
                            var ontologyProperty = ontologyProperties.byTitle[property.name];
                            if (ontologyProperty &&
                                ontologyProperty.dataType === 'geoLocation' &&
                                _.isObject(property.value) &&
                                !('radius' in property.value)) {
                                property.value.radius = 1;
                            }
                            return self.addFilterItem({
                                propertyId: property.name,
                                values: property.values || [property.value],
                                predicate: property.predicate || '='
                            }, { hide: true });
                        })
                        .then(function() {
                            self.disableNotify = false;
                            self.$node.find('.filter').show();
                            self.notifyOfFilters();
                        })
                        .catch(function(error) {
                            console.error(error)
                        })
                });
        };

        this.onSearchByRelatedEntity = function(event, data) {
            event.stopPropagation();
            var self = this;

            this.disableNotify = true;
            Promise.resolve(this.clearFilters({ triggerUpdates: false }))
                .then(this.setRelatedToEntityFilter.bind(this, data.vertexIds))
                .then(this.setMatchType.bind(this, 'vertex'))
                .then(this.setConceptFilter.bind(this, data.conceptId))
                .then(this.setEdgeTypeFilter.bind(this, data.edgeLabel))
                .then(function() {
                    self.disableNotify = false;
                    self.notifyOfFilters();
                })
                .done();
        };

        this.onSearchBySimilarEntity = function(event, data) {
            event.stopPropagation();
            var self = this;

            this.disableNotify = true;
            Promise.resolve(this.clearFilters({ triggerUpdates: false }))
                .then(this.setSimilarToEntityFilter.bind(this, data.vertexIds))
                .then(this.setMatchType.bind(this, 'vertex'))
                .then(this.setConceptFilter.bind(this, data.conceptId))
                .then(this.setEdgeTypeFilter.bind(this, data.edgeLabel))
                .then(function() {
                    self.disableNotify = false;
                    self.notifyOfFilters();
                })
                .done();

        };

        this.setRelatedToEntityFilter = function(vertexIds) {
            var self = this;

            return this.dataRequest('vertex', 'store', { vertexIds: vertexIds })
                .then(function(vertices) {
                    var single = vertices[0],
                        title = vertices.length > 1 ? i18n('search.filters.title_multiple', vertices.length)
                                                    : single && F.vertex.title(single) || single.id;

                    self.select('edgeLabelFilterSelector').show();
                    self.otherFilters.relatedToVertexIds = _.pluck(vertices, 'id');
                    self.$node.find('.entity-filters').html(relatedToItemTemplate({ title })).show();
                    self.notifyOfFilters();
                });
        };

        this.setSimilarToEntityFilter = function(vertexIds) {
            var self = this;

            return this.dataRequest('vertex', 'store', { vertexIds: vertexIds })
                .then(function(vertices) {
                    var single = vertices[0],
                        title = vertices.length > 1 ? i18n('search.filters.title_multiple', vertices.length)
                            : single && F.vertex.title(single) || single.id;

                    self.select('edgeLabelFilterSelector').show();
                    self.otherFilters.similarToVertexIds = _.pluck(vertices, 'id');
                    self.$node.find('.entity-filters').html(similarToItemTemplate({ title })).show();
                    self.notifyOfFilters();
                });
        };

        this.setSort = function(sortFields, options) {
            this.currentSort = sortFields || [];
            if (!options || options.propagate !== false) {
                this.select('sortContentSelector').trigger('setSortFields', {
                    sortFields: sortFields
                });
            }
            this.notifyOfFilters();
        };

        this.setEdgeTypeFilter = function(edgeId) {
            var self = this;

            if (arguments.length === 0) {
                this.edgeLabelFilter = [];
            }
            if (_.isArray(edgeId)) {
                this.edgeLabelFilter = edgeId;
                edgeId = null;
            }
            if (!this.edgeLabelFilter) this.edgeLabelFilter = [];
            if (edgeId) {
                if (!_.findWhere(this.edgeLabelFilter, { iri: edgeId })) {
                    this.edgeLabelFilter.push({ iri: edgeId, includeChildNodes: true });
                }
                _.defer(() => {
                    this.select('edgeLabelDropdownSelector').find('input').blur();
                    this.trigger(this.select('edgeLabelDropdownSelector'), 'selectRelationshipId')
                })
            }

            if (!this.otherFilters.relatedToVertexIds && this.matchType !== 'edge') {
                return;
            }

            this.renderList('relationshipListSelector', this.edgeLabelFilter, {
                setter(v) { self.setEdgeTypeFilter(v) },
                displayName(filter) { return self.relationshipsById[filter.iri].displayName; },
                hasChildren(iri) { return self.relationshipsByParent[iri] && self.relationshipsByParent[iri].length; }
            });

            // Only filter the property list if edge search
            // If related search just notify filters
            if (this.matchType === 'edge') {
                if (this.edgeLabelFilter.length) {
                    this.filterPropertyList({ relationshipId: _.map(this.edgeLabelFilter, edgeLabelFilter => edgeLabelFilter.iri) });
                    this.notifyOfFilters();
                } else {
                    this.filterPropertyList({ domainType: 'relationship' });
                    this.notifyOfFilters();
                }
            } else {
                this.notifyOfFilters();
            }
        };

        this.filterPropertyList = function(filter) {
            this.propertyListFilter = filter;

            this.select('filterItemsSelector')
                .add(this.select('sortContentSelector'))
                .trigger('filterProperties', filter)
        }

        this.setMatchType = function(type) {
            this.matchType = type;
            this.$node.find('.match-type-' + type).prop('checked', true);
            this.$node.find('.match-type-edge').closest('label').addBack()
                .prop('disabled', this.disableMatchEdges === true);
            this.select('conceptFilterSelector').toggle(type === 'vertex');
            this.select('edgeLabelFilterSelector').toggle(Boolean(this.otherFilters.relatedToVertexIds || type === 'edge'));
            if (this.matchType === 'vertex') {
                this.setConceptFilter(this.conceptFilter);
            } else {
                this.setEdgeTypeFilter(this.edgeLabelFilter);
            }

            this.clearFiltersUI();
            this.clearLogicalOperatorsUI();

            this.setSort();

            return Promise.resolve(this.propertiesByDomainType[type] || this.requestPropertiesByDomainType())
                .then(result => {
                    if (result.length) {
                        this.propertiesByDomainType[type] = result;
                    }
                    const domainType = this.matchType === 'vertex' ? 'concept' : 'relationship';
                    const filters = { domainType, conceptId: null, relationshipId: null }

                    if (domainType === 'concept' && this.propertyListFilter && this.propertyListFilter.conceptId) {
                        filters.conceptId = this.propertyListFilter.conceptId;
                    } else if (domainType === 'relationship' && this.propertyListFilter && this.propertyListFilter.relationshipId) {
                        filters.relationshipId = this.propertyListFilter.relationshipId;
                    }

                    this.select('sortContentSelector').trigger('filterProperties', filters);
                    this.createNewRowIfNeeded();
                    this.notifyOfFilters();
                });
        };

        this.setConceptFilter = function(conceptId, includeChildNodes) {
            const self = this;

            if (arguments.length === 0) {
                this.conceptFilter = [];
            }
            if (_.isArray(conceptId)) {
                this.conceptFilter = conceptId;
                conceptId = null;
            }
            if (!this.conceptFilter) this.conceptFilter = [];
            if (conceptId) {
                if (!_.findWhere(this.conceptFilter, { iri: conceptId })) {
                    this.conceptFilter.push({
                        iri: conceptId,
                        includeChildNodes: _.isBoolean(includeChildNodes) ? includeChildNodes : true
                    });
                }
                _.defer(() => {
                    this.select('conceptDropdownSelector').find('input').blur();
                    this.trigger(this.select('conceptDropdownSelector'), 'clearSelectedConcept');
                })
            }

            if (this.matchType === 'edge') {
                return;
            }

            this.renderList('conceptListSelector', this.conceptFilter, {
                setter(v) { self.setConceptFilter(v) },
                displayName(filter) { return self.conceptsById[filter.iri].displayName; },
                hasChildren(iri) { return self.conceptsByParent[iri] && self.conceptsByParent[iri].length; }
            });

            if (this.conceptFilter.length) {
                const filters = {};

                this.filterPropertyList({ conceptId: _.map(this.conceptFilter, conceptFilter => conceptFilter.iri) });
                this.notifyOfFilters();
            } else {
                this.filterPropertyList({ conceptId: null, domainType: 'concept' });
                this.notifyOfFilters();
            }
        };

        this.renderList = function(selector, list, { setter, displayName, hasChildren }) {
            var self = this,
                $list = this.select(selector).find('.fields');

            d3.select($list.get(0))
                .selectAll('li')
                .data(list)
                .call(function() {
                    this.enter().append('li').call(function() {
                        this.append('div').attr('class', 'content').call(function() {
                            this.append('span').attr('class', 'display')
                            this.append('label').attr('class', 'descendants').call(function() {
                                this.append('input').attr('type', 'checkbox');
                                this.append('span')
                                    .text(i18n('search.filters.include.child.nodes'))
                            })
                        })
                        this.append('button').attr('class', 'remove-icon').html('&times');
                    })
                    this.exit().remove();
                })
                .order()
                .call(function() {
                    this.select('.display').text(displayName)
                    this.select('.remove-icon').on('click', function(d, index) {
                        list.splice(index, 1);
                        setter(list);
                    })
                    this.select('.descendants')
                        .style('display', function(d) {
                            var children = hasChildren(d.iri);
                            if (children) {
                                return null;
                            }

                            var filter = _.findWhere(list, { iri: d.iri });
                            filter.includeChildNodes = false;
                            return 'none'
                        })
                        .on('change', function(d) {
                            var checked = this.querySelector('input').checked;
                            d3.select(this).attr('title', checked ?
                                i18n('search.filters.child.nodes.title.selected') :
                                i18n('search.filters.child.nodes.title.unselected')
                            );
                            var filter = _.findWhere(list, { iri: d.iri });
                            if (filter) {
                                filter.includeChildNodes = checked;
                                self.notifyOfFilters();
                            }
                        })
                        .attr('title', i18n('search.filters.child.nodes.title.unselected'))
                        .select('input').property('checked', d => d.includeChildNodes)
                })
        };

        this.onChangeMatchType = function(event, data) {
            this.setMatchType($(event.target).val());
            this.clearLogicalOperatorsUI();
        };

        this.onConceptChange = function(event, data) {
            this.setConceptFilter(data.concept && data.concept.id || '');
        };

        this.onEdgeTypeChange = function(event, data) {
            this.setEdgeTypeFilter(data.relationship && data.relationship.title || '');
        };

        this.onSortFieldsUpdated = function(event, data) {
            this.setSort(data.sortFields, { propagate: false });
        };

        this.onEnableMatchSelection = function(event, data) {
            this.$node.find('.search-options').toggle(data.match === true);
            if (data.match) {
                this.setMatchType(this.matchType);
            }
        };

        this.onClearFilters = function(event, data) {
            var self = this;
            return this.clearFilters(data).then(function() {
                self.trigger('filtersCleared');
            })
        };

        this.clearFiltersUI = function() {
            const filterItems = this.$node.find('.filters-container .filter');
            filterItems.teardownAllComponents();
        };

		this.clearLogicalOperatorsUI = function() {
			this.$node.find('.filters-container .logical-operators-li').remove();
		};

        this.clearFilters = function(options = {}) {
            const self = this;

            self.clearFiltersUI();

            this.disableNotify = true;

            return Promise.resolve(this.filtersLoaded)
                .then(() => options.clearMatch !== false ? this.setMatchType('vertex') : null)
                .then(() => this.setConceptFilter())
                .then(() => this.setEdgeTypeFilter())
                .then(this.setSort.bind(this))
                .then(this.createNewRowIfNeeded.bind(this))
                .then(function() {
                    self.disableMatchEdges = false;
                    self.otherFilters = {};
                    self.$node.find('.entity-filters').hide().empty();
                    self.$node.find('.extension-filter-row').hide();
                    self.disableNotify = false;
                    if (options.triggerUpdates !== false) {
                        self.notifyOfFilters();
                    }
                });
        };

        this.hasSomeFilters = function(filters) {
            return !!(filters &&
                (!_.isEmpty(filters.conceptFilter) && this.matchType === 'vertex') ||
                (!_.isEmpty(filters.edgeLabelFilter) && this.matchType === 'edge') ||
                !_.isEmpty(filters.propertyFilters) ||
                !_.isEmpty(filters.otherFilters) ||
                !_.isEmpty(this.currentSort)
             );
        }

        this.notifyOfFilters = function(options) {
            var self = this;

            if (this.disableNotify) return;
			this.setOperatorsAndLogicalGroups();
			this.syncPropertyFilters();
			
            var filters = {
                otherFilters: this.otherFilters,
                conceptFilter: this.conceptFilter,
                edgeLabelFilter: this.edgeLabelFilter,
                sortFields: this.currentSort,
                matchType: this.matchType,
                propertyFilters: _.chain(this.propertyFilters)
                    .map(function(filter) {
                            const { propertyId, dataType, metadata, predicate, values } = filter;
                            const dataKey = dataType ? 'dataType' : 'propertyId';

                            if (propertyId) {
                                const ontologyProperty = self.propertiesByDomainType[self.matchType].find(function(property) {
                                    return property.title === propertyId;
                        });

                        if (ontologyProperty && ontologyProperty.dependentPropertyIris) {
                            return ontologyProperty.dependentPropertyIris.map(function(iri, i) {
                                        if (_.isArray(values[i]) && _.reject(values[i], function(v) {
                                        return v === null || v === undefined;
                                    }).length) {
                                    return {
                                        propertyId: iri,
                                        predicate,
                                        values: values[i],
                                        metadata
                                    }
                                }
                            });
                        }
                      }

                            return {
                                [dataKey]: filter[dataKey],
                                predicate,
                                values,
                                metadata
                            };
                    })
                    .flatten(true)
                    .compact()
                    .value()
            };

            filters.hasSome = this.hasSomeFilters(filters);
            filters.options = options;
            const matchTypeChanged = this.previousMatchType !== this.matchType;
            if (!filters.hasSome && matchTypeChanged) {
                filters.options = { matchChanged: true }
            }
            this.previousMatchType = this.matchType;

            this.trigger('filterschange', filters);
        };

        this.onRemoveExtensionRow = function(event, data) {
            var self = this,
                target = $(event.target),
                row = target.closest('.extension-filter-row,.entity-filter-row'),
                keys = row.data('filterKey');

            row.hide();
            if (!_.isArray(keys)) {
                keys = [keys];
            }
            keys.forEach(function(key) {
                delete self.otherFilters[key];
            })
            this.disableMatchEdges = false;
            this.setMatchType(this.matchType);
            this.notifyOfFilters();
        };

        this.createNewRowIfNeeded = function() {
            if (!this.propertiesByDomainType[this.matchType]) {
                return;
            }
            if (this.$node.find('.newrow').length === 0) {
                return this.addFilterItem();
            }
        };

        this.onSearchByParameters = function(event, data) {
            var self = this,
                filters = JSON.parse(data.parameters.filter);

            this.disableNotify = true;
            Promise.resolve(this.clearFilters())
                .then(function() {
                    if (data.parameters['relatedToVertexIds[]']) {
                        return self.setRelatedToEntityFilter(data.parameters['relatedToVertexIds[]']);
                    }
                })
                .then(function() {
                    var matching = self.$node.find('.extension-filter-row').filter(function() {
                        var keys = $(this).data('filterKey');
                        if (!_.isArray(keys)) {
                            keys = [keys];
                        }
                        if (_.some(data.parameters, function(val, key) {
                                return _.contains(keys, key.replace(/\[\]$/, ''));
                            })) {
                            return true;
                        }
                    });
                    return Promise.resolve(matching.toArray())
                        .each(function(extensionLi) {
                            var $extensionLi = $(extensionLi),
                                keys = $extensionLi.data('filterKey'),
                                delaySecondsBeforeTimeout = 6;

                            if (!_.isArray(keys)) {
                                keys = [keys];
                            }
                            return new Promise(function(fulfill) {
                                var newFilters = _.chain(data.parameters)
                                    .map(function(val, key) {
                                        return [key.replace(/\[\]$/, ''), val];
                                    })
                                    .filter(function(pair) {
                                        return _.contains(keys, pair[0]);
                                    })
                                    .object()
                                    .value()

                                $extensionLi
                                    .on('savedQueryLoaded', function loaded() {
                                        $extensionLi.off('savedQueryLoaded', loaded);
                                        fulfill();
                                    })
                                    .trigger('loadSavedQuery', newFilters);
                            }).timeout(delaySecondsBeforeTimeout * 1000, 'savedQueryLoaded not fired for extension that uses keys:' + keys);
                        })
                })
                .then(function() {
                    return self.setMatchType((/edge/).test(data.url) ? 'edge' : 'vertex');
                })
                .then(function() {
                    // Legacy
                    if (data.parameters.conceptType) {
                        return self.setConceptFilter(
                            data.parameters.conceptType,
                            data.parameters.includeChildNodes
                        );
                    }
                    if (data.parameters.conceptTypes) {
                        var types = data.parameters.conceptTypes;
                        if (_.isString(types)) {
                            types = JSON.parse(types)
                        }
                        return self.setConceptFilter(types);
                    }
                    return self.setConceptFilter();
                })
                .then(function() {
                    // Legacy
                    if (data.parameters.edgeLabel) {
                        return self.setEdgeTypeFilter(data.parameters.edgeLabel);
                    }
                    if (data.parameters.edgeLabels) {
                        var types = data.parameters.edgeLabels;
                        if (_.isString(types)) {
                            types = JSON.parse(types)
                        }
                        return self.setEdgeTypeFilter(types);
                    }
                    return self.setEdgeTypeFilter();
                })
                .then(function() {
                    var sortRaw = data.parameters['sort[]'],
                        sort;
                    if (sortRaw) {
                        sort = _.chain(sortRaw)
                            .map(function(sortStr) {
                                var match = sortStr.match(/^(.*):(ASCENDING|DESCENDING)$/);
                                if (match) {
                                    return {
                                        field: match[1],
                                        direction: match[2]
                                    }
                                }
                            })
                            .compact()
                            .value();
                    }
                    return self.setSort(sort);
                })
                .then(function() {
					/*
                    return Promise.resolve(filters).map(function(filter, index) {
						alert(index);
                        return self.addFilterItem(filter, { hide: true });
				}, { concurrency: 1 });}*/
					
					if (filters.length) {
						for (var i = 0; i < filters.length; i++) {
							self.addFilterItem(filters[i], { hide: true });	
						}
					}
					
                })
                .done(function() {
					self.renderLogicalParameters(data.parameters.logicalSourceString);
					
                    self.disableNotify = false;
                    self.$node.find('.filter').show();
                    self.notifyOfFilters({ submit: data.submit === true });
                });
        };

        this.teardownField = function(node) {
            var self = this,
                instanceInfo = flightRegistry.findInstanceInfoByNode(node[0]);
            if (instanceInfo && instanceInfo.length) {
                instanceInfo.forEach(function(info) {
                    delete self.propertyFilters[info.instance.attr.id];
                    self.notifyOfFilters();
                    info.instance.teardown();
                });
            }

            node.empty();
        };

        this.loadSorting = function() {
            if (!this.attr.supportsSorting) return;
            SortFilter.attachTo(this.select('sortContentSelector'));
        };

        this.loadEdgeTypes = function() {
            RelationshipSelector.attachTo(this.select('edgeLabelDropdownSelector'), {
                creatable: false,
                defaultText: i18n('search.filters.all_edgetypes')
            });
        };

        this.loadConcepts = function() {
            ConceptSelector.attachTo(this.select('conceptDropdownSelector'), {
                onlySearchable: true,
                creatable: false,
                defaultText: i18n('search.filters.all_concepts')
            })
        };

        this.loadPropertyFilters = function() {
            var self = this;

            if (!_.isObject(this.propertiesByDomainType)) {
                this.propertiesByDomainType = {};
            }

            return Promise.map(['vertex', 'edge'], type => this.dataRequest('ontology', 'propertiesByDomainType', type))
                .spread((vertexProperties, edgeProperties) => {
                    this.propertiesByDomainType['vertex'] = vertexProperties;
                    this.propertiesByDomainType['edge'] = edgeProperties;
                    return self.addFilterItem();
                })
        };

        this.addFilterItem = function(filter, options) {
            var self = this,
                $li = $('<li>').data('filterId', this.filterId++),
                attributes = filter ? {
                    property: this.propertiesByDomainType[this.matchType].find(function(property) {
                        return property.title === filter.propertyId;
                    }),
                    predicate: filter.predicate,
                    values: filter.values
                } : {
                    properties: this.propertiesByDomainType[this.matchType],
                    supportsHistogram: this.attr.supportsHistogram
                },
                $newRow = this.$node.find('.newrow');

            if (this.propertyListFilter) {
                attributes.listFilter = this.propertyListFilter;
            }

            if (filter) {
                $li.addClass('filter')
                    .toggle(Boolean(!options || !options.hide))

                if ($newRow.length) {
                    $li.insertBefore($newRow);
                } else {
                    $li.appendTo(this.$node.find('.filters-container'));
                }
            } else {
                $li.addClass('filter newrow')
                    .appendTo(this.$node.find('.filters-container'));
            }

            return new Promise(function(fulfill) {
                self.on($li, 'fieldRendered', function rendered() {
                    self.off($li, 'fieldRendered', rendered);
                    fulfill();
                });
                FilterItem.attachTo($li, attributes);
                self.createNewRowIfNeeded();
            }).done(function() {
                var $before = $li.prev();
                var $prevHeader = $before.prev().hasClass('prop-filter-header');
                if (!$before.hasClass("nav-header") && !$before.hasClass("logical-operators-li")
                                                                                    && !$prevHeader) {
                    $before.before("<li class='logical-operators-li'>"+self.logicalOperatorsControl+"</li>");
                }
            });
        }
		
		
		this.removeGroups = function() {
			$(".field-group-li").each(
				function() {
					$(this).remove();
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
		
		this.removeGroupOneItems = function() {
			$(".field-group-ul").each(
				function() {
					var elem = $(this);
					if (elem.children().length == 1) {
						var $itemLi = elem.parent();
						$itemLi.after(elem.children()[0]);
						$itemLi.remove();
					} else if (elem.children().length == 2) {
						var $itemLi = elem.parent();
						var $item0 = elem.children()[0];
						var $item1 = elem.children()[1];
						$itemLi.after($item0);
						$itemLi.after($item1);
						$itemLi.remove();
					}
				}
			);
		}
		
		
		this.onMoveUpField = function(event, data) {
			var $item = $(event.target);
			var $operator = $item.prev();
			var $itemPrev = $operator.prev();
			
			if ($operator.hasClass('logical-operators-li') ) {
				$itemPrev.insertAfter($operator);
				$item.insertBefore($operator);
			}
			this.notifyOfFilters();
		}
		
		this.onMoveDownField = function(event, data) {
			var $item = $(event.target);
			var $operator = $item.next();
			var $itemNext = $operator.next();
			
			if ($operator.hasClass('logical-operators-li') ) {
				$itemNext.insertBefore($operator);
				$item.insertAfter($operator);
			}
			this.notifyOfFilters();
		}
		
		this.onMoveLeftField = function(event, data) {
			var $item = $(event.target);
			var $operator = $item.prev();
			
			if ($item.parent().hasClass("field-group-ul")) {
				var $parentLi = $item.parent().parent();

				if ($item.is(":first-child")) {
					$operator = $item.next();
				}
				
				$parentLi.after($item);
				if ($operator.hasClass('logical-operators-li') ) {
					$item.before($operator);
				}
			}
			
			this.removeGroupOneItems();
				
		}
		
		this.onInvalidAction = function () {
			var self = this;
			 self.trigger("postLocalNotification", { notification: {
				severity: 'WARNING',
				title: 'Action must be performed on valid filters'
			}});
		}
		
		this.onMultipleNesting = function () {
			var self = this;
			 self.trigger("postLocalNotification", { notification: {
				severity: 'WARNING',
				title: 'Nesting more than 3 levels not permitted'
			}});
		}
		
		this.onGroupingNotAllowed = function () {
			var self = this;
			 self.trigger("postLocalNotification", { notification: {
				severity: 'WARNING',
				title: 'Grouping not allowed'
			}});
		}
		
		
		this.isValidGroupAction = function (currentItem) {
			var isValid = true;
			var $item = $(currentItem);
			var $operator = $item.prev();
			var $prevItem = $operator.prev();
			
			var level = 0;
			if ($item.parent().hasClass("filters-container")) {
				level = 0;
			} else if ($item.parent().parent().parent().hasClass("filters-container")) {
				level = 1;
			} else if ($item.parent().parent().parent().parent().parent().hasClass("filters-container")) {
				level = 2;
			} else {
				return false; // Unknown level return false
			}
				
			if (level == 2) {
				return false;
			}
			
			if ($prevItem && $prevItem.hasClass("field-group-li")) {
				
				var $firstUl = $prevItem.find(".field-group-ul").first();
				
				if (level == 0 && $firstUl.find(".field-group-ul").length ) {
					return false; // more than 3 levels found
				} 
				
				if (level == 1) {
					return false; // more than 3 levels found
				} 
				
			}
			return isValid;
			
		}
		
		this.isValidOperatorAction = function (currentItem) {
			var isValid = false;
			var $item = $(currentItem);
			var $operator = $item.prev();
			var $prevItem = $operator.prev();
			
			if (($item.next() && $item.next().hasClass("logical-operators-li")) || ($prevItem.prev() && $prevItem.prev().hasClass("logical-operators-li"))) {
				isValid = true;
			}
			
			return isValid;
		}
		
		this.onMoveRightField = function(event, data) {
			var $item = $(event.target);
			var $operator = $item.prev();
			var $prevItem = $operator.prev();
			var $html = '<li class="field-group-li">'+
						'<ul class="field-group-ul nav-list"></ul>'+
						'</li>';
			if ($item.hasClass("invalid") || ($prevItem && $prevItem.hasClass("invalid"))) {
				this.onInvalidAction();
				return;
			}
			
			if (!this.isValidGroupAction(event.target)) {
				this.onMultipleNesting();
				return;
			}
			
			if (!this.isValidOperatorAction(event.target)) {
				this.onGroupingNotAllowed();
				return;
			}
			
			if ($operator && $prevItem && !$item.hasClass("invalid") && !$prevItem.hasClass("invalid")) {
				$prevItem.before($html);
				var $fieldGroupUl = $prevItem.prev().find('.field-group-ul').first();
				$fieldGroupUl.append($prevItem);
				$fieldGroupUl.append($operator);
				$fieldGroupUl.append($item);
			}
			this.notifyOfFilters();
		}
		
		this.onGroupField = function(event, data) {
			var $item = $(event.target);
			var $operator = $item.prev();
			var $prevItem = $operator.prev();
			
			if ($operator && $prevItem && $prevItem.hasClass('field-group-li') && !$item.hasClass("invalid")) {
				var $fieldGroupUl = $prevItem.find('.field-group-ul').first();
				$fieldGroupUl.append($operator);
				$fieldGroupUl.append($item);
			}
			this.removeGroupOneItems();
			this.notifyOfFilters();
		}
		
		this.getMaxFilterId = function () {
			var max = 0;
			var listItems = $(".filters-container li");
			listItems.each(function(idx, li) {
				var filterId = $(li).data('filterId');
				if (filterId != null && filterId > max)  {
					max = filterId;
				}
			});

			return max;
		}

		this.syncPropertyFilters = function() {
			var filtersLi = [];
			var counter = 0;
			var listItems = $(".filters-container li");
			listItems.each(function(idx, li) {
				var filterId = $(li).data('filterId');
				if (filterId != null && !$(li).hasClass("invalid") && !$(li).hasClass("newrow"))  {
					filtersLi[counter] = new Object;
					filtersLi[counter].filterId = filterId;
					filtersLi[counter].li = li;
					counter++;
				}
			});

		
			if (filtersLi.length) {
				var newPropertyFilterArray = new Object();
				for (var i = 0; i < filtersLi.length; i++) {
					var filterLiId = filtersLi[i].filterId;
					newPropertyFilterArray [i] = this.propertyFilters[filterLiId];
					$(filtersLi[i].li).data("filterId", i);

				}
				this.propertyFilters = newPropertyFilterArray;
				
			} 
			this.filterId = this.getMaxFilterId()+1;
		}
		
		this.getCurrentFilterListAndLevel = function() {
			var listItems = $(".filters-container li");
			var currentFilters = [];
			var counter = 0;
			listItems.each(function(idx, li) {
				var filterId = $(li).data('filterId');
				var filterObject = null;
				
				if (filterId != null && !$(li).hasClass("invalid") && !$(li).hasClass("newrow") 
					&& $(li).hasClass("filter")  && !$(li).parent().hasClass("field-group-ul")) {
						 filterObject = new Object();
						 filterObject.id = counter;
						 filterObject.li = li;
						 filterObject.level = 0;
						 counter++;
					}
					else  if (filterId != null && !$(li).hasClass("invalid") && !$(li).hasClass("newrow") 
					&& $(li).hasClass("filter") && $(li).parent().hasClass("field-group-ul") &&  !$(li).parent().parent().parent().hasClass("field-group-ul")) {
						 filterObject = new Object();
						 filterObject.id = counter;
						 filterObject.li = li;
						 filterObject.level = 1;
						 counter++;
					} else if (filterId != null && !$(li).hasClass("invalid") && !$(li).hasClass("newrow") 
					&& $(li).hasClass("filter") && $(li).parent().hasClass("field-group-ul") && $(li).parent().parent().parent().hasClass("field-group-ul")
					&& $(li).parent().parent().parent().parent().parent().hasClass("filters-container")) {
						 filterObject = new Object();
						 filterObject.id = counter;
						 filterObject.li = li;
						 filterObject.level = 2;
						 counter++;
					}
				if (filterObject) {
					currentFilters.push(filterObject);
				}
			});
			
			return currentFilters;
		}
		
		this.setOperatorsAndLogicalGroups = function() {
			var self = this;
			var logicalSourceArray = [];
			var filtersAndLevels = this.getCurrentFilterListAndLevel();
			
			var operatorElement = null;
			
			if (filtersAndLevels && filtersAndLevels.length) {
				var currentLevel = 0;
				var filterLevel0 = null;
				var filterLevel1 = null;
				var filterLevel2 = null;
				var i = 0;
				while (i<filtersAndLevels.length) {
					if (filtersAndLevels[i].level == 0) {
						filterLevel0 = new Object();
						var $operator = $(filtersAndLevels[i].li).prev();
						var $operatorValue = null;
						if ($operator.hasClass('logical-operators-li')) {
							$operatorValue = $operator.find('.logical-operators').first().val();
						};
						filterLevel0.operator = $operatorValue;
						filterLevel0.id = i;
						
						logicalSourceArray.push(filterLevel0);
						filterLevel0 = null;
					} else if (filtersAndLevels[i].level == 1) {
						if (filterLevel0 == null) {
							filterLevel0 = new Object();
							if ($(filtersAndLevels[i].li).is(":first-child") && $(filtersAndLevels[i].li).parent().hasClass("field-group-ul")) {
								var $ulGroup = $(filtersAndLevels[i].li).parent();
								var $liGroup = $ulGroup.parent();
								var $operatorGroup = $liGroup.prev();
								var $operatorGroupValue = null;
								if ($operatorGroup.hasClass('logical-operators-li')) {
									$operatorGroupValue = $operatorGroup.find('.logical-operators').first().val();
								};
								
								if ($operatorGroupValue) {
									filterLevel0.operator = $operatorGroupValue;
								}
							}
						}
						
						if (filterLevel0.children == null) {
							filterLevel0.children = [];
						}
						
						filterLevel1 = new Object();
						
						var $operator = $(filtersAndLevels[i].li).prev();
						var $operatorValue = null;
						if ($operator.hasClass('logical-operators-li')) {
							$operatorValue = $operator.find('.logical-operators').first().val();
						};
						filterLevel1.operator = $operatorValue;
						filterLevel1.id = i;
						filterLevel0.children.push(filterLevel1);
						filterLevel1 = null;
						
						//check if last in group
						if ($(filtersAndLevels[i].li).is(":last-child")) {
							logicalSourceArray.push(filterLevel0);
							filterLevel0 = null;
						}
						
					} else if (filtersAndLevels[i].level == 2) {
						var level2Array = []
						while (i < filtersAndLevels.length && filtersAndLevels[i].level == 2) {
							filterLevel2 = new Object();
							var $operator = $(filtersAndLevels[i].li).prev();
							var $operatorValue = null;
							if ($operator.hasClass('logical-operators-li')) {
								$operatorValue = $operator.find('.logical-operators').first().val();
							};
							filterLevel2.operator = $operatorValue;
							filterLevel2.id = i;
							level2Array.push(filterLevel2);
							i++;
						}
						i--;
						
						if (filterLevel0 == null) {
							filterLevel0 = new Object();
						}
						if (filterLevel0.children == null) {
							filterLevel0.children = [];
							//Add operator
							if ($(filtersAndLevels[i].li).parent().parent().parent().hasClass("field-group-ul")) {
								var $ulGroup = $(filtersAndLevels[i].li).parent().parent().parent();
								var $liGroup = $ulGroup.parent();
								var $operatorGroup = $liGroup.prev();
								var $operatorGroupValue = null;
								if ($operatorGroup.hasClass('logical-operators-li')) {
									$operatorGroupValue = $operatorGroup.find('.logical-operators').first().val();
								};
								
								if ($operatorGroupValue) {
									filterLevel0.operator = $operatorGroupValue;
								}
							}
						}
						
						filterLevel1 = new Object();
						filterLevel1.children = level2Array;
						//Add operator
						if ($(filtersAndLevels[i].li).parent().hasClass("field-group-ul")) {
							var $ulGroup = $(filtersAndLevels[i].li).parent();
							var $liGroup = $ulGroup.parent();
							var $operatorGroup = $liGroup.prev();
							var $operatorGroupValue = null;
							if ($operatorGroup.hasClass('logical-operators-li')) {
								$operatorGroupValue = $operatorGroup.find('.logical-operators').first().val();
							};
							
							if ($operatorGroupValue) {
								filterLevel1.operator = $operatorGroupValue;
							}
						}
						
						filterLevel0.children.push(filterLevel1);
		
						
						//check if last in group
						if ($(filtersAndLevels[i].li).parent().parent().is(":last-child")) {
							logicalSourceArray.push(filterLevel0);
							filterLevel0 = null;
						}
					}
					
					i++;
					
				}
			}
			
			// console.log(JSON.stringify(logicalSourceArray));
			
			this.trigger("logicalSourceStringSet", {
                    logicalSourceString: JSON.stringify(logicalSourceArray)
            });
		}
		
		this.onLogicalOperatorsChange = function(event, data) {
			this.notifyOfFilters();
		}
		
		
		
		this.renderLogicalParameters = function (logicalSourceString) {
			var self = this;
			var listItems = $(".filters-container li");
			var currentFilters = [];

			this.clearLogicalOperatorsUI();
			this.removeGroups();
			
			var counter = 0;
			listItems.each(function(idx, li) {
				var filterId = $(li).data('filterId');
				if (filterId != null && !$(li).hasClass("invalid") && !$(li).hasClass("newrow"))  {
					currentFilters[counter] = li;
					counter++;
				}
			});
			
			var operators = [];
			
			if (logicalSourceString == null || !JSON.parse(logicalSourceString).length) { //build the and query
				if (currentFilters.length) {
					for (var cnt=0;cnt<currentFilters.length;cnt++) {
						var obj = new Object();
						obj.id = cnt;
						if (cnt!=0) {	 
							obj.operator = "and";
						}
						operators.push(obj);
					}
				}
				
			} else { // Parse the logicalSourceString
				operators = JSON.parse(logicalSourceString);
			}
			
			for (var i=0; i<operators.length; i++) {
				if (operators[i].children && operators[i].children.length) {
					var level1 = operators[i].children;
					var level1GroupId = "filter_groupId_"+i;
					var $htmlL1 = '<li class="field-group-li">'+
							'<ul id="'+level1GroupId+'" class="field-group-ul">'+
							'</ul>'+
						'</li>';
						
					if (level1[0].id !=null) {
						$(currentFilters[level1[0].id]).before($htmlL1);
					} else if (level1[0].children && level1[0].children.length && level1[0].children[0].id != null) { 
						$(currentFilters[level1[0].children[0].id]).before($htmlL1);
					}
					
					if (operators[i].operator) {
						var operatorGroupId = "operator_id_g0"+i;
						$("#"+level1GroupId).parent().before("<li id='"+operatorGroupId+"' class='logical-operators-li'>"+self.logicalOperatorsControl+"</li>");
						$("#"+operatorGroupId).find('.logical-operators').first().val(operators[i].operator);
					}

					for (var j=0; j<level1.length; j++) {
						if (level1[j].children && level1[j].children.length) {
							var level2 = level1[j].children;
							var level2GroupId = "filter_groupId_"+i+j;
							var $htmlL2 = '<li class="field-group-li">'+
											'<ul id="'+level2GroupId+'" class="field-group-ul">'+
											'</ul>'+
										 '</li>';
							$("#"+level1GroupId).append($htmlL2);
							if (level1[j].operator) {
								var operatorl1GroupId = "operator_id_l1"+i+j;
								$("#"+level2GroupId).parent().before("<li id='"+operatorl1GroupId+"' class='logical-operators-li'>"+self.logicalOperatorsControl+"</li>");
								$("#"+operatorl1GroupId).find('.logical-operators').first().val(level1[j].operator);
							}
							
							for (var k = 0; k< level2.length; k++) {
								$("#"+level2GroupId).append($(currentFilters[level2[k].id]));
								if (level2[k].operator) {
									var operatorL2Id = "operator_id_l2"+i+j+k;
									$(currentFilters[level2[k].id]).before("<li id='"+operatorL2Id+"' class='logical-operators-li'>"+self.logicalOperatorsControl+"</li>");
									$("#"+operatorL2Id).find('.logical-operators').first().val(level2[k].operator);
								}
							}
						} else {
							$("#"+level1GroupId).append($(currentFilters[level1[j].id]));
							if (level1[j].operator) {
								var operatorl1Id = "operator_id_l1"+i+j;
								$(currentFilters[level1[j].id]).before("<li id='"+operatorl1Id+"' class='logical-operators-li'>"+self.logicalOperatorsControl+"</li>");
								$("#"+operatorl1Id).find('.logical-operators').first().val(level1[j].operator);
							}
						}
					}
				} else {
					if (operators[i].operator) {
						var operatorId = "operator_id_l0"+i;
						$(currentFilters[operators[i].id]).before("<li id='"+operatorId+"' class='logical-operators-li'>"+self.logicalOperatorsControl+"</li>");
						$("#"+operatorId).find('.logical-operators').first().val(operators[i].operator);
					}
				}
			}
			
		}
    }
	
	
	
});
