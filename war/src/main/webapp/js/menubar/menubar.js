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
    'configuration/plugins/registry',
    './activity/activity',
    './menubar.hbs',
    'admin/admin',
    'util/requirejs/promise!util/service/propertiesPromise'
], function(defineComponent, registry, Activity, template, AdminList, config) {
    'use strict';

    const enableCypherLabLink = config['cypher.lab'] || "true";

    // Add class name of <li> buttons here
    var BUTTONS = 'dashboard ingest search workspaces admin activity logout products user-profile'.split(' '),
        PANE_AUXILIARY = {
            products: { name: 'products-full', action: { type: 'full', componentPath: 'product/ProductDetailContainer' } }
        },
        TOOLTIPS = {
            activity: i18n('menubar.icons.activity.tooltip'),
            ingest: i18n('menubar.icons.ingest.tooltip'),
            dashboard: i18n('menubar.icons.dashboard.tooltip'),
            search: i18n('menubar.icons.search.tooltip'),
            workspaces: i18n('menubar.icons.workspaces.tooltip'),
            products: i18n('menubar.icons.products.tooltip'),
            admin: i18n('menubar.icons.admin.tooltip'),
            logout: i18n('menubar.icons.logout.tooltip')
        },

        // Which cannot both be active
        MUTALLY_EXCLUSIVE_SWITCHES = [
            { names: ['dashboard', 'ingest', 'search', 'products', 'admin'], options: { allowCollapse: false } },
            { names: ['dashboard', 'ingest', 'search', 'products-full', 'admin'], options: { allowCollapse: false } }
        ],

        ACTION_TYPES = {
            full: MUTALLY_EXCLUSIVE_SWITCHES[0],
            dropdown: MUTALLY_EXCLUSIVE_SWITCHES[1],
            url: { names: [], options: {}}
        },

        // Don't change state to highlighted on click
        DISABLE_ACTIVE_SWITCH = 'logout activity workspaces'.split(' '),

        DISABLE_HIDE_TOOLTIP_ON_CLICK = 'logout'.split(' ');

    return defineComponent(Menubar);

    function menubarItemHandler(name) {
        var sel = name + 'IconSelector';

        return function(e) {
            e.preventDefault();

            var self = this,
                isSwitch = false;

            if (DISABLE_ACTIVE_SWITCH.indexOf(name) === -1) {
                MUTALLY_EXCLUSIVE_SWITCHES.forEach(function(exclusive, i) {
                    if (exclusive.names.indexOf(name) !== -1 && exclusive.options.allowCollapse === false) {
                        isSwitch = true;
                    }
                });
            }
            var icon = this.select(sel);
            if (!_.contains(DISABLE_HIDE_TOOLTIP_ON_CLICK, name)) {
                icon.tooltip('hide');
            }

            if (isSwitch && icon.hasClass('active')) {
                icon.toggleClass('toggled');
            } else {
                requestAnimationFrame(function() {
                    var data = { name: name };
                    if (name in self.extensions) {
                        data.action = self.extensions[name].action;
                    }
                    if (data.action && data.action.type === 'url') {
                        flashIcon(icon);
                        window.open(data.action.url);
                    } else {
                        var aux = PANE_AUXILIARY[name];
                        if (aux) {
                            if (!icon.hasClass('active-aux') && icon.hasClass('only-open-auxiliary')) {
                                self.trigger(document, 'menubarToggleDisplay', {
                                    name: aux.name, action: aux.action
                                });
                                return;
                            }
                            icon.toggleClass('only-open-auxiliary', icon.hasClass('active'));
                        }
                        self.trigger(document, 'menubarToggleDisplay', data);
                    }
                });
            }
        };
    }

    function flashIcon(icon) {
        icon.addClass('active');
        _.delay(function() {
            icon.removeClass('active');
        }, 200);
    }

    function Menubar() {
        var attrs = {}, events = {};

        BUTTONS.forEach(function(name) {
            var sel = name + 'IconSelector';

            attrs[sel] = '.' + name;
            events[sel] = menubarItemHandler(name);
        });

        var self = this,
            extensions = {};

        /**
         * Add additional icons into the menubar that can open a slide out
         * panel or display a component in the content area like the built in
         * dashboard.
         *
         * For placement hints options, these are the built-in identifiers:
         * `dashboard`, `search`, `workspaces` (cases), `products`, `admin`,
         * `activity`, `logout`.
         *
         * All `pane` type extensions will automatically save/restore pane
         * size as a user preference.
         *
         * @param {string} title The text to display under the icon
         * @param {string} identifier The unique identifier for this item.
         * Should be valid CSS classname.
         * @param {string} icon Url to the icon to display
         * @param {object} action The unique identifier for this item
         * @param {string} action.componentPath The path to a Flight or React
         * component
         * @param {string} action.type The type of action when clicked:
         * * `pane` Slide out pane
         * * `full` Use the full content (behind panes)
         * * `url` Open url
         * @param {string} [welcomeTemplatePath] Path to handlebars template file for use in dashboard welcome card.
         * @param {string} [options]
         * @param {string} [options.tooltip] Different text to display on hover
         * in a tooltip, otherwise displays the `title`
         * @param {string} [options.placementHint=top] If the item is added to
         * `top` or `bottom` of menubar
         * @param {string} [placementHintBefore] identifier of another menubar
         * item that this item should be placed before
         * @param {string} [placementHintAfter] identifier of another menubar
         * item that this item should be placed after
         */
        registry.documentExtensionPoint('org.bigconnect.menubar',
            'Add items to menubar',
            function(e) {
                return ('title' in e) &&
                    ('identifier' in e) &&
                    ('action' in e) &&
                    ('icon' in e);
            },
            'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/menu-bar'
        );
        registry.extensionsForPoint('org.bigconnect.menubar')
            .forEach(function(data) {
                var cls = data.identifier,
                    type = data.action.type;

                if (type in ACTION_TYPES) {
                    ACTION_TYPES[type].names.push(cls);
                }
                TOOLTIPS[cls] = data.options && data.options.tooltip || data.title;

                extensions[cls] = data;
                attrs[cls + 'IconSelector'] = '.' + cls;
                events[cls + 'IconSelector'] = menubarItemHandler(cls);
            });

        this.defaultAttrs({
            ...attrs,
            workspacesPopoverSelector: '#app .workspaces-pane',
            activityPopoverSelector: '#app .activity-pane',
            workspaceNameSelector: '.workspace-name',
            workspacePanelSelector: '#workspacePanel',
            addItemsSelector: '.add-items'
        });

        this.after('initialize', function() {
            const self = this,
                boltURL = 'bolt://'+bcData.currentUser.userName+'@'+config['bolt.server'],
                jwt = (bcData.currentUser.properties && bcData.currentUser.properties.jwt) || '';

            this.$node.html(template({
                isAdmin: AdminList.getExtensions().length > 0,
                enableCypherLabLink: (enableCypherLabLink === "true"),
                currentUser: bcData.currentUser,
                jwtToken: jwt,
                connectURL: boltURL
            }));
            this.extensions = extensions;

            this.insertExtensions();

            BUTTONS.forEach(function(button) {
                self.$node.find('.' + button).attr('data-identifier', button);
            });

            Object.keys(TOOLTIPS).forEach(function(selectorClass) {
                self.$node.find('.' + selectorClass).tooltip({
                    placement: 'bottom',
                    html: true,
                    title: (TOOLTIPS[selectorClass].html || TOOLTIPS[selectorClass]).replace(/\s+/g, '&nbsp;'),
                    delay: { show: 250, hide: 0 }
                });
            });

            this.on('click', events);

            Activity.attachTo(this.select('activityIconSelector'));

            this.on('dragenter', {
                productsIconSelector: function(event) {
                    if (!this.select('productsIconSelector').hasClass('active')) {
                        this.trigger('menubarToggleDisplay', { name: 'products' });
                    }
                }
            })
            $(document).on('dragstart', function(event) {
                const dataTransfer = event.originalEvent.dataTransfer;
                if (dataTransfer && !$('.products-pane.visible').length) {
                    if (_.any(dataTransfer.types, type => type === BC_MIMETYPES.ELEMENTS)) {
                        const cls = 'hint-drop-normal';
                        const node = $('.menubar-pane .products a').addClass(cls);
                        _.delay(() => node.removeClass(cls), 1000)
                    }
                }
            })

            this.on(document, 'menubarToggleDisplay', this.onMenubarToggle);
            this.on(document, 'workspaceLoaded', this.onWorkspaceLoaded);
            this.on(document, 'workspaceUpdated', this.onWorkspaceUpdated);
            this.on(document, 'workspaceSaved', this.onWorkspaceSaved);

            const addItems = this.select('addItemsSelector');
            addItems.on('click', this.createItem.bind(this))
        });

        this.createItem = function () {
            if (!bcData.currentWorkspaceEditable) {
                return true;
            }

            const position = { x: window.lastMousePositionX, y: window.lastMousePositionY };
            const self = this;

            Promise.require('util/popovers/fileImport/fileImport')
                .then(CreateVertex => {
                    CreateVertex.attachTo(self.$node, {
                        anchorTo: { page: position }
                    });
                });
        };

        this.setWorkspaceName = function(name) {
            // this.select('workspaceNameSelector').text(name);
        };

        this.onWorkspaceLoaded = function(event, data) {
            this.setWorkspaceName(data.title);
        };

        this.onWorkspaceUpdated = function(event, data) {
            if (bcData.currentWorkspaceId === data.workspace.workspaceId) {
                this.setWorkspaceName(data.workspace.title);
            }
        };

        this.onWorkspaceSaved = function(event, data) {
            if (data.title) {
                this.setWorkspaceName(data.title);
            }
        };

        this.insertExtensions = function() {
            var self = this,
                identifiers = _.pluck(this.extensions, 'identifier'),
                dependenciesForId = {},
                sorted = _.chain(this.extensions)
                    .each(function(e) {
                        var placementHint = e.options && (e.options.placementHintAfter || e.options.placementHintBefore || '');
                        if (placementHint && _.contains(identifiers, placementHint)) {
                            if (!dependenciesForId[placementHint]) {
                                dependenciesForId[placementHint] = [];
                            }
                            if (dependenciesForId[e.identifier] && _.contains(dependenciesForId[e.identifier], placementHint)) {
                                console.warn('Circular dependency between menubar extensions. Deleting placement hint:', placementHint, 'from:', e.identifier);
                                delete e.options.placementHintAfter;
                                delete e.options.placementHintBefore;
                            } else {
                                dependenciesForId[placementHint].push(e.identifier);
                            }
                        }
                    })
                    .values()
                    .value()
                    .sort(function(e1, e2) {
                        var deps1 = dependenciesForId[e1.identifier] || [],
                            deps2 = dependenciesForId[e2.identifier] || [];

                        if (_.contains(deps1, e2.identifier)) return -1;
                        if (_.contains(deps2, e1.identifier)) return 1;

                        var vals = _.flatten(_.values(dependenciesForId));
                        if (_.contains(vals, e1.identifier)) return 1;
                        if (_.contains(vals, e2.identifier)) return -1;
                        return 0;
                    });

            _.each(sorted, function(item) {
                var cls = item.identifier,
                    options = $.extend({
                        placementHint: 'top',
                        tooltip: item.title,
                        anchorCss: {}
                    }, item.options),
                    newItem = $('<li>')
                        .addClass(cls)
                        .attr('data-identifier', item.identifier)
                        .append(
                            $('<a>')
                            .text(item.title)
                            .css(
                                $.extend({
                                    'background-image': 'url("' + item.icon + '")'
                                }, options.anchorCss)
                            )
                        ),
                    container = self.$node.find('.menu-' + options.placementHint),
                    placementHint = options.placementHintAfter || options.placementHintBefore,
                    $placement = placementHint && container.find('.' + placementHint)

                if ($placement) {
                    if ($placement.length) {
                        if (options.placementHintAfter) {
                            return newItem.insertAfter($placement);
                        } else if (options.placementHintBefore) {
                            return newItem.insertBefore($placement);
                        }
                    } else {
                        console.warn('Unable to find menubar item placementHint:', placementHint, 'identifier:', item.identifier);
                    }
                }

                newItem.insertBefore(container.find('.divider:last-child'));
            })
        };

        this.onMenubarToggle = function(e, data) {
            var self = this,
                auxName = data && _.findKey(PANE_AUXILIARY, a => a.name === data.name),
                isAux = Boolean(auxName),
                name = data && auxName || data.name,
                icon = this.select(name + 'IconSelector'),
                active = isAux ? icon.hasClass('active-aux') : icon.hasClass('active');

            if(data.name === 'user-profile') {
                require([
                    'userAccount/modal.hbs',
                    'userAccount/userAccount'
                ], function(modalTemplate, UserAccount) {
                    var modal = $(modalTemplate({
                        userName: bcData.currentUser.userName
                    })).appendTo(document.body);
                    modal.modal('toggle');
                    UserAccount.attachTo(modal);
                });

                return;
            }

            //For extensions that define an action also
            if (!_.isUndefined(data.action) && !_.isUndefined(data.action.action)) {
                DISABLE_ACTIVE_SWITCH.push(data.name);
                DISABLE_HIDE_TOOLTIP_ON_CLICK.push(data.name);
            }

            if (DISABLE_ACTIVE_SWITCH.indexOf(data.name) === -1) {
                var isSwitch = false;

                if (!active) {
                    MUTALLY_EXCLUSIVE_SWITCHES.forEach(function(exclusive, i) {
                        if (exclusive.names.indexOf(data.name) !== -1) {
                            isSwitch = true;
                                exclusive.names.forEach(function(exclusiveName) {
                                    if (exclusiveName !== data.name) {
                                        var otherIcon = self.select(exclusiveName + 'IconSelector');
                                        var otherIsActive = false;
                                        if (otherIcon.length) {
                                            otherIsActive = otherIcon.hasClass('active');
                                        } else {
                                            var auxName = _.findKey(PANE_AUXILIARY, a => a.name === exclusiveName);
                                            if (auxName) {
                                                otherIcon = self.select(auxName + 'IconSelector');
                                                otherIsActive = otherIcon.hasClass('active-aux');
                                            }
                                        }
                                        if (otherIsActive) {
                                            self.trigger(document, 'menubarToggleDisplay', {
                                                name: exclusiveName,
                                                isSwitchButCollapse: true
                                            });
                                        }
                                } else {
                                    if (isAux) {
                                        icon.addClass('active-aux');
                                    } else {
                                        icon.addClass('active');
                                    }
                                }
                                });
                        }
                    });
                }

                if (!isSwitch || data.isSwitchButCollapse) {
                    icon.toggleClass(isAux ? 'active-aux' : 'active');
                }

                if (data && !isAux) {
                    var aux = PANE_AUXILIARY[data.name];
                    if (aux) {
                        active = icon.hasClass('active');
                        if (active && !icon.hasClass('active-aux')) {
                            this.trigger(document, 'menubarToggleDisplay', { name: aux.name, action: aux.action });
                        }
                    }
                }

            } else {

                // Just highlight briefly to show click worked
                icon.addClass('active');
                setTimeout(function() {
                    icon.removeClass('active');
                }, 200);
            }

            // position popovers for workspaces and activity
            if(data.name === 'workspaces') {
                let $popover = $(this.attr.workspacesPopoverSelector),
                    pos = this.$node.find('.workspaces').parent().position(),
                    popoverWidth = this.$node.find('.workspaces').parent().outerWidth();

                    // $popover.css('left', pos.left - (popoverWidth/2) + 'px');
                    $popover.css('right',  popoverWidth + 'px');

            } else if(data.name === 'activity') {
                let $popover = $(this.attr.activityPopoverSelector),
                    pos = this.$node.find('.activity').position(),
                    activityPaneWidth = 350;

                $popover.css('left', (pos.left - activityPaneWidth/2 - 30) + 'px');
            }
        };
    }
});
