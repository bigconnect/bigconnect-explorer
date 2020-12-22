
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
define([], function() {
    'use strict';

    return withContextMenu;

    function withContextMenu() {

        this.bindContextMenuClickEvent = function() {
            this.$node.find('.dropdown-menu a').off('click.bindCtxMenu');
            this.$node.find('.dropdown-menu a').on('click.bindCtxMenu', this.onContextMenuClick.bind(this));
        };

        this.onContextMenuClick = function(event) {
            var target = $(event.target),
                name = target.data('func'),
                functionName = name && 'onContextMenu' + name.substring(0, 1).toUpperCase() + name.substring(1),
                func = functionName && this[functionName],
                args = target.data('args');

            if (target.closest('li.disabled').length) {
                event.stopPropagation();
                event.preventDefault();
                return;
            }
            if (func) {
                if (!args) {
                    args = [];
                }
                func.apply(this, args);
            } else if (!functionName) {
                event.stopPropagation();
                event.preventDefault();
                target.blur();
                return;
            } else {
                console.error('No function exists for context menu command: ' + functionName);
            }

            setTimeout(function() {
                target.blur();
                this.$node.find('.dropdown-menu').blur().parent().removeClass('open');
            }.bind(this), 0);
        };

        this.closeMenu = function() {
            this.$node.find('.dropdown-menu').blur().parent().removeClass('open');
        };

        this.toggleMenu = function(position, menuElement) {
            this.bindContextMenuClickEvent();

            var offset = this.$node.offset(),
                padding = 10,
                windowSize = { x: $(window).width(), y: $(window).height() },
                menu = menuElement || this.$node.find('.dropdown-menu'),
                menuSize = { x: menu.outerWidth(true), y: menu.outerHeight(true) },
                submenu = menu.find('li.dropdown-submenu ul'),
                submenuSize = menuSize,
                placement = {
                    left: Math.min(
                        position.positionInVertex ?
                            position.positionInVertex.x :
                            (position.positionUsingEvent.originalEvent.pageX - offset.left),
                        windowSize.x - offset.left - menuSize.x - padding
                    ),
                    top: Math.min(
                        position.positionInVertex ?
                            position.positionInVertex.y :
                            (position.positionUsingEvent.originalEvent.pageY - offset.top),
                        windowSize.y - offset.top - menuSize.y - padding
                    )
                },
                submenuPlacement = { left: '100%', right: 'auto', top: 0, bottom: 'auto' };
            if ((placement.left + menuSize.x + submenuSize.x + padding) > windowSize.x) {
                submenuPlacement = $.extend(submenuPlacement, { right: '100%', left: 'auto' });
            }
            if ((placement.top + menuSize.y + (submenu.children('li').length * 26) + padding) > windowSize.y) {
                submenuPlacement = $.extend(submenuPlacement, { top: 'auto', bottom: '0' });
            }

            menu.parent('div').css($.extend({ position: 'absolute' }, placement));
            submenu.css(submenuPlacement);

            menu.dropdown('toggle');
        };

    }
});
