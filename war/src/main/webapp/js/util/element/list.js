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
 * The list could be a static list or a infinite loading list of elements. The
 * container component is responsible for listening for events to request more
 * elements and fulfilling that request.
 *
 * @module components/List
 * @flight Render lists of entities and relationships (vertices/edges)
 * @attr {Array.<Object>} items Elements (vertices/edges) to render
 * @attr {boolean} singleSelection Whether the user can use keyboard shift/alt to select multiple
 * @attr {boolean} infiniteScrolling Whether the component should request more elements after scrolling
 * @attr {number} total The total count of items. Required when `infiniteScrolling` enabled.
 * @attr {number} nextOffset When `infiniteScrolling` is enabled, specifies where the next request should start
 * @attr {string|undefined} usageContext Describes the context this component is used so ListItemRenderers can determine if they should override behavior.
 * @see org.bigconnect.entity.listItemRenderer
 * @fires module:components/List#infiniteScrollRequest
 * @listens module:components/List#addInfiniteItems
 * @example <caption>Static list</caption>
 * List.attachTo(node, {
 *     items: [vertices]
 * })
 * @example <caption>Infinite Scroll</caption>
 * // See example below for listening for infiniteScrollRequest
 * List.attachTo(node, {
 *     items: [page1Elements]
 *     nextOffset: 10,
 *     total: 100
 * })
 */
define([
    'flight/lib/component',
    'configuration/plugins/registry',
    './list.hbs',
    './detail-relationship-item',
    './vertex-item',
    './edge-item',
    'tpl!util/alert',
    'util/vertex/formatters',
    'util/withDataRequest',
    'util/dnd',
    'util/popovers/withElementScrollingPositionUpdates',
    'util/jquery.withinScrollable'
], function(
    defineComponent,
    registry,
    template,
    DetailRelationshipItem,
    VertexItem,
    EdgeItem,
    alertTemplate,
    F,
    withDataRequest,
    dnd,
    withPositionUpdates) {
    'use strict';

    var MAX_ITEMS_BEFORE_FORCE_LOADING = 10;

    /**
     * This allows plugins to adjust how list items are displayed in search results,
     * details panels, or anywhere else the lists are used.
     *
     * Requires either `component` or `componentPath`.
     *
     * <div class="warning">
     * **The `item` property passed to {@link org.bigconnect.entity.listItemRenderer~Component|Component}
     * can differ depending on `usageContext`.**
     * <p>
     * `usageContext == 'detail/relationships'` => `{ vertex, relationship }`<br>
     * `usageContext == 'searchresults'` => The element
     * </div>
     *
     * @param {org.bigconnect.entity.listItemRenderer~canHandle} canHandle Whether the extension should run given an item and usageContext
     * @param {org.bigconnect.entity.listItemRenderer~Component} [component] The FlightJS component to handle rendering
     * @param {string} [componentPath] Path to {@link org.bigconnect.entity.listItemRenderer~Component}
     */
    registry.documentExtensionPoint('org.bigconnect.entity.listItemRenderer',
        'Implement custom implementations for rendering items into element lists',
        function(e) {
            return _.isFunction(e.canHandle) && (e.component || e.componentPath);
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/element-list-item-renderer'
    );

    return defineComponent(List, withPositionUpdates, withDataRequest);

    function List() {

        this.defaultAttrs({
            itemSelector: 'ul > li.element-item',
            draggableSelector: '.element-item a.draggable',
            infiniteScrolling: false,
            usageContext: 'search',
            openDetails: true
        });


        this.after('initialize', function() {
            var self = this;

            // Do this to support code that arrives here via the
            // deprecated vertex/list and edge/list components
            this.attr.items = this.attr.items || this.attr.edges || this.attr.vertices;

            this.renderers = registry.extensionsForPoint('org.bigconnect.entity.listItemRenderer').concat([
                { canHandle: function(item, usageContext) {
                        return usageContext === 'detail/relationships' &&
                                item && item.relationship &&
                                F.vertex.isEdge(item.relationship);
                    }, component: DetailRelationshipItem },
                { canHandle: function(item) { return F.vertex.isEdge(item); }, component: EdgeItem },
                { canHandle: function(item) { return F.vertex.isVertex(item); }, component: VertexItem }
            ])

            this.on('click', {
                draggableSelector: this.onClick
            });

            var rendererPromises = _.map(this.renderers, function(extension) {
                    if (extension.componentPath && !extension.component) {
                        return Promise.require(extension.componentPath).then(function(component) {
                            extension.component = component;
                        });
                    }
                    return Promise.resolve();
                });

            Promise.all(rendererPromises).done(function(promiseResults) {
                    self.localScrolling = !self.attr.infiniteScrolling && self.attr.items.length > MAX_ITEMS_BEFORE_FORCE_LOADING;
                    self.$node
                        .addClass('element-list')
                        .html(template({
                            scrolling: self.isScrolling()
                        }));

                    self.attachEvents();

                    if (self.localScrolling) {
                        self.offset = 0;
                        self.allItems = self.attr.items;
                        self.addItems(self.allItems.slice(0, MAX_ITEMS_BEFORE_FORCE_LOADING));
                    } else {
                        self.addItems(self.attr.items);
                    }

                    self.loadVisibleResultPreviews();
                    self.loadVisibleResultPreviews = _.debounce(self.loadVisibleResultPreviews.bind(self), 1000);

                    self.triggerInfiniteScrollRequest = _.debounce(self.triggerInfiniteScrollRequest.bind(self), 1000);
                    self.triggerInfiniteScrollRequest();

                    self.$node.droppable({ accept: '*', tolerance: 'pointer' });

                    self.onObjectsSelected(null, bcData.selectedObjects);

                    self.on('selectAll', self.onSelectAll);
                    self.on('downUp', self.move);
                    self.on('upUp', self.move);
                    self.on('contextmenu', self.onContextMenu);
                    self.trigger('renderFinished');

                    _.defer(function() {
                        self.$node.scrollTop(0);
                    })
                    self.trigger('listRendered');
            });
        });

        this.isScrolling = function() {
            return this.localScrolling || (
                    this.attr.infiniteScrolling &&
                    this.attr.total !== this.attr.items.length
                );
        };

        this.onClick = function(event) {
            event.preventDefault();
            event.stopPropagation();
            this.trigger('focusComponent');

            let {vertexIds, edgeIds} = bcData.selectedObjects;
            const $target = $(event.target).parents('li');
            const pushData = (data) => {
                if (data.vertexId) selectVertexIds.push(data.vertexId)
                if (data.edgeId) selectEdgeIds.push(data.edgeId)
            };

            let data = $(event.target).closest('a.draggable').data();
            const isSelected = vertexIds[data.vertexId] || edgeIds[data.edgeId];
            let deselect = false;
            let [selectVertexIds, selectEdgeIds] = [[], []];

            if (!this.attr.singleSelection) {
                const targetIndex = $target.index();

                if (event.shiftKey) {
                    const index = this.lastClickedIndex || 0;
                    const min = Math.min(index, targetIndex);
                    const max = Math.max(index, targetIndex);
                    const $items = $target.parent().children();
                    for (let i = min; i <= max; i++) {
                        pushData($items.eq(i).find('a.draggable').data());
                    }
                } else if (event.metaKey || event.ctrlKey) {
                    if (isSelected) {
                        deselect = true;
                        if (data.vertexId) vertexIds = _.omit(vertexIds, data.vertexId);
                        if (data.edgeId) edgeIds = _.omit(edgeIds, data.edgeId);
                    }

                    selectVertexIds = Object.keys(vertexIds);
                    selectEdgeIds = Object.keys(edgeIds);
                } else {
                    if (data.vertexId && data.vertexId in vertexIds &&
                        Object.keys(vertexIds).length === 1) {
                        data = {};
                    }
                    if (data.edgeId && data.edgeId in edgeIds &&
                        Object.keys(edgeIds).length === 1) {
                        data = {};
                    }
                }

                if (!event.shiftKey) {
                    this.lastClickedIndex = targetIndex;
                }
            }

            if (!deselect) {
                pushData(data);
            }

            this.trigger('selectObjects', {
                vertexIds: selectVertexIds,
                edgeIds: selectEdgeIds
            })
        };

        this.onContextMenu = function(e) {
            e.preventDefault();
            e.stopPropagation();

            const link = $(e.target).closest('.element-item').children('a');
            if (link.data('vertexId')) {
                this.trigger(this.$node, 'showVertexContextMenu', {
                    vertexId: link.data('vertexId'),
                    position: {
                        x: e.pageX,
                        y: e.pageY
                    }
                });
            } else if (link.data('edgeId')) {
                this.trigger(this.$node, 'showEdgeContextMenu', {
                    edgeIds: [link.data('edgeId')],
                    position: {
                        x: e.pageX,
                        y: e.pageY
                    }
                });
            }
        };

        this.move = function(e, data) {
            var previousSelected = this.select('itemSelector').filter('.active')[e.type === 'upUp' ? 'first' : 'last'](),
                moveTo = previousSelected[e.type === 'upUp' ? 'prev' : 'next']('.element-item');

            if (moveTo.length) {
                var selectedVertexIds = data.shiftKey ? _.keys(bcData.selectedObjects.vertexIds) : [],
                    selectedEdgeIds = data.shiftKey ? _.keys(bcData.selectedObjects.edgeIds) : [],
                    vertexId = moveTo.children('a').data('vertexId'),
                    edgeId = moveTo.children('a').data('edgeId');

                if (vertexId) selectedVertexIds.push(vertexId);
                if (edgeId) selectedEdgeIds.push(edgeId);

                this.trigger(document, 'defocusElements');
                this.trigger('selectObjects', { vertexIds: selectedVertexIds, edgeIds: selectedEdgeIds });
            }
        };

        this.onSelectAll = function(e) {
            e.stopPropagation();

            // Don't allow select all if all items are not loaded, it is misleading
            if (this.isScrolling()) {
                this.trigger('displayInformation', {
                    message: i18n('search.noSelectAllWhileLoading')
                });
                return;
            }

            var items = this.select('itemSelector').addClass('active');
            this.selectItems(items);
        };

        this.after('teardown', function() {
            this.trigger(document, 'defocusElements');
            this.select('itemSelector').children('a').teardownAllComponents();
            this.$node.off('mouseenter mouseleave');
            this.scrollNode.off('scroll.elementList');
            this.$node.empty();
        });

        this.attachEvents = function() {
            this.scrollNode = this.$node;
            while (this.scrollNode.length && this.scrollNode.css('overflow') !== 'auto') {
                this.scrollNode = this.scrollNode.parent();
            }
            this.scrollNode.on('scroll.elementList', this.onResultsScroll.bind(this));

            this.$node.on('mouseenter mouseleave', '.element-item', this.onHoverItem.bind(this));

            this.on(document, 'verticesUpdated', this.onVerticesUpdated);
            this.on(document, 'verticesDeleted', this.onVerticesDeleted);
            this.on(document, 'edgesDeleted', this.onEdgesDeleted);
            this.on(document, 'objectsSelected', this.onObjectsSelected);
            this.on('objectsSelected', this.onObjectsSelected);
            this.on(document, 'workspaceLoaded', this.onWorkspaceLoaded);
            this.on('addInfiniteItems', this.onAddInfiniteItems);
        };

        this.onHoverItem = function(evt) {
            if (this.disableHover === 'defocused') {
                return;
            } else if (this.disableHover) {
                this.disableHover = 'defocused';
                return this.trigger(document, 'defocusElements');
            }

            var $anchor = $(evt.target).closest('.element-item').children('a'),
                vertexId = $anchor.data('vertexId'),
                edgeId = $anchor.data('edgeId');

            if (evt.type === 'mouseenter' && vertexId) {
                this.trigger(document, 'focusElements', { vertexIds: [vertexId] });
            } else if (evt.type === 'mouseenter' && edgeId) {
                this.trigger(document, 'focusElements', { edgeIds: [edgeId] });
            } else {
                this.trigger(document, 'defocusElements');
            }
        };

        this.onResultsScroll = function(e) {
            if (!this.disableHover) {
                this.disableHover = true;
            }

            this.loadVisibleResultPreviews();

            if (this.localScrolling || this.attr.infiniteScrolling) {
                this.triggerInfiniteScrollRequest();
            }
        };

        this.triggerInfiniteScrollRequest = function() {
            if (!this.attr.infiniteScrolling && !this.localScrolling) return;

            var loadingListElement = this.$node.find('.infinite-loading');
            if(loadingListElement.is(":hidden")) {
                return;
            }

            if (this.scrollNode.length) {
                loadingListElement = loadingListElement.withinScrollable(this.scrollNode);
            }

            if (loadingListElement.length) {
                if (this.localScrolling) {
                    this.offset += MAX_ITEMS_BEFORE_FORCE_LOADING;
                    this.addItems(this.attr.items.slice(this.offset, this.offset + MAX_ITEMS_BEFORE_FORCE_LOADING));
                } else {
                    /** TODO: is the concept type attr needed here? */
                    var data = { conceptType: this.attr.verticesConceptId };
                    if (!this.offset) this.offset = this.attr.nextOffset;
                    data.paging = {
                        offset: this.offset
                    };

                    /**
                     * Fired when the user scrolls to the end of a list that has `infiniteScrolling` enabled.
                     * The controlling component should listen and trigger
                         * {@link module:components/List#event:addInfiniteItems addInfiniteItems} events.
                         *
                         * @event module:components/List#infiniteScrollRequest
                     * @property {object} data
                     * @property {object} data.paging
                     * @property {number} data.paging.offset Paging offset
                     */
                    this.trigger('infiniteScrollRequest', data);
                }
            }
        };

        this.attachItemRenderer = function(el, item, relationship) {
            var self = this,
                usageContext = self.attr.usageContext,
                itemRenderer = _.find(this.renderers, function(renderer) {

                    /**
                     * Defines whether the given extension should be used give
                     * the item + usageContext pair.
                     *
                     * @callback org.bigconnect.entity.listItemRenderer~canHandle
                     * @param {object} item Element/Edge object
                     * @param {string|undefined} usageContext The context this list is running. 'search, detail/relationships', etc.
                     * @returns {boolean} If the extension renderer should be invoked
                     */
                    return renderer.component && renderer.canHandle(item, usageContext);
                }).component;

            el.children('a').teardownAllComponents();
            el.empty();

            /**
             * Flight Component that handles row rendering for a given
             *  `item` and `usageContext`.
             *
             *  @typedef org.bigconnect.entity.listItemRenderer~Component
             *  @listens org.bigconnect.entity.listItemRenderer#loadPreview
             *  @property {object} item The rows item value
             *  @property {string} usageContext The context of this element list
             */
            itemRenderer.attachTo($('<a class="draggable" />').appendTo(el), { item: item, usageContext: usageContext });

            this.applyDraggable(el[0]);

            return el;
        };

        this.addItems = function(items) {
            if (this.localScrolling && (this.offset + MAX_ITEMS_BEFORE_FORCE_LOADING) >= this.allItems.length) {
                this.$node.find('.infinite-loading').remove();
            }
            if (items.length && 'vertex' in items[0]) {
                this._items = {
                    ...(this._items || {}),
                    ...(_.indexBy(_.pluck(items, 'vertex'), 'id')),
                    ...(_.indexBy(_.pluck(items, 'relationship'), 'id'))
                };
            } else {
                this._items = { ...(this._items || {}), ...(_.indexBy(items, 'id')) };
            }

            var self = this,
                loading = this.$node.find('.infinite-loading'),
                added = _.reduce(items, function(selection, item) {
                    var $li = self.attachItemRenderer($('<li class="element-item" />'), item);
                    return selection.add($li);
                }, $());

            if (loading && loading.length) {
                loading.before(added);
            } else {
                this.$node.children('ul').append(added);
            }

            this.loadVisibleResultPreviews();
        };

        /**
         * The Element List component registers a listener for this event that
         * should be fired by the consuming component in response to `infiniteScrollRequest` events.
         *
         * @event module:components/List#addInfiniteItems
         * @property {object} data
         * @property {boolean} data.success Whether the request succeeded or not
         * @property {Array.<object>} data.items The new items to place
         * @property {number} data.nextOffset The next offset to request
         * @property {number|undefined} data.total The new total (optional)
         * @example
         * $node.on('infiniteScrollRequest', function(event, data) {
         *     makeRequestStartingAtOffset(data.paging.offset)
         *     .then(function(results) {
         *         $(event.target).trigger('addInfiniteItems', {
         *             items: results,
         *             nextOffset: data.paging.offset + results.length
         *         })
         *     })
         * });
         * List.attachTo($node, {
         *     items: [],
         *     infiniteScrolling: true,
         *     nextOffset: 10
         * })
         */
        this.onAddInfiniteItems = function(evt, data) {
            var loading = this.$node.find('.infinite-loading');

            if (!data.success) {
                loading.html(alertTemplate({
                    error: i18n('element.list.infinite_scroll.error')
                }));
                this.attr.infiniteScrolling = false;
            } else if (data.items.length === 0) {
                loading.remove();
                this.attr.infiniteScrolling = false;
            } else {
                this.addItems(data.items);

                this.offset = data.nextOffset;

                var total = data.total || this.attr.total || 0;
                if (total === this.select('itemSelector').length) {
                    loading.remove();
                    this.attr.infiniteScrolling = false;
                } else {
                    this.triggerInfiniteScrollRequest();
                }
            }
        };

        this.loadVisibleResultPreviews = function() {
            this.disableHover = false;

            var lisVisible = this.select('itemSelector');
            if (this.scrollNode.length) {
                lisVisible = lisVisible.withinScrollable(this.scrollNode);
            }

            /**
             * Triggered on all {@link org.bigconnect.entity.listItemRenderer~Component}
             * components when the user scrolls to make the row visible.
             *
             * The component should render any images, or make any auxillary
             * requests.
             *
             * **This event might be triggered more than once, use `_.once`
             * or another method to only take action once.**
             *
             * @event org.bigconnect.entity.listItemRenderer#loadPreview
             * @example
             * this.on('loadPreview', _.once(this.onLoadPreview.bind(this)));
             */
            lisVisible.children('a').trigger('loadPreview');
        };

        this.applyDraggable = function(el) {
            var self = this;

            el.setAttribute('draggable', true)
            el.addEventListener('dragstart', function(e) {
                const $target = $(e.target);
                const elements = [];

                $target.siblings('.active').addBack().each(function() {
                    var data = $(this).find('a.draggable').data();
                    if (data.vertexId) {
                        elements.push(self._items[data.vertexId])
                    }
                    if (data.edgeId) {
                        elements.push(self._items[data.edgeId])
                    }
                })
                const dt = e.dataTransfer;
                dnd.setDataTransferWithElements(dt, { elements })
            }, false)
        };

        this.selectItems = function(items) {
            var selection = _.reduce(items.children('a'), function(memo, item) {
                    var $item = $(item),
                        vertexId = $item.data('vertexId'),
                        edgeId = $item.data('edgeId');

                    if (vertexId) memo.vertexIds.push(vertexId);
                    if (edgeId) memo.edgeIds.push(edgeId);

                    return memo;
                }, { vertexIds: [], edgeIds: [] });

            if (selection.vertexIds.length === 0 && selection.edgeIds.length === 0) {
                return;
            }

            if(this.attr.openDetails) {
                this.trigger(document, 'defocusElements');
                this.trigger('selectObjects', selection);
            }
        };

        this.onWorkspaceLoaded = function(evt, workspace) {
            this.onVerticesUpdated(evt, workspace.data || {});
        };

        this.onVerticesUpdated = function(event, data) {
            var self = this,
                updatedVertices = _.indexBy(data.vertices || [], 'id');

            this.select('itemSelector').each(function(idx, item) {
                var $item = $(item),
                    vertexId = $item.children('a').data('vertexId');
                if (vertexId && vertexId in updatedVertices) {
                    self.attachItemRenderer($item, updatedVertices[vertexId]);
                }
            });
            this.loadVisibleResultPreviews();
        };

        this.onVerticesDeleted = function(event, data) {
            var self = this,
                deletedVertices = _.indexBy(data.vertexIds || []);
            this.select('itemSelector').each(function(idx, item) {
                var $item = $(item),
                    $a = $item.children('a'),
                    vertexId = $a.data('vertexId');
                if (vertexId && vertexId in deletedVertices) {
                    $a.teardownAllComponents();
                    $item.remove();
                }
            });
            this.loadVisibleResultPreviews();
        };

        this.onEdgesDeleted = function(event, data) {
            var self = this;
            this.select('itemSelector').each(function(idx, item) {
                var $item = $(item),
                    $a = $item.children('a'),
                    edgeId = $a.data('edgeId');
                if (edgeId && edgeId === data.edgeId) {
                    $a.teardownAllComponents();
                    $item.remove();
                }
            });
            this.loadVisibleResultPreviews();
        };

        this.onObjectsSelected = function(event, data) {
            var self = this,
                vertexIds = _.pluck(data.vertices, 'id'),
                edgeIds = _.pluck(data.edges, 'id'),
                total = vertexIds.length + edgeIds.length;

            this.$node.children('ul').children('.active').removeClass('active');

            if (vertexIds.length === 0 && edgeIds.length === 0) {
                return;
            }
            if (this.attr.showSelected === false && total > 1) return;

            this.$node.addClass('active');
            this.select('itemSelector').each(function(idx, item) {
                var $item = $(item),
                    itemVertexId = $item.children('a').data('vertexId'),
                    itemEdgeId = $item.children('a').data('edgeId');
                if ((itemVertexId && _.contains(vertexIds, itemVertexId)) ||
                    (itemEdgeId && _.contains(edgeIds, itemEdgeId))) {
                    $item.addClass('active');
                    self.trigger($item.children('a'), 'itemActivated');
                } else {
                    self.trigger($item.children('a'), 'itemDeactivated');
                }
            });
        };
    }
});
