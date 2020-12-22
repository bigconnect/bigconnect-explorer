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

    return function() {
        //IE fires blur event if clicking on a scrollbar which prevents click/drag to scroll the dropdown
        $.fn.typeahead.Constructor.prototype = {
            ...$.fn.typeahead.Constructor.prototype,
            listen: function () {
                this.$element
                    .on('focus', $.proxy(this.focus, this))
                    .on('blur', $.proxy(this.blur, this))
                    .on('keypress', $.proxy(this.keypress, this))
                    .on('keyup', $.proxy(this.keyup, this))

                if (this.eventSupported('keydown')) {
                    this.$element.on('keydown', $.proxy(this.keydown, this))
                }

                this.$menu
                    .on('click', $.proxy(this.click, this))
                    .on('mouseenter', 'li', $.proxy(this.mouseenter, this))
                    .on('mouseleave', 'li', $.proxy(this.mouseleave, this))
                    .on('mouseenter', $.proxy(this.mouseenterMenu, this))
                    .on('mouseleave', $.proxy(this.mouseleaveMenu, this))
            },

            blur: function (e) {
                const self = this;

                if (this.shown && this.mousedover) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    _.defer(function() { self.$element.focus(); });
                } else {
                    this.focused = false
                    if (!this.mousedover && this.shown) this.hide()
                }
            },
            mouseenter: function (e) {
                this.$menu.find('.active').removeClass('active')
                $(e.currentTarget).addClass('active')
            },
            mouseleave: function (e) {
                this.$menu.find('.active').removeClass('active')
                $(e.currentTarget).addClass('active')
            },
            mouseenterMenu: function() {
                this.mousedover = true;
            },
            mouseleaveMenu: function() {
                this.mousedover = false;
            }
        }
    };
});
