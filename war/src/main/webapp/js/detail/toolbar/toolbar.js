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
    './template.hbs',
    'configuration/plugins/registry',
    'util/vertex/formatters',
    'util/withDataRequest',
    'util/acl',
    'util/requirejs/promise!util/service/propertiesPromise'
], function(
    defineComponent,
    template,
    registry,
    F,
    withDataRequest,
    acl,
    config) {
    'use strict';

    /**
     * These items can be added to single entity/edge inspectors, or the
     * multiple selection inspector (or both). Use `canHandle` to specify
     * what inspectors to apply to.
     *
     * @param {string} event The event to fire when clicked
     * @param {string} title The text to display in the toolbar
     * @param {string} [subtitle] The text to display underneath the title
     * @param {string} [cls] A CSS classname to add to the items element. Add `disabled` to prevent events from firing
     * @param {org.bigconnect.detail.toolbar~canHandle} [canHandle] Whether this item should be added based on what's in the detail pane.
     * @param {boolean} [divider=false] Specify `true` for a toolbar menu divider instead of an actionable item
     * @param {Array.<object>} [submenu] Specify list of submenu toolbar items. Only one level supported
     * @param {boolean} [right=false] Specify `true` to float item to the right
     * @param {object} [options]
     * @param {org.bigconnect.detail.toolbar~insertIntoMenuItems} [options.insertIntoMenuItems] function to place the item in a specific location/order
     * @example <caption>Add Button</caption>
     * registry.registerExtension('org.bigconnect.detail.toolbar', {
     *     event: 'myEvent',
     *     title: 'Test Button'
     * })
     * @example <caption>Add Divider</caption>
     * registry.registerExtension('org.bigconnect.detail.toolbar', { divider: true })
     */
    registry.documentExtensionPoint('org.bigconnect.detail.toolbar',
        'Add Element Inspector toolbar items',
        function(e) {
            return e.divider || (('event' in e) && ('title' in e));
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/inspector-toolbar'
    );

    const DIVIDER = {
        divider: true
    };

    const ToolbarComponent = defineComponent(Toolbar, withDataRequest);

    ToolbarComponent.ITEMS = {
        DIVIDER,
        BACK: { title: '◀' },
        FORWARD: { title: '▶' },
        FULLSCREEN: {
            title: i18n('detail.toolbar.open.fullscreen'),
            cls: 'hide-in-fullscreen-details',
            subtitle: i18n('detail.toolbar.open.fullscreen.subtitle'), //'Open in New Window / Tab',
            event: 'openFullscreen'
        },
        ADD_PROPERTY: {
            title: i18n('detail.toolbar.add.property'),
            subtitle: i18n('detail.toolbar.add.property.entity.subtitle'), // 'Add New Property to Entity',
            cls: 'requires-EDIT',
            event: 'addNewProperty'
        },
        ADD_IMAGE: {
            title: i18n('detail.toolbar.add.image'),
            subtitle: i18n('detail.toolbar.add.image.subtitle'), // 'Upload an Image for Entity',
            cls: 'requires-EDIT',
            event: 'addImage',
            options: {
                fileSelector: true
            }
        },
        ADD_COMMENT: {
            title: i18n('detail.toolbar.add.comment'),
            subtitle: i18n('detail.toolbar.add.comment.entity.subtitle'), // 'Add New Comment to Entity',
            cls: 'requires-COMMENT',
            event: 'addNewComment'
        },
        AUDIT: {
            title: i18n('detail.toolbar.audit'),
            subtitle: i18n('detail.toolbar.audit.subtitle'),
            cls: 'audits',
            event: 'toggleAudit'
        },
        DELETE_ITEM: {
            title: i18n('detail.toolbar.delete'),
            cls: 'requires-EDIT',
            event: 'deleteItem'
        },
        DELETE_ITEMS: {
            title: i18n('detail.toolbar.delete'),
            subtitle: i18n('detail.toolbar.delete.entity.subtitle'),
            cls: 'requires-EDIT',
            event: 'deleteMultipleItems',
        },
        REQUEUE_ITEM: {
            title: i18n('detail.toolbar.requeue'),
            subtitle: i18n('detail.toolbar.requeue.subtitle'),
            cls: 'requires-EDIT',
            event: 'requeue'
        },
        UNRESOLVE_MENTIONS: {
            title: i18n('detail.toolbar.unresolveMentions'),
            subtitle: i18n('detail.toolbar.unresolveMentions.subtitle'),
            cls: 'requires-EDIT',
            event: 'unresolveMentions'
        },
        REFRESH: {
            title: i18n('detail.toolbar.refresh'),
            subtitle: i18n('detail.toolbar.refresh.subtitle'),
            event: 'refreshItem'
        }
    };

    return ToolbarComponent;

    function Toolbar() {
        this.defaultAttrs({
            toolbarItemSelector: 'li',
            toolbarCloseIconSector: '#close-detail-icon'
        });

        this.after('initialize', function() {
            this.on('updateModel', this.onUpdateModel)

            const enableWatcher = config['watcher.enabled'] || "false";
            if (enableWatcher === 'true') {
                ToolbarComponent.ITEMS['ADD_WATCH'] = {
                    title: i18n('detail.toolbar.add.watch'),
                    subtitle: i18n('detail.toolbar.add.watch.subtitle'),
                    cls: 'requires-READ',
                    event: 'createWatch'
                };
            }

            this.render();
        });

        this.render = function() {
            const model = this.attr.model;

            Promise.resolve(this.calculateConfigForModel(model))
                .then(items => this.initializeToolbar(items));
        };

        this.onUpdateModel = function(event, data) {
            this.attr.model = data.model;
            this.render();
        };

        this.initializeToolbar = function(config) {
            var toolbarItems = config.items,
                objects = config.objects,
                toolbarExtensions = _.sortBy(registry.extensionsForPoint('org.bigconnect.detail.toolbar'), 'title');

            toolbarExtensions.forEach(function(item) {

                /**
                 * @callback org.bigconnect.detail.toolbar~canHandle
                 * @param {Array.<object>} objects List of all objects displayed in detail pane
                 * @returns {boolean} Whether this extension should display for `objects`
                 */
                if (!_.isFunction(item.canHandle) || item.canHandle(objects)) {
                    item.eventData = objects;
                    if (item.options && _.isFunction(item.options.insertIntoMenuItems)) {
                        /**
                         * Function that is responsible for inserting `item`
                         * into `items`.
                         *
                         * The `items` array should be mutated, placing the
                         * `item` into the list, or into a submenu of an item
                         * in the list.
                         *
                         * @callback org.bigconnect.detail.toolbar~insertIntoMenuItems
                         * @param {object} item the toolbar item to insert
                         * @param {Array.<object>} items The existing toolbar items
                         * @example
                         * insertIntoMenuItems: function(item, items) {
                         *     // Insert item into specific position in items list
                         *     items.splice(3, 0, item);
                         * }
                         */
                        item.options.insertIntoMenuItems(item, toolbarItems);
                    } else {
                        var submenu = [];
                        if (_.isArray(item.submenu)) {
                            submenu = _.filter(item.submenu, (subItem) => !_.isFunction(subItem.canHandle) || subItem.canHandle(objects));
                        }
                        toolbarItems.push({...item, submenu});
                    }
                }
            });

            this.on('click', {
                toolbarItemSelector: this.onToolbarItem,
                toolbarCloseIconSector: this.hideDetails
            });
            if (toolbarItems.length) {
                this.$node.html(template(config));
                this.$node.find('li').each(function() {
                    var $this = $(this),
                        shouldHide = $this.hasClass('has-submenu') ?
                            _.all($this.find('li').map(function() {
                                return $(this).css('display') === 'none';
                            }).toArray()) :
                            $this.hasClass('no-event');

                    if (shouldHide) {
                        $this.hide();
                    }
                })
            } else {
                this.$node.hide();
            }
        };

        this.hideDetails = function(event) {
            this.trigger("escape");
        }

        this.calculateConfigForModel = function(model) {
            var isArray = _.isArray(model),
                vertices = isArray ? _.where(model, { type: 'vertex' }) : (model.type === 'vertex' ? [model] : []),
                edges = isArray ? _.where(model, { type: 'edge' }) : (model.type === 'edge' ? [model] : []);

            if (isArray) {
                return {
                    items: [
                        {
                            title: i18n('detail.toolbar.open'),
                            submenu: [
                                ToolbarComponent.ITEMS.FULLSCREEN,
                            ].concat(this.selectionHistory())
                        },
                        {
                            title: i18n('detail.toolbar.actions'),
                            submenu: _.compact([
                                ToolbarComponent.ITEMS.DELETE_ITEMS,
                            ])
                        },
                        {
                            title: i18n('detail.multiple.selected', F.number.pretty(model.length)),
                            cls: 'disabled',
                            right: true,
                            event: 'none'
                        }
                    ],
                    objects: { vertices: vertices, edges: edges }
                }
            } else {
                return acl.getPropertyAcls(model).then(propertyAcls => {
                    const getToolbarActions = () => {
                        const actions = [
                            ToolbarComponent.ITEMS.REFRESH,
                            ToolbarComponent.ITEMS.REQUEUE_ITEM,
                            ToolbarComponent.ITEMS.UNRESOLVE_MENTIONS,
                        ];

                        const enableWatcher = config['watcher.enabled'] || "false";
                        if (enableWatcher === 'true') {
                            actions.push(ToolbarComponent.ITEMS.ADD_WATCH);
                        }

                        actions.push(
                            ToolbarComponent.ITEMS.DIVIDER,
                            this.deleteToolbarItem(model)
                        );

                        return actions;
                    };

                    return {
                        items: [
                            {
                                title: i18n('detail.toolbar.open'),
                                submenu: _.compact([
                                    this.sourceUrlToolbarItem(model),
                                    this.openToolbarItem(model),
                                    this.downloadToolbarItem(model)
                                ]).concat(this.selectionHistory())
                            },
                            {
                                title: i18n('detail.toolbar.add'),
                                submenu: _.compact([
                                    this.addPropertyToolbarItem(model, propertyAcls),
                                    this.addImageToolbarItem(model),
                                    this.addCommentToolbarItem(model, propertyAcls)
                                ])
                            },
                            {
                                title: i18n('detail.toolbar.actions'),
                                submenu: _.compact(getToolbarActions())
                            },
                        ],
                        objects: { vertices: vertices, edges: edges }
                    };
                });
            }
        };

        this.onToolbarItem = function(event) {
            var self = this,
                $target = $(event.target).closest('li'),
                eventName = $target.data('event'),
                eventData = $target.data('eventData'),
                model = this.attr.model;

            var isArray = _.isArray(model),
                vertices = isArray ? _.where(model, { type: 'vertex' }) : (model.type === 'vertex' ? [model] : []),
                edges = isArray ? _.where(model, { type: 'edge' }) : (model.type === 'edge' ? [model] : []);

            if ($target.length && $target.hasClass('disabled')) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            if (eventName && $(event.target).is('input[type=file]')) {
                $(event.target).one('change', function(e) {
                    if (e.target.files && e.target.files.length) {
                        self.trigger(eventName, $.extend({
                            files: e.target.files
                        }, eventData));
                    }
                });
                this.hideMenu();
                return;
            }

            if (eventName) {
                event.preventDefault();
                event.stopPropagation();

                _.defer(function() {
                    self.trigger(eventName, { ...eventData, vertices, edges });
                });

                this.hideMenu();
            }
        };

        this.hideMenu = function() {
            var node = this.$node.addClass('hideSubmenus'),
                remove = _.once(function() {
                    node.removeClass('hideSubmenus');
                });
            $(window).one('mousemove click', remove);
        };

        this.selectionHistory = function() {
            if ('selectedObjectsStack' in bcData) {
                var menus = [],
                    stack = bcData.selectedObjectsStack;

                for (var i = stack.length - 1; i >= 0; i--) {
                    var s = stack[i];
                    menus.push({
                        title: s.title,
                        cls: 'history-item',
                        event: 'selectObjects',
                        eventData: {
                            vertexIds: s.vertexIds,
                            edgeIds: s.edgeIds
                            //options: {
                            //ignoreMultipleSelectionOverride: true
                            //}
                        }
                    });
                }
                if (menus.length) {
                    menus.splice(0, 0, DIVIDER, {
                        title: 'Previously Viewed',
                        cls: 'disabled'
                    });
                }
                return menus;
            }
        };

        this.openToolbarItem = function(model) {
            var rawProps = F.vertex.props(model, ONTOLOGY_CONSTANTS.PROP_RAW);
            if (rawProps.length) {
                return {
                    title: i18n('detail.artifact.open.original'),
                    subtitle: i18n('detail.artifact.open.original.subtitle'),
                    event: 'openOriginal'
                };
            }
        };

        this.downloadToolbarItem = function(model) {
            var rawProps = F.vertex.props(model, ONTOLOGY_CONSTANTS.PROP_RAW);
            if (rawProps.length) {
                return {
                    title: i18n('detail.artifact.open.download.original'),
                    subtitle: i18n('detail.artifact.open.download.original.subtitle'),
                    event: 'downloadOriginal'
                };
            }
        };

        this.sourceUrlToolbarItem = function(model) {
            if (_.isObject(model) && _.isArray(model.properties)) {
                var sourceUrl = _.findWhere(model.properties, { name: ONTOLOGY_CONSTANTS.PROP_SOURCE_URL });

                if (sourceUrl) {
                    return {
                        title: i18n('detail.toolbar.open.source_url'),
                        subtitle: i18n('detail.toolbar.open.source_url.subtitle'),
                        event: 'openSourceUrl',
                        eventData: {
                            sourceUrl: sourceUrl.value
                        }
                    };
                }
            }
        };

        this.addPropertyToolbarItem = function(model, propertyAcls) {
            var commentPropertyAcls = _.reject(propertyAcls, function(property) {
                    return property.name === ONTOLOGY_CONSTANTS.PROP_COMMENT_ENTRY;
                }),
                hasAddableProperties = _.where(commentPropertyAcls, { addable: true }).length > 0 || bcData.currentUser.privilegesHelper.ONTOLOGY_ADD,
                disableAdd = (model.hasOwnProperty('updateable') && !model.updateable) || !hasAddableProperties;

            if (!disableAdd) {
                return {
                    ...ToolbarComponent.ITEMS.ADD_PROPERTY,
                    subtitle: model.type === 'vertex' ? i18n('detail.toolbar.add.property.entity.subtitle') : i18n('detail.toolbar.add.property.relationship.subtitle')
                }
            }
        };

        this.addImageToolbarItem = function(model) {
            var displayType = F.vertex.displayType(model);
            var disableAddImage = (model.hasOwnProperty('updateable') && !model.updateable || model.type === 'edge');

            if (!disableAddImage && (displayType !== 'image' && displayType !== 'video')) {
                return ToolbarComponent.ITEMS.ADD_IMAGE;
            }
        };

        this.addCommentToolbarItem = function(model, propertyAcls) {
            var hasAddableCommentProperty = _.where(propertyAcls, { name: ONTOLOGY_CONSTANTS.PROP_COMMENT_ENTRY, addable: true }).length > 0,
                disableAdd = (model.hasOwnProperty('updateable') && !model.updateable) || !hasAddableCommentProperty;

            if (!disableAdd) {
                return {
                    ...ToolbarComponent.ITEMS.ADD_COMMENT,
                    subtitle: model.type === 'vertex' ? i18n('detail.toolbar.add.comment.entity.subtitle') : i18n('detail.toolbar.add.comment.relationship.subtitle')
                }
            }
        };

        this.deleteToolbarItem = function(model) {
            var disableDelete = model.hasOwnProperty('deleteable') && !model.deleteable;

            if (!disableDelete) {
                return _.extend(ToolbarComponent.ITEMS.DELETE_ITEM, {
                    title: model.type === 'vertex' ? i18n('detail.toolbar.delete.entity') : i18n('detail.toolbar.delete.edge'),
                    subtitle: model.type === 'vertex' ? i18n('detail.toolbar.delete.entity.subtitle') : i18n('detail.toolbar.delete.edge.subtitle')
                })
            }
        };
    }
});
