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
    'app.hbs',
    'menubar/menubar',
    'ingest/IngestContainer',
    'dashboard/dashboard',
    'search/search',
    'workspaces/workspaces',
    'workspaces/overlay',
    'workspaces/timeline',
    'product/ProductListContainer',
    'admin/admin',
    'activity/activity',
    'detail/detail',
    'help/help',
    'search/quicksearch/quicksearch',
    'react',
    'react-dom',
    'react-redux',
    'configuration/plugins/registry',
    'util/component/attacher',
    'util/mouseOverlay',
    'util/withFileDrop',
    'util/element/menu',
    'util/privileges',
    'util/withDataRequest'
], function(
    defineComponent,
    appTemplate,
    Menubar,
    IngestContainer,
    Dashboard,
    Search,
    Workspaces,
    WorkspaceOverlay,
    WorkspaceTimeline,
    ProductListContainer,
    Admin,
    Activity,
    Detail,
    Help,
    QuickSearch,
    React,
    ReactDom,
    redux,
    registry,
    attacher,
    MouseOverlay,
    withFileDrop,
    VertexMenu,
    Privileges,
    withDataRequest) {
    'use strict';

    return defineComponent(App, withFileDrop, withDataRequest);

    function App() {
        var DATA_MENUBAR_NAME = 'menubar-name';
        const DETAIL_PANE_INITIAL_WIDTH = '30%';
        const DETAIL_PANE_EDIT_TEXT_WIDTH = '70%';
        const DETAIL_PANE_MIN_WIDTH = 225;
        const DETAIL_PANE_MAX_WIDTH = 1200;

        this.onError = function(evt, err) {
            console.error('Error: ' + err.message); // TODO better error handling
        };

        this.defaultAttrs({
            menubarSelector: '.menubar-pane',
            ingestSelector: '.ingest-pane',
            dashboardSelector: '.dashboard-pane',
            searchSelector: '.search-pane',
            workspacesSelector: '.workspaces-pane',
            productSelector: '.products-pane',
            workspaceOverlaySelector: '.workspace-overlay',
            extensionPanesSelector: '.plugin-pane',
            extensionSubPanesSelector: '.plugin-subpane',
            adminSelector: '.admin-pane',
            helpDialogSelector: '.help-dialog',
            activitySelector: '.activity-pane',
            detailPaneSelector: '.detail-pane',
            quickSearchSelector: '.quicksearch-pane',
            quickSearchInputSelector: 'input.quick-search',
            fullScreenPaneSelector: '.fullscreen-pane'
        });

        this.before('teardown', function() {
            _.invoke([
                WorkspaceOverlay,
                MouseOverlay,
                Menubar,
                Dashboard,
                Search,
                Workspaces,
                Admin,
                Detail,
                Help
            ], 'teardownAll');

            this.$node.empty();
        });

        this.after('initialize', function() {
            var self = this;

            registry.documentExtensionPoint('org.bigconnect.fileImport',
                'Override file import based on mime/type',
                function(e) {
                    return ('mimeType' in e) && _.isFunction(e.handler);
                },
                'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1'
            );

            /**
             * Register a handler that is notified of logout. Happens before
             * the request to logout.
             *
             * If the handler returns `false` all other logout handlers are skipped and the default logout process is cancelled.
             *
             * @param {function} config The function to call during logout.
             * @returns {boolean} To cancel logout return `false`
             * @example
             * registry.registerExtension('org.bigconnect.logout', function() {
             *     window.location.href = '/logout';
             *     return false;
             * });
             */
            registry.documentExtensionPoint('org.bigconnect.logout',
                'Override logout',
                function(e) {
                    return _.isFunction(e);
                },
                'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/logout'
            );

            /**
             * Add menu items to the context menu of vertices.
             *
             * Pass the string `DIVIDER` to place a divider in the menu
             *
             * @param {string} label The menu text to display
             * @param {string} event The event to trigger on click, not
             * required if `submenu` is provided
             * @param {string} [shortcut] string of shortcut to show in menu.
             * Doesn't actually listen for shortcut, just places the text in
             * the label. For example, `alt+p`
             * @param {object} [args] Additional arguments passed to handler
             * @param {string} [cls] CSS classname added to item
             * @param {function} [shouldDisable] Given the `selection`,
             * `vertexId`, `DomElement`, and `vertex` as parameters
             * @param {array.<object>} [submenu] The submenu to open on hover
             * @param {function} [canHandle] Should the item be place given
             * `currentSelection` and `vertex` parameters.
             * @param {number} [selection] Automatically enable or disable based on the targeted number of vertices
             * @param {object} [options]
             * @param {function} [options.insertIntoMenuItems] function to place the item in a specific location/order, given `item` and `items`.
             *
             * Syntax similar to {@link org.bigconnect.detail.toolbar~insertIntoMenuItems}
             */
            registry.documentExtensionPoint('org.bigconnect.vertex.menu',
                'Add vertex context menu items',
                function(e) {
                    return e === 'DIVIDER' || (
                        ('event' in e || 'submenu' in e) && ('label' in e)
                    );
                },
                'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/element-menu'
            );

            /**
             * Add menu items to the context menu of edges.
             *
             * Pass the string `DIVIDER` to place a divider in the menu
             *
             * @param {string} label The menu text to display
             * @param {string} event The event to trigger on click, not
             * required if `submenu` is provided
             * @param {string} [shortcut] string of shortcut to show in menu.
             * Doesn't actually listen for shortcut, just places the text in
             * the label. For example, `alt+p`
             * @param {object} [args] Additional arguments passed to handler
             * @param {string} [cls] CSS classname added to item
             * @param {function} [shouldDisable] Given the `selection`,
             * `edgeId`, `DomElement`, and `edge` as parameters
             * @param {array.<object>} [submenu] The submenu to open on hover
             * @param {function} [canHandle] Should the item be place given
             * `currentSelection` and `edge` parameters.
             * @param {number} [selection] Automatically enable or disable based on the targeted number of edges
             * @param {object} [options]
             * @param {function} [options.insertIntoMenuItems] function to place the item in a specific location/order, given `item` and `items`.
             *
             * Syntax similar to {@link org.bigconnect.detail.toolbar~insertIntoMenuItems}
             */
            registry.documentExtensionPoint('org.bigconnect.edge.menu',
                'Add edge context menu items',
                function(e) {
                    return e === 'DIVIDER' || (
                        ('event' in e || 'submenu' in e) && ('label' in e)
                    );
                },
                'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/element-menu'
            );

            fixMultipleBootstrapModals();

            this.on('registerForPositionChanges', this.onRegisterForPositionChanges);
            this.on(document, 'error', this.onError);
            this.on(document, 'menubarToggleDisplay', this.toggleDisplay);
            this.on(document, 'objectsSelected', this.onObjectsSelected);
            this.on(document, 'resizestart', this.onResizeStart);
            this.on(document, 'resizestop', this.onResizeStop);
            this.on(document, 'mapCenter', this.onMapAction);
            this.on(document, 'changeView', this.onChangeView);
            this.on(document, 'toggleActivityPane', this.toggleActivityPane);
            this.on(document, 'escape', this.onEscapeKey);
            this.on(document, 'logout', this.logout);
            this.on(document, 'showVertexContextMenu', this.onShowVertexContextMenu);
            this.on(document, 'showEdgeContextMenu', this.onShowEdgeContextMenu);
            this.on(document, 'showCollapsedItemContextMenu', this.onShowCollapsedItemContextMenu);
            this.on(document, 'genericPaste', this.onGenericPaste);
            this.on(document, 'toggleTimeline', this.onToggleTimeline);
            this.on(document, 'privilegesReady', _.once(this.onPrivilegesReady.bind(this)));
            this.on(document, 'openFullscreen', this.onOpenFullscreen);
            this.on(document, 'resizeForEditText', this.onResizeForEditText);



            this.trigger(document, 'registerKeyboardShortcuts', {
                scope: ['graph.help.scope', 'map.help.scope'].map(i18n),
                shortcuts: {
                    escape: { fire: 'escape', desc: i18n('bc.help.escape') }
                }
            });

            this.trigger(document, 'registerKeyboardShortcuts', {
                scope: i18n('bc.help.scope'),
                shortcuts: {
                    'alt-l': { fire: 'logout', desc: i18n('bc.help.logout') }
                }
            });

            this.trigger(document, 'registerKeyboardShortcuts', {
                scope: i18n('activity.help.scope'),
                shortcuts: {
                    'alt-a': { fire: 'toggleActivityPane', desc: i18n('activity.help.toggle') }
                }
            });


            // Prevent the fragment identifier from changing after an anchor
            // with href="#" not stopPropagation'ed
            $(document).on('click', 'a', this.trapAnchorClicks.bind(this));
            $(document).on('click', '#app', this.collapseAllPanes.bind(this));
            $(document).on('click', '.collapseicon',  this.fullScreenPane.bind(this));



            var content = $(appTemplate({})),
                menubarPane = content.filter(this.attr.menubarSelector),
                dashboardPane = content.filter(this.attr.dashboardSelector).data(DATA_MENUBAR_NAME, 'dashboard'),
                searchPane = content.filter(this.attr.searchSelector).data(DATA_MENUBAR_NAME, 'search'),
                workspacesPane = content.filter(this.attr.workspacesSelector).data(DATA_MENUBAR_NAME, 'workspaces'),
                productsPane = content.filter('.products-pane').data(DATA_MENUBAR_NAME, 'products'),
                ingestPane = content.filter(this.attr.ingestSelector).data(DATA_MENUBAR_NAME, 'ingest'),
                adminPane = content.filter(this.attr.adminSelector).data(DATA_MENUBAR_NAME, 'admin'),
                activityPane = content.filter(this.attr.activitySelector).data(DATA_MENUBAR_NAME, 'activity'),
                detailPane = content.filter(this.attr.detailPaneSelector).data(DATA_MENUBAR_NAME, 'detail'),
                helpDialog = content.filter(this.attr.helpDialogSelector);


            // Configure splitpane resizing
            resizable(detailPane, 'w', DETAIL_PANE_MIN_WIDTH, DETAIL_PANE_MAX_WIDTH);


            WorkspaceOverlay.attachTo(content.filter(this.attr.workspaceOverlaySelector));
            MouseOverlay.attachTo(document);
            Menubar.attachTo(menubarPane.find('.content'));
            Dashboard.attachTo(dashboardPane);
            Search.attachTo(searchPane);
            Workspaces.attachTo(workspacesPane.find('.content'));
            Admin.attachTo(adminPane);
            Activity.attachTo(activityPane.find('.content'));
            Detail.attachTo(detailPane.find('.content'));
            Help.attachTo(helpDialog);

            this.attachReactComponentWithStore(ProductListContainer, {}, productsPane.find('.content'));
            this.attachReactComponentWithStore(IngestContainer, {}, ingestPane.find('.content'));

            this.$node.html(content);

            $(this.attr.quickSearchInputSelector).keyup(this.onQuickSearch.bind(this));

            $(document.body).toggleClass('animatelogin', !!this.attr.animateFromLogin);

            this.installStructuredIngest();

            this.dataRequest('config', 'properties')
                .done(function(properties) {
                    var name = dashboardPane.data(DATA_MENUBAR_NAME),
                        defaultKey = 'menubar.default.selected',
                        urlSpecifiedTools = self.attr.openMenubarTools;

                    if (urlSpecifiedTools) {
                        _.each(urlSpecifiedTools, function(options = {}, name) {
                            self.trigger(document, 'menubarToggleDisplay', { name, options });
                        })
                    }
                    if (properties[defaultKey]) {
                        name = properties[defaultKey];
                    }
                    if (!urlSpecifiedTools) {
                        self.trigger(document, 'menubarToggleDisplay', { name: name });
                    }

                    if (self.attr.animateFromLogin) {
                        $(document.body).on(TRANSITION_END, function(e) {
                            $(document.body).off(TRANSITION_END);
                            self.applicationLoaded();
                        });
                        _.defer(function() {
                            $(document.body).addClass('animateloginstart');
                        })
                    } else {
                        self.applicationLoaded();
                    }
                })
        });

        this.onQuickSearch = function(event) {
            var code = event.which;
            if(code == 13) {
                event.preventDefault();
                let searchString = $(event.target).val();
                if(searchString && searchString.trim().length > 0) {
                    let quickSearchPane = this.$node.find(this.attr.quickSearchSelector),
                        quickSearchInputPos = $('.menubar-pane .content .qs-form').position();

                    quickSearchPane.css('left', quickSearchInputPos.left + 'px');

                    QuickSearch.teardownAll();
                    QuickSearch.attachTo(quickSearchPane.find('.content'), { searchQuery: searchString });
                    quickSearchPane.show();
                }
            }
        };

        this.installStructuredIngest = function() {
            const CSV_MIME_TYPE = 'text/csv',
                XSL_MIME_TYPES = ['application/xls',
                    'application/excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                ];

            registry.registerExtension('org.bigconnect.structuredingest', {
                mimeType: CSV_MIME_TYPE
            });

            XSL_MIME_TYPES.forEach(function(m) {
                registry.registerExtension('org.bigconnect.structuredingest', {
                    mimeType: m
                });
            });

            this.dataRequest('structuredIngest', 'mimeTypes')
                .then(function(result) {
                    registry.registerExtension('org.bigconnect.detail.text', {
                        shouldReplaceTextSectionForVertex: function(vertex) {
                            var vertexMimeType = _.findWhere(vertex.properties, { name: ONTOLOGY_CONSTANTS.PROP_MIME_TYPE });
                            var vertexMimeTypeLower = vertexMimeType && vertexMimeType.value && vertexMimeType.value.toLowerCase();
                            var foundExtension = vertexMimeTypeLower && _.any(result.mimeTypes, function(mimeType) {
                                return mimeType.toLowerCase() === vertexMimeTypeLower
                            });

                            return foundExtension;
                        },
                        componentPath: 'structuredIngest/TextSection'
                    });
                });
        };

        this.onPrivilegesReady = function() {
            if (this.attr.openAdminTool && Privileges.canADMIN) {
                this.trigger('menubarToggleDisplay', { name: 'admin' });
                this.trigger('showAdminPlugin', this.attr.openAdminTool);
            }
        };

        this.applicationLoaded = function() {
            var self = this;

            this.on(document, 'workspaceLoaded', function handler() {
                self.off(document, 'workspaceLoaded', handler);
                require(['notifications/notifications'], function(Notifications) {
                    Notifications.attachTo(self.$node, {
                        emptyMessage: false,
                        showInformational: false,
                    });
                });
            });
            this.trigger('loadCurrentWorkspace');
        };

        this.attachReactComponentWithStore = function(Comp, props, div) {
            return bcData.storePromise.then(function(store) {
                var component = React.createElement(Comp, props || {}),
                    provider = React.createElement(redux.Provider, { store }, component),
                    node = _.isFunction(div.get) ? div.get(0) : div;

                ReactDom.render(provider, node);
            })
        };

        this.attachReactComponentWithoutStore = function(Comp, props, div) {
            var component = React.createElement(Comp, props || {}),
                node = _.isFunction(div.get) ? div.get(0) : div;

            ReactDom.render(component, node);
        };



        this.onRegisterForPositionChanges = function(event, data) {
            var self = this;

            if (data && data.anchorTo && data.anchorTo.page) {
                reposition(data.anchorTo.page, data.anchorTo);
                this.on(document, 'windowResize', function() {
                    reposition(data.anchorTo.page, data.anchorTo);
                });
            }

            function reposition(position, anchor) {
                if (position === 'center') {
                    position = {
                        x: $(window).width() / 2 + $('.menubar-pane').width() / 2,
                        y: $(window).height() / 2
                    };
                }
                self.trigger(event.target, 'positionChanged', {
                    position: position,
                    anchor: anchor
                });
            }
        };

        this.onOpenFullscreen = function(event, data) {
            if (!data) return;

            let F;
            Promise.require('util/vertex/formatters')
                .then(function(_F) {
                    F = _F;
                    return F.vertex.getVertexAndEdgeIdsFromDataEventOrCurrentSelection(data, { async: true });
                })
                .then(function({ vertexIds, edgeIds }) {
                    var url = F.vertexUrl.url(
                        [
                            ...vertexIds.map(v => `v${v}`),
                            ...edgeIds.map(e => `e${e}`)
                        ],
                        bcData.currentWorkspaceId
                    );

                    window.open(url);
                })
        };

        this.onToggleTimeline = function(event) {
            var $button = $('.toggle-timeline');
            if ($button.is(':visible')) {
                WorkspaceTimeline.attachTo(this.$node.find('.workspace-timeline'));
                this.$node.toggleClass('workspace-timeline-visible');
                $button.toggleClass('expanded');
                if (!this.$node.hasClass('workspace-timeline-visible')) {
                    this.$node.find('.workspace-timeline').teardownComponent(WorkspaceTimeline);
                }
            } else {
                this.$node.removeClass('workspace-timeline-visible');
                $button.removeClass('expanded');
            }
        };

        this.onGenericPaste = function(event, data) {
            if (data && _.isString(data.data) && $.trim(data.data).length) {
                this.handleDropped('string', data.data, {
                    target: this.node
                });
            }
        };

        this.handleItemsDropped = function(items, event) {
            this.handleDropped('items', items, event);
        };

        this.handleFilesDropped = function(files, event) {
            this.handleDropped('files', files, event);
        };

        this.handleDropped = function(type, thing, event) {
            event.preventDefault();
            var self = this,
                config = {
                    anchorTo: {
                        page: event.pageX && event.pageY ? {
                            x: event.pageX,
                            y: event.pageY
                        } : {
                            x: window.lastMousePositionX,
                            y: window.lastMousePositionY
                        }
                    }
                };

            if (type === 'files') {
                config.files = thing;
            } else if (type === 'string') {
                config.string = thing;
                config.stringType = 'Pasted Content';
                config.stringMimeType = 'text/plain';
            } else {
                var dataByMimeType = _.chain(thing)
                    .map(function(item) {
                        return [item.type, event.dataTransfer.getData(item.type)];
                    })
                    .object()
                    .value();

                if ('text/html' in dataByMimeType) {
                    config.string = dataByMimeType['text/html'];
                    config.stringType = 'Rich Content';
                    config.stringMimeType = 'text/html';
                } else if ('text/plain' in dataByMimeType) {
                    config.string = dataByMimeType['text/plain'];
                    config.stringType = 'Plain Text';
                    config.stringMimeType = 'text/plain';
                } else {
                    return;
                }
            }

            // If product is open use the containing node for custom product behavior
            var $productContainer = $('.products-full-pane.visible');
            if ($productContainer.length) {
                require(['util/popovers/fileImport/fileImport'], function (FileImport) {
                    FileImport.attachTo($productContainer.length ? $productContainer : self.node, config);
                });
            }
        };

        this.toggleActivityPane = function() {
            this.trigger(document, 'menubarToggleDisplay', { name: 'activity' });
        };

        this.onEscapeKey = function() {
            var self = this;

            // Close any context menus first
            require(['util/element/menu'], function(VertexMenuComponent) {
                var contextMenu = $(document.body).lookupComponent(VertexMenuComponent);
                if (contextMenu) {
                    contextMenu.teardown();
                } else {
                    self.collapseAllPanes();
                    self.trigger('selectObjects');
                }
            });
        };

        this.trapAnchorClicks = function(e) {
            var $target = $(e.currentTarget);

            if ($target.is('a') && $target.attr('href') === '#') {
                e.preventDefault();
            }
        };

        this.onShowCollapsedItemContextMenu = this.onShowEdgeContextMenu = this.onShowVertexContextMenu = function(event, data) {
            data.element = event.target;

            VertexMenu.teardownAll();
            if (data && (data.collapsedItemId || data.vertexId || data.edgeIds)) {
                VertexMenu.attachTo(document.body, data);
            }
        };

        this.onMapAction = function(event, data) {
            this.trigger(document, 'changeView', { view: 'map', data: data });
        };

        this.onChangeView = function(event, data) {
            var view = data && data.view,
                pane = view && this.select(view + 'Selector');

            if (pane && pane.hasClass('visible')) {
                return;
            } else if (pane) {
                this.trigger(document, 'menubarToggleDisplay', { name: pane.data(DATA_MENUBAR_NAME), data: data.data });
            } else {
                console.log('View ' + data.view + " isn't supported");
            }
        };

        this.logout = function(event, data) {
            var self = this,
                logoutExtensions = registry.extensionsForPoint('org.bigconnect.logout'),
                errorMessage = data && data.message,
                executeHandlers = function() {
                    if (!logoutExtensions.length) {
                        return true;
                    }

                    var anyReturnedFalse = _.any(logoutExtensions, function(handler) {
                        return handler() === false;
                    });

                    if (anyReturnedFalse) {
                        return false;
                    }

                    return true;
                },
                showLoginComponent = function(errorMessage) {
                    self.trigger('didLogout');

                    $('.dialog-popover, .modal, .modal-backdrop, .popover').remove();

                    require(['login'], function(Login) {
                        $(document.body)
                            .removeClass('animatelogin animateloginstart')
                            .append('<div id="login"/>')
                            .on('loginSuccess', function() {
                                window.location.reload();
                            })
                        Login.teardownAll();
                        Login.attachTo('#login', { errorMessage });
                        _.defer(function() {
                            self.teardown();
                        });
                    });
                };

            if (data && data.byPassLogout) {
                this.trigger('willLogout');
                showLoginComponent(errorMessage);
            } else if (executeHandlers()) {
                this.trigger('willLogout');
                this.dataRequest('user', 'logout')
                    .then(() => {
                        require(['login'], Login => {
                            Login.setErrorMessage(errorMessage);
                            window.location.reload();
                        })
                    })
                    .catch(function() {
                        showLoginComponent(i18n('bc.server.not_found'));
                    });
            }
        };

        // quick fix, to do more
        this.fullScreenPane = function() {

            this.select('productSelector').toggleClass('pullLeft');
            this.select('fullScreenPaneSelector').toggleClass('pullLeft');
            $('.collapseicon').toggleClass('pullLeft');

            const pulledLeft = this.select('fullScreenPaneSelector').is('.pullLeft');
            if(!pulledLeft){
                this.select('productSelector').removeClass('pullLeft');
                $('.collapseicon').removeClass('pullLeft');
            }
        }

        this.toggleDisplay = function(e, data) {
            var self = this,
                pane = this.select(data.name + 'Selector'),
                deferred = $.Deferred(),
                menubarExtensions = registry.extensionsForPoint('org.bigconnect.menubar'),
                extension;

            if (data && data.name) {
                extension = _.findWhere(menubarExtensions, { identifier: data.name });
                if (extension) {
                    data = extension;
                    data.name = data.identifier;
                }
            }

            if (data.action) {
                pane = this.$node.find('.' + data.name + '-pane');

                if (pane.length) {
                    deferred.resolve();
                } else {
                    pane = $('<div>')
                        .data('widthPreference', data.name)
                        .addClass((data.action.type === 'full' ? 'fullscreen' : 'plugin') +
                            '-pane ' +
                            data.name + '-pane')
                        .appendTo(this.$node)
                        .data(DATA_MENUBAR_NAME, data.name);
                    const node = data.action.type === 'pane' ? pane.find('.content') : pane;
                    const options = { graphPadding: self.currentGraphPadding };

                    attacher()
                        .node(node)
                        .path(data.action.componentPath)
                        .params(options)
                        .attach()
                        .then(function() {
                            deferred.resolve();
                        });
                }
            } else if (pane.length === 0) {
                pane = this.$node.find('.' + data.name + '-pane');
                deferred.resolve();
            } else {
                deferred.resolve();
            }

            deferred.done(function() {
                const isVisible = pane.is('.visible');

                if (data.name === 'logout') {
                    return this.logout();
                }

                // Can't toggleClass because if only one is visible we want to hide all
                if (isVisible) {
                    pane.removeClass('visible');
                    // quick fix toggle product side bar
                    this.select('productSelector').removeClass('pullLeft');
                    $('.collapseicon').removeClass('pullLeft');

                    // unmount products
                    if (data.name === 'products-full') {
                        attacher()
                            .node(pane)
                            .teardown();

                        pane.remove();
                    }
                }
                else
                    pane.addClass('visible');

                this.trigger('didToggleDisplay', {
                    name: data.name,
                    visible: !isVisible
                })
            }.bind(this));
        };

        this.onObjectsSelected = function(e, data) {
            var detailPane = this.select('detailPaneSelector'),
                minWidth = 100,
                vertices = data.vertices,
                edges = data.edges,
                makeVisible = vertices.length || edges.length;

            if (makeVisible) {
                if (detailPane.width() < minWidth) {
                    detailPane[0].style.width = null;
                }
                detailPane.removeClass('collapsed').addClass('visible');
            } else {
                detailPane.removeClass('visible').addClass('collapsed');
            }
        };

        this.closeQuickSearchPane = function(event) {
            let qsPane = this.$node.find(this.attr.quickSearchSelector),
                qsPosition = qsPane.position(),
                qsWidth = qsPane.width(),
                qsHeight = qsPane.height(),
                evtX = event.clientX,
                evtY = event.clientY;

            if(evtX < qsPosition.left || evtX > (qsPosition.left + qsWidth) || (evtY > qsPosition.top + qsHeight)) {
                qsPane.hide();
            }

            this.collapseAllPanes(event);
        };

        this.mouseClikedOutsidePane = function(event, selector) {
            const pane = this.select(selector),
                position = pane.position(),
                width = pane.width(),
                height = pane.height(),
                evtX = event.clientX,
                evtY = event.clientY;

            if(position && width && height && evtX && evtY) {
                return evtX < position.left || evtX > (position.left + width) || (evtY > position.top + height);
            }

            return true;
        };

        this.collapseAllPanes = function(event) {
            if(event) {
                this.collapse(
                    _.chain(['workspacesSelector', 'activitySelector', 'extensionPanesSelector', 'activitySelector'])
                        .filter(s => this.mouseClikedOutsidePane(event, s))
                        .map(s => this.select(s))
                        .value()
                );

                this.mouseClikedOutsidePane(event, 'quickSearchSelector') && this.select('quickSearchSelector').hide();
            } else {
                this.collapse([
                    this.select('workspacesSelector'),
                    this.select('detailPaneSelector'),
                    this.select('activitySelector'),
                    this.select('extensionPanesSelector')
                ]);
                this.select('quickSearchSelector').hide();
            }
        };

        this.collapse = function(panes) {
            var self = this,
                detailPane = this.select('detailPaneSelector');

            panes.forEach(function(pane) {
                if (pane.hasClass('visible')) {
                    var name = pane.data(DATA_MENUBAR_NAME),
                        isDetail = pane.is(detailPane);

                    if (!name) {
                        if (isDetail) {
                            return detailPane.addClass('collapsed').removeClass('visible');
                        }
                        return console.warn('No ' + DATA_MENUBAR_NAME + ' attribute, unable to collapse');
                    }

                    self.trigger(document, 'menubarToggleDisplay', {
                        name: name,
                        syncToRemote: false
                    });
                }
            });

        };

        this.onResizeStart = function() {
            var wrapper = $('.draggable-wrapper');

            // Prevent map from swallowing mousemove events by adding
            // this transparent full screen div
            if (wrapper.length === 0) {
                wrapper = $('<div class="draggable-wrapper"/>').appendTo(document.body);
            }
        };

        this.onResizeStop = function() {
            $('.draggable-wrapper').remove();
        };

        this.onResizeForEditText = function(event, data) {
            const detailPane = this.select('detailPaneSelector');
            if (data.open && data.open === true) {
                detailPane.width(DETAIL_PANE_EDIT_TEXT_WIDTH);
            } else {
                detailPane.width(DETAIL_PANE_INITIAL_WIDTH);
            }
        };
    }

    function resizable(el, handles, minWidth, maxWidth, callback, createCallback) {
        return el.resizable({
            handles: handles,
            minWidth: minWidth || 150,
            maxWidth: maxWidth || 300,
            resize: callback,
            create: createCallback
        });
    }

    function fixMultipleBootstrapModals() {
        $(document).on('show.bs.modal', '.modal', function() {
            var zIndex = 10 + _.max(
                _.map($('.modal'), function(modal) {
                    return parseInt($(modal).css('z-index'), 10);
                })
            );
            $(this).css('z-index', zIndex);
            setTimeout(function() {
                $('.modal-backdrop').not('.modal-stack').css('z-index', zIndex - 1).addClass('modal-stack');
            }, 0);
        });
    }
});
