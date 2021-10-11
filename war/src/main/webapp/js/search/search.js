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
    './searchTpl.hbs',
    'tpl!util/alert',
    'util/withDataRequest',
    'util/formatters',
    'util/popovers/withElementScrollingPositionUpdates',
    'configuration/plugins/registry',
    'd3',
    './extensionToolbarPopover',
    'util/component/attacher',
    'util/requirejs/promise!util/service/propertiesPromise',
    './querybuilder/querybuilder'
], function(
    require,
    defineComponent,
    template,
    alertTemplate,
    withDataRequest,
    F,
    withElementScrollingPositionUpdates,
    registry,
    d3,
    SearchToolbarExtensionPopover,
    Attacher,
    config,
    QueryBuilder) {
    'use strict';

    var DEFAULT_SEARCH_TYPE = 'Default';
    var SEARCH_TYPES = [DEFAULT_SEARCH_TYPE];

    /**
     * Search toolbar items display below the search query input field.
     *
     * They have access to the current search query (if available),
     * and can react to click events with content in a popover, or a custom event.
     * @param {string} tooltip What to display in `title` attribute
     * @param {string} icon URL path to icon to display. Use monochromatic icon with black as color. Opacity is adjusted automatically, and modified on hover.
     * @param {object} action Action to take place on click events. Must include `type` key set to one of:
     * @param {string} action.type Type of action event to occur: `popover` or `event`
     * @param {string} [action.componentPath] Required when `type='popover'`
     * Path to {@link org.bigconnect.search.toolbar~Component}
     * @param {string} [action.name] Required when `type='event'`, name of
     * event to fire
     *
     *     // action: { type: 'event', name: 'MyCustomEventName' }
     *     $(document).on('myCustomEventName', function(event, data) {
     *         // data.extension
     *         // data.currentSearch
     *     })
     * @param {org.bigconnect.search.toolbar~canHandle} [canHandle] Set a function to determine if the toolbar icon should be displayed.
     * @param {org.bigconnect.search.toolbar~onElementCreated} [onElementCreated] Will be called after icon ImageElement is created.
     * @param {org.bigconnect.search.toolbar~onClick} [onClick] Function will be called during click event, before the `action` behavior
     */
    registry.documentExtensionPoint('org.bigconnect.search.toolbar',
        'Add toolbar icons under search query box',
        function(e) {
            return (!e.canHandle || _.isFunction(e.canHandle)) &&
                (!e.onElementCreated || _.isFunction(e.onElementCreated)) &&
                (!e.onClick || _.isFunction(e.onClick)) &&
                _.isString(e.tooltip) &&
                _.isString(e.icon) &&
                e.action && (
                    (e.action.type === 'popover' && e.action.componentPath) ||
                    (e.action.type === 'event' && e.action.name)
                )
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/search-toolbar')

    /**
     * Alternate search interfaces to replace the content in the search pane.
     *
     * Each of the search interfaces has its own saved searches.
     *
     * @param {string} componentPath Path to {@link org.bigconnect.search.advanced~Component}
     * @param {string} displayName The text to display in search dropdown (to
     * select the type of search interface)
     * @param {string} savedSearchUrl The endpoint to execute when search is changed
     * @param {string} descriptionComponentPath Path to a component that will be used as a welcome screen
     * for the search interface
     */
    registry.documentExtensionPoint('org.bigconnect.search.advanced',
        'Add alternate search interfaces',
        function(e) {
            return (e.componentPath && e.displayName && e.savedSearchUrl);
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/search-type'
    );

    /**
     * @undocumented
     */
    registry.documentExtensionPoint('org.bigconnect.search.filter',
        'Add new types of search filters',
        function(e) {
            return ('searchType' in e) &&
                ('componentPath' in e);
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/search-type'
    );

    var SavedSearchPopover;

    const enableCypherSearch = config['enable.cypher.search'] || "true";

    enableCypherSearch === 'true' && registry.registerExtension('org.bigconnect.search.advanced', {
        displayName: i18n('search.advanced.cypher'),
        componentPath: 'search/advanced/Cypher',
        savedSearchUrl: '/search/advanced/cypher',
        descriptionComponentPath: 'search/advanced/cypherTutorial'
    });

    return defineComponent(Search, withDataRequest, withElementScrollingPositionUpdates);

    function Search() {
        this.savedQueries = _.indexBy(SEARCH_TYPES.map(function(type) {
            return {
                type: type,
                query: '',
                filters: [],
                status: {}
            }
        }), 'type');

        this.defaultAttrs({
            formSelector: '.search-bar',
            querySelector: '.search-bar .search-input',
            queryValidationSelector: '.search-query-validation',
            queryExtensionsSelector: '.below-query .extensions',
            queryExtensionsButtonSelector: '.below-query .extensions > button',
            advancedSearchContainerSelector: '.advanced-search-container',
            advancedSearchDropdownSelector: '.search-dropdowns .advanced',
            advancedSearchTypeSelector: '.search-types a',
            savedSearchSelector: '.search-dropdowns .saved',
            queryContainerSelector: '.search-query-container',
            clearSearchSelector: '.search-query-container .clear-search',
            segmentedControlSelector: '.segmented-control',
            filtersInfoSelector: '.filter-info',
            searchTypeSelector: '.search-type',
            exportXlsSelector: '.search-export .searchExportXlsIcon',
            exportWordSelector: '.search-export .searchExportWordIcon',
            exportXmlSelector: '.search-export .searchExportXmlIcon',
            exportPdfSelector: '.search-export .searchExportPdfIcon',
            exportRawSelector: '.search-export .searchExportRawIcon',
            refreshSelector: '.refresh',
            queryBuilderSelector: '.query-builder',
            queryBuilderContainer: '.qb-container',
            searchButtonSelector: '.qb-search-button',
            returnDivSelector: '.qb-return-div',
        });


        this.after('initialize', function() {
            this.render();

            this.currentSearchByUrl = {};
            this.currentSearchUrl = '';
            this.appliedRefinements = new Array();
            this.logicalSourceString = null;

            this.triggerQueryUpdatedThrottled = _.throttle(this.triggerQueryUpdated.bind(this), 100);
            this.triggerQueryUpdated = _.debounce(this.triggerQueryUpdated.bind(this), 500);

            $(this.attr.exportXlsSelector).off('click');
            $(this.attr.exportWordSelector).off('click');
            $(this.attr.exportXmlSelector).off('click');
            $(this.attr.exportPdfSelector).off('click');
            $(this.attr.exportRawSelector).off('click');

            this.on('click', {
                segmentedControlSelector: this.onSegmentedControlsClick,
                clearSearchSelector: this.onClearSearchClick,
                advancedSearchTypeSelector: this.onAdvancedSearchTypeClick,
                savedSearchSelector: this.onSavedSearch,
                queryExtensionsButtonSelector: this.onExtensionToolbarClick,
                exportXlsSelector: this.onExport,
                exportWordSelector: this.onExport,
                exportXmlSelector: this.onExport,
                exportPdfSelector: this.onExport,
                exportRawSelector: this.onExport,
                refreshSelector: this.onRefresh
            });
            this.on(this.select('advancedSearchDropdownSelector'), 'click', this.onAdvancedSearchDropdown);
            this.on('change keydown keyup paste', {
                querySelector: this.onQueryChange
            });
            this.on(this.select('querySelector'), 'focus', this.onQueryFocus);

            this.on('savedQuerySelected', this.onSavedQuerySelected);
            this.on('setCurrentSearchForSaving', this.onSetCurrentSearchForSaving);
            this.on('filterschange', this.onFiltersChange);
            this.on('refinementAdded', this.onRefinementAdded);
            this.on('refinementRemoved', this.onRefinementRemoved);
            this.on('logicalSourceStringSet', this.onLogicalSourceStringSet);
            this.on('clearSearch', this.onClearSearch);
            this.on('searchRequestBegan', this.onSearchResultsBegan);
            this.on('searchRequestCompleted', this.onSearchResultsCompleted);
            this.on('searchtypeloaded', this.onSearchTypeLoaded);
            this.on(document, 'searchByParameters', this.onSearchByParameters);
            this.on(document, 'searchForPhrase', this.onSearchForPhrase);
            this.on(document, 'searchByRelatedEntity', this.onSearchByRelatedEntity);
            this.on(document, 'searchBySimilarEntity', this.onSearchBySimilarEntity);
            this.on(document, 'searchByProperty', this.onSearchByProperty);
            this.on(document, 'searchPaneVisible', this.onSearchPaneVisible);
            this.on(document, 'switchSearchType', this.onSwitchSearchType);
            this.on(document, 'didToggleDisplay', this.onDidToggleDisplay);

            // QueryBuilder.attachTo(this.select('queryBuilderSelector'));
        });

        /**
         * Fired when user selects a saved search.
         * {@link org.bigconnect.search.advanced~Component|AdvancedSearch}
         * components should listen and load the search
         *
         * @event org.bigconnect.search.advanced#savedQuerySelected
         * @property {object} data
         * @property {object} data.query
         * @property {string} data.query.url The search endpoint
         * @property {object} data.query.parameters The search endpoint parameters
         */
        this.onSavedQuerySelected = function(event, data) {
            if ($(event.target).is(this.currentSearchNode)) return;

            if (this.advancedActive) {
                const params = this.advancedSearchExtension.params();
                this.advancedSearchExtension.params({
                    ...params,
                    initialParameters: data.query.parameters
                }).attach();
            } else {
                this.trigger(
                    'searchByParameters',
                    {
                        ...data.query,
                        submit: true
                    }
                );
            }
        };

        this.onExport = function(event) {
            if ($(event.target).hasClass('searchExportRawIcon')) {
                this.forExport = true;
                this.triggerQuerySubmit();
                return;
            }

            let exportType = 'xls';
            if ($(event.target).hasClass('searchExportWordIcon')) {
                exportType = 'word';
            } else if ($(event.target).hasClass('searchExportXmlIcon')) {
                exportType = 'xml';
            } else if ($(event.target).hasClass('searchExportPdfIcon')) {
                exportType = 'pdf';
            }

            let search;
            if (this.advancedActive) {
                search = this.currentSearchByUrl['/search/advanced/cypher'];
            } else {
                search = this.currentSearchByUrl['/vertex/search'];
            }

            if (search) {
                const csrfToken = bcData.currentUser.csrfToken;
                const workspaceId = bcData.currentWorkspaceId;
                this.exportFile('search/export', exportType, search.url, search.parameters, csrfToken, workspaceId);
            }
        };

        this.exportFile = function(serviceUrl, exportType, searchUrl, searchParameters, csrfToken, workspaceId) {
            const form = $('<form></form>').attr('action', serviceUrl).attr('method', 'post').attr('target', '_blank');
            form.append($('<input></input>').attr('type', 'hidden').attr('name', 'type').attr('value', exportType));
            form.append($('<input></input>').attr('type', 'hidden').attr('name', 'url').attr('value', searchUrl));
            form.append($('<input></input>').attr('type', 'hidden').attr('name', 'parameters').attr('value', JSON.stringify(searchParameters)));
            form.append($('<input></input>').attr('type', 'hidden').attr('name', 'csrfToken').attr('value', csrfToken));
            form.append($('<input></input>').attr('type', 'hidden').attr('name', 'workspaceId').attr('value', workspaceId));
            form.appendTo('body').submit().remove();
        };

        this.onRefresh = function(event) {
            if (this.select('querySelector').val().length) {
                $('.panel-filters').show();
                this.triggerQuerySubmit();
                $(event.target).select();
            }
        };

        this.onSearchByParameters = function(event, data) {
            var self = this;

            if ($(event.target).is(this.currentSearchNode)) return;

            this.currentSearchQuery = data;
            this.currentSearchByUrl[data.url] = data;

            var advancedSearch = data.url &&
                _.findWhere(registry.extensionsForPoint('org.bigconnect.search.advanced'), { savedSearchUrl: data.url })

            if (!data.url) data.url = '/vertex/search';
            if (!data.parameters) data.parameters = {};
            if (!data.parameters.filter) data.parameters.filter = '[]';

            this.openSearchType(advancedSearch ?
                { ...advancedSearch, advancedSearch: advancedSearch.componentPath } :
                DEFAULT_SEARCH_TYPE
            ).then(function() {
                    var node = self.getSearchTypeNode().find('.search-filters > .content');
                    if ('q' in data.parameters) {
                        self.select('querySelector').filter(':visible')
                            .val(data.parameters.q)
                            .select()
                        self.updateClearSearch();
                    }
                    node.trigger(event.type, data);
                });
        };

        /**
         * @event org.bigconnect.search.advanced#setCurrentSearchForSaving
         * @property {object} data
         * @property {string} data.url The endpoint url (should match extension
         * @property {object} data.parameters The parameters to send to endpoint
         */
        this.onSetCurrentSearchForSaving = function(event, data) {
            if (event.target && $(event.target).is(this.attr.savedSearchSelector)) return;

            if (data && data.url) {
                var bcFilter = /^\/(?:vertex|element|edge)\/search$/;
                this.currentSearchByUrl[data.url] = data;
                if (bcFilter.test(data.url)) {
                    this.currentSearchByUrl['/vertex/search'] = data;
                }
                this.currentSearch = data;
            } else {
                this.currentSearchByUrl = {};
                this.currentSearch = null;
            }
            this.select('savedSearchSelector').trigger('setCurrentSearchForSaving', this.currentSearchByUrl[this.currentSearchUrl]);
            this.updateQueryToolbarExtensions();
        };

        this.updateQueryToolbarExtensions = function() {
            var self = this,
                extensions = registry.extensionsForPoint('org.bigconnect.search.toolbar');
            if (!this.toolbarExtensionsById) {
                var inc = 0,
                    mapped = extensions.map(function(e) {
                        e.identifier = inc++;
                        return e;
                    });
                this.toolbarExtensionsById = _.indexBy(mapped, 'identifier')
            }

            var $container = this.select('queryExtensionsSelector'),
                items = _.filter(extensions, function(e) {
                    /**
                     * @callback org.bigconnect.search.toolbar~canHandle
                     * @param {object} [currentSearch] Could be null if
                     * current search is invalid
                     * @param {object} currentSearch.url
                     * @param {object} currentSearch.parameters
                     * @returns {boolean} If the item can handle the search
                     */
                    return !_.isFunction(e.canHandle) || e.canHandle(self.currentSearch);
                });

            d3.select($container.get(0))
                .selectAll('button')
                .data(items)
                .call(function() {
                    this.enter().append('button')
                        .each(function(e) {
                            if (_.isFunction(e.onElementCreated)) {
                                /**
                                 * @callback org.bigconnect.search.toolbar~onElementCreated
                                 * @param {Element} element The dom element that the
                                 * toolbar item is in
                                 */
                                e.onElementCreated(this)
                            }
                        })
                        .attr('title', _.property('tooltip'))
                        .style('background-image', function(e) {
                            return 'url(' + e.icon + ')'
                        })
                    this.order()
                    this.exit().remove();
                })
        };

        this.onExtensionToolbarClick = function(event) {
            var self = this,
                $toolbarButton = $(event.target),
                extension = d3.select(event.target).datum();

            event.preventDefault();
            if (extension) {
                if (_.isFunction(extension.onClick)) {
                    /**
                     * @callback org.bigconnect.search.toolbar~onClick
                     * @param {Event} event The click event
                     * @returns {boolean} If false the `action` defined in the
                     * extension won't execute.
                     */
                    if (extension.onClick(event) === false) {
                        event.stopPropagation();
                        return;
                    }
                }
                switch (extension.action && extension.action.type || '') {
                  case 'popover':
                    if ($toolbarButton.lookupComponent(SearchToolbarExtensionPopover)) {
                        _.defer(function() {
                            $toolbarButton.teardownAllComponents();
                        });
                        return;
                    }
                    Promise.require(extension.action.componentPath)
                        .then(function(Component) {
                            SearchToolbarExtensionPopover.attachTo($toolbarButton, {
                                Component: Component,
                                model: {
                                    search: self.currentSearch
                                },
                                extension: extension
                            })
                        });
                    break;

                  case 'event':
                    $toolbarButton.trigger(extension.action.name, {
                        extension: extension,
                        currentSearch: this.currentSearch
                    });
                    break;

                  default:
                      throw new Error('Unknown action for toolbar item extension: ' + JSON.stringify(extension));
                }
            }
        };

        this.onDidToggleDisplay = function(event, data) {
            if (data.name === 'search') {
                if (data.visible) {
                    $('.qs-form').hide();
                    this.trigger('searchPaneVisible');
                } else {
                    this.$node.find('.advanced-search-type-results').hide();
                    $('.qs-form').show();
                }
            }
        };

        this.onSearchTypeLoaded = function() {
            this.trigger('paneResized');
            this.updateQueryToolbarExtensions();
        };

        this.openSearchType = function(searchType) {
            var self = this,
                d = $.Deferred();

            new Promise(function(fulfill, reject) {
                if (self.$node.closest('.visible').length === 0) {
                    self.searchType = null;
                    self.on(document, 'searchPaneVisible', function handler(data) {
                        self.off(document, 'searchPaneVisible', handler);
                        fulfill();
                    })
                    self.trigger(document, 'menubarToggleDisplay', { name: 'search' });
                } else fulfill();
            }).done(function() {
                if (self.searchType === searchType) {
                    d.resolve();
                } else {
                    self.on('searchtypeloaded', function loadedHandler() {
                        self.off('searchtypeloaded', loadedHandler);
                        d.resolve();
                    });
                }
                self.switchSearchType(searchType);
            });

            return d;
        };

        this.onSearchForPhrase = function(event, data) {
            this.trigger('searchByParameters', {
                submit: true,
                parameters: {
                    q: '"' + data.query.replace(/"/g, '\\"') + '"'
                }
            });
        };

        this.onSearchByProperty = function(event, data) {
            var self = this;

            this.openSearchType(DEFAULT_SEARCH_TYPE)
                .done(function() {
                    var node = self.getSearchTypeNode().find('.search-filters .content');
                    self.select('querySelector').val('');
                    self.trigger(node, 'searchByProperty', data);
                })
        };

        this.onSearchByRelatedEntity = function(event, data) {
            var self = this;

            this.openSearchType(DEFAULT_SEARCH_TYPE)
                .done(function() {
                    var node = self.getSearchTypeNode().find('.search-filters .content');
                    self.select('querySelector').val('');
                    self.trigger(node, 'searchByRelatedEntity', data);
                });
        };

        this.onSearchBySimilarEntity = function(event, data) {
            var self = this;

            this.openSearchType(DEFAULT_SEARCH_TYPE)
                .done(function() {
                    var node = self.getSearchTypeNode().find('.search-filters .content');
                    self.select('querySelector').val('');
                    self.trigger(node, 'searchBySimilarEntity', data);
                });
        };

        this.onSearchPaneVisible = function(event, data) {
            var self = this;

            _.delay(function() {
                self.select('querySelector').focus();
            }, 250);
        };

        this.onSearchResultsBegan = function() {
            this.select('queryContainerSelector').addClass('loading');
        };

        this.onSearchResultsCompleted = function(event, data) {
            this.select('queryContainerSelector').removeClass('loading');
            this.updateQueryStatus(data);
        };

        /**
         * Display the status of a submitted query. If no argument is given it will clear the current status.
         *
         * @callback org.bigconnect.search.advanced~updateQueryStatus
         * @param {object} [status]
         * @param {boolean} [status.success]
         * @param {string} [status.error] Custom error message to display
         * @param {string} [status.message] Message to display on success (e.g. number of hits)
         */
        this.updateQueryStatus = function(status) {
            const searchType = this.getSearchTypeOrId();
            const $error = this.select('queryValidationSelector');

            if (!status || status.success) {
                $error.empty();
            } else {
                $error.html(
                    alertTemplate({ error: _.isString(status.error) ? status.error : i18n('search.query.error') })
                )
            }

            this.savedQueries[searchType].status = status || {};
            this.updateTypeCss();
        };

        this.onRefinementAdded = function(event, data) {
            const hadRefinements = _.size(this.appliedRefinements);
            this.appliedRefinements.push(data);
            this.onFiltersChange(event, this.filters, hadRefinements);
        };

		this.onLogicalSourceStringSet = function (event, data) {
			this.logicalSourceString = data.logicalSourceString;
		}

        this.onRefinementRemoved = function(event, data) {
            const hadRefinements = _.size(this.appliedRefinements);
            const toRemoveId = data.field + '=' + data.bucketKey;
            this.appliedRefinements = _.filter(this.appliedRefinements, function(e) {
                const elemId = e.field + '=' + e.bucketKey
                return elemId != toRemoveId;
            });
            this.onFiltersChange(event, this.filters, hadRefinements);
        };

        this.onFiltersChange = function(event, data, hadRefinements) {
            var self = this,
                hadRefinements = hadRefinements || false,
                hadFilters = this.hasFilters() || hadRefinements;

            this.filters = data;

            var query = this.getQueryVal(),
                options = (data && data.options) || {},
                hasFilters = this.hasFilters() || this.hasRefinements();

            this.dataRequest('config', 'properties')
                .done(function(properties) {
                    if (!query && hasFilters && data.setAsteriskSearchOnEmpty) {
                        self.select('querySelector').val('*');
                        query = self.getQueryVal();
                    }

                    const hasQuery = query && query.length;
                    const validSearch = hasQuery && (hasFilters || hadFilters || options.matchChanged);

                    if (options.isScrubbing) {
                        self.triggerQueryUpdatedThrottled();
                    } else {
                        self.triggerQueryUpdated();
                    }
                    if (validSearch || options.submit) {
                        self.triggerQuerySubmit();
                    }

                    self.updateClearSearch();
                    $('.panel-filters').show();
                });
        };

        this.onQueryChange = function(event) {
            if (event.which === $.ui.keyCode.ENTER) {
                if (event.type === 'keyup') {
                    if (this.select('querySelector').val().length) {
                        this.triggerQuerySubmit();
                        $(event.target).select()
                    }
                }
            } else if (event.which === $.ui.keyCode.ESCAPE) {
                if (event.type === 'keyup') {
                    if (this.canClearSearch) {
                        this.onClearSearchClick();
                    } else {
                        this.select('querySelector').blur();
                    }
                }
            } else if (event.type === 'keyup') {
                this.updateClearSearch();
                this.triggerQueryUpdated();
            }

            $('.panel-filters').show();
        };

        this.onClearSearchClick = function(event) {
            var node = this.getSearchTypeNode(),
                $query = this.select('querySelector'),
                $clear = this.select('clearSearchSelector');

            $clear.hide();
            _.defer($query.focus.bind($query));
            this.trigger(node, 'clearSearch', { clearMatch: false })

            $('.extension-filter-row').find('input').val('');

            //Clear logical operators & groups
            this.$node.find('.filters-container .logical-operators-li').remove();
            $('.field-group-li').each(function() {$(this).remove();});
        };

        this.onAdvancedSearchTypeClick = function(event) {
            var $target = $(event.target),
                path = $target.data('componentPath'),
                savedSearchUrl = $target.data('savedSearchUrl'),
                descriptionPath = $target.data('descriptionPath');

            this.switchSearchType({
                advancedSearch: path,
                displayName: $target.text(),
                savedSearchUrl: savedSearchUrl,
                descriptionPath
            });
        };

        this.onAdvancedSearchDropdown = function() {
            this.select('savedSearchSelector').teardownAllComponents();
        };

        this.onSavedSearch = function(event) {
            var self = this,
                $button = $(event.target).closest('a'),
                $advancedButton = this.$node.find('.search-dropdowns .advanced');

            event.stopPropagation();

            if ($advancedButton.next('.dropdown-menu').is(':visible')) {
                $advancedButton.dropdown('toggle');
            }

            var opened = SavedSearchPopover && !!$button.lookupComponent(SavedSearchPopover);
            if (opened) {
                $button.siblings('a').andSelf().teardownAllComponents();
            } else {
                $button.addClass('loading');
                require(['./save/popover'], function(Save) {
                    SavedSearchPopover = Save;
                    $button.removeClass('loading')
                    self.dataRequest('search', 'all', self.currentSearchUrl).done(function(searches) {
                        if (self.currentSearchQuery) {
                            self.currentSearchQuery = _.findWhere(searches, { id: self.currentSearchQuery.id });
                        }
                        Save.attachTo($button, {
                            list: searches,
                            update: self.currentSearchQuery,
                            query: self.currentSearchByUrl[self.currentSearchUrl]
                        });
                    })
                });
            }
        };

        this.onClearSearch = function(event) {
            var node = this.getSearchTypeNode(),
                $query = this.select('querySelector'),
                $clear = this.select('clearSearchSelector');

            this.currentSearchQuery = null;

            if (node.is(event.target)) {
                this.select('queryContainerSelector').removeClass('loading');
                if (this.getQueryVal()) {
                    this.setQueryVal('');
                }
                this.filters = null;
                this.updateQueryStatus();
                this.triggerQueryUpdated();
            }
        };

        this.onSegmentedControlsClick = function(event, data) {
            event.stopPropagation();

            this.switchSearchType(
                $(event.target).blur().data('type')
            );
            this.select('querySelector').focus();
        };

        this.onQueryFocus = function(event) {
            this.switchSearchType(this.searchType || SEARCH_TYPES[0]);
        };

        this.onSwitchSearchType = function(event, data) {
            if (data !== DEFAULT_SEARCH_TYPE && !_.isObject(data) && !data.advancedSearch) {
                throw new Error('Only BC type supported');
            }
            this.switchSearchType(data);
        };

        this.switchSearchType = function(newSearchType) {
            var self = this,
                advanced = !_.isString(newSearchType);

            if (newSearchType.advancedSearch) {
                $('.search-export').hide();
            } else {
                $('.search-export').show();
            }

            this.trigger('switchSearchTriggered', {});

            if (advanced) {
                this.select('queryBuilderSelector').show();
                this.select('queryBuilderContainer').hide();
                this.select('searchButtonSelector').hide();
                this.select('returnDivSelector').hide();

                var path = newSearchType.advancedSearch,
                    descriptionPath = newSearchType.descriptionPath,
                    previousSearchType = this.searchType;

                if (!path) {
                    this.searchType = null;
                    this.switchSearchType(previousSearchType);
                    return;
                }

                this.advancedActive = true;
                this.updateAdvancedSearchDropdown(newSearchType);

                var cls = F.className.to(path),
                    $container = this.$node.find('.advanced-search-type.' + cls),
                    attach = false,
                    $parent = this.select('advancedSearchContainerSelector');

                if (!$container.length) {
                    attach = true;
                    $container = $('<div>')
                        .addClass('advanced-search-type ' + cls)
                        .appendTo($parent);

                    $('<div>')
                        .addClass('advanced-search-type-desc ' + cls)
                        .data('width-preference', path)
                        .appendTo(this.node);

                    $('<div>')
                        .addClass('advanced-search-type-results ' + cls)
                        .data('width-preference', path)
                        .html('<div class="adv-content">')
                        .appendTo(this.node);
                }

                this.$node.find('.search-type.active').removeClass('active');
                this.$node.find('.search-query-container').hide();
                $parent.show();
                $container.show();
                var $descriptionContainer = this.$node.find('.advanced-search-type-desc').show();

                const searchTypePromise = [];
                if (attach) {
                    Attacher()
                        .path(descriptionPath)
                        .node($descriptionContainer)
                        .attach();

                    const resultsSelector = '.advanced-search-type-results.' + cls;
                    const $resultsContainer = $(resultsSelector);

                    /**
                     * Responsible for displaying the interface for
                     * searching, and displaying the results.
                     *
                     * @typedef org.bigconnect.search.advanced~Component
                     * @property {string} resultsSelector <span class="important">Deprecated:</span>
                     * Use `renderResults` function instead.
                     * Css selector of the container that will hold results
                     * @property {object} [initialParameters] The search endpoint parameters
                     * @property {function} renderResults takes a callback which is given the DOM node of the results container
                     * @property {org.bigconnect.search.advanced~updateQueryStatus} updateQueryStatus Display error/success message
                     * @see module:components/List
                     * @listens org.bigconnect.search.advanced#savedQuerySelected
                     * @fires org.bigconnect.search.advanced#setCurrentSearchForSaving
                     * @example <caption>Rendering results</caption>
                     * this.props.renderResults((resultsNode) => {
                     *     List.attachTo($(resultsNode), {
                     *          items: results
                     * })
                     */
                    self.advancedSearchExtension = Attacher()
                        .path(path)
                        .node($container)
                        .params({ resultsSelector })
                        .behavior({
                            setCurrentSearchForSaving: self.onSetCurrentSearchForSaving.bind(self),
                            updateQueryStatus: function(attacher, status) { self.updateQueryStatus(status) },
                            renderResults: function(attacher, renderFn) {
                                renderFn($resultsContainer[0]);
                            }
                        });


                    searchTypePromise.push(self.advancedSearchExtension.attach())
                }

                Promise.resolve(searchTypePromise)
                    .then(() => {
                        self.trigger($container, 'searchtypeloaded', { type: newSearchType });

                        self.currentSearch = null;
                        self.currentSearchUrl = newSearchType.savedSearchUrl
                        self.currentSearchNode = $container;

                        self.$node.find('.advanced-search-type, .advanced-search-type-results').show();
                        self.$node.find('.advanced-search-type-desc').hide();

                        $container.show().addClass('active');
                        $container.siblings('.advanced-search-type').removeClass('active');

                        if (!self.savedQueries[cls]) {
                            self.savedQueries[cls] = {};
                        }
                        self.updateQueryStatus(self.savedQueries[cls].status);

                        if (self.savedQueries[cls].status.success) {
                            $container.siblings('.advanced-search-type-results.' + cls).show();
                        }
                    });

                return;
            }

            this.$node.find('.advanced-search-type, .advanced-search-type-results, .advanced-search-type-desc').hide();
            this.$node.find('.search-query-container').show();
            this.select('advancedSearchContainerSelector').hide();
            this.select('queryBuilderSelector').hide();

            if (!this.advancedActive && (!newSearchType || this.searchType === newSearchType)) {
                return;
            }

            this.advancedActive = false;

            this.updateQueryValue(newSearchType);

            this.updateAdvancedSearchDropdown(newSearchType);

            var segmentedButton = this.$node.find('.find-' + newSearchType.toLowerCase())
                    .addClass('active')
                    .siblings('button').removeClass('active').end(),
                node = this.getSearchTypeNode()
                    .addClass('active')
                    .siblings('.search-type').removeClass('active').end();

            require(['./types/type' + newSearchType], function(SearchType) {
                self.currentSearchUrl = SearchType.savedSearchUrl;
                var alreadyAttached = node.lookupComponent(SearchType);
                if (alreadyAttached) {
                    self.trigger(node, 'searchtypeloaded', { type: newSearchType });
                } else {
                    SearchType.attachTo(node);
                }
                self.currentSearchNode = node;
                self.updateTypeCss();
            });
        };

        this.updateAdvancedSearchDropdown = function(newSearchType) {
            var dropdownCaret = this.$node.find('.search-dropdowns .advanced .caret')[0];

            if (dropdownCaret) {
                dropdownCaret.previousSibling.textContent = (
                    _.isObject(newSearchType) && newSearchType.displayName ?
                        newSearchType.displayName :
                        i18n('search.advanced.default')
                ) + ' ';
            }
            this.$node.find('.search-dropdowns').toggle(_.isObject(newSearchType) || newSearchType === DEFAULT_SEARCH_TYPE);
        }

        this.updateTypeCss = function() {
            this.$node.find('.search-type .search-filters').css(
                'top',
                this.select('formSelector').outerHeight(true)
            );
        };

        this.updateClearSearch = function() {
            this.canClearSearch = this.getQueryVal().length > 0 || this.hasFilters();
            this.select('clearSearchSelector').toggle(this.canClearSearch);
        };

        this.hasFilters = function() {
            return !!(this.filters && this.filters.hasSome);
        };

        this.hasRefinements = function() {
            return !!(this.appliedRefinements && _.size(this.appliedRefinements) > 0);
        }

        this.updateQueryValue = function(newSearchType) {
            const $query = this.select('querySelector');
            const searchType = this.getSearchTypeOrId();

            if (this.searchType) {
                this.savedQueries[this.searchType].query = $query.val();
                this.savedQueries[this.searchType].status.message = $hits.text().trim();
            }
            this.searchType = newSearchType;

            if (!this.savedQueries[searchType]) {
                this.savedQueries[searchType] = { query: '', status: {}};
            }

            $query.val(this.savedQueries[searchType].query);

            this.updateClearSearch();
        };

        this.triggerOnType = function(eventName) {
            var searchType = this.getSearchTypeNode();
            this.trigger(searchType, eventName, {
                value: this.getQueryVal(),
                filters: this.filters || {},
                refinements: this.appliedRefinements || {},
				logicalSourceString: this.logicalSourceString || {},
                forExport: this.forExport || false
            });
            this.forExport = false;
        };

        this.triggerQuerySubmit = _.partial(this.triggerOnType, 'querysubmit');

        this.triggerQueryUpdated = _.partial(this.triggerOnType, 'queryupdated');

        this.getQueryVal = function() {
            return $.trim(this.select('querySelector').val());
        };

        this.setQueryVal = function(val) {
            return this.select('querySelector').val(val).change();
        };

        this.getSearchTypeNode = function() {
            return this.$node.find('.search-type-default');
        };

        this.getSearchTypeOrId = function() {
            if (this.advancedActive) {
                const classList = this.$node.find('.advanced-search-type.active').attr('class');
                return classList.match(/id[0-9]+/)[0];
            } else {
                return DEFAULT_SEARCH_TYPE;
            }
        }

        this.render = function() {
            var self = this,
                advancedSearch = registry.extensionsForPoint('org.bigconnect.search.advanced');

            this.$node.html(template({
                advancedSearch: advancedSearch
            }));
        };
    }
});
