
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
    'util/formatters',
    './help.hbs',
    './sections.hbs'
], function(
    defineComponent,
    F,
    helpTemplate,
    sectionsTemplate) {
    'use strict';

    var SCOPE_SORTING_HINTS = [
        'bc.help.scope',
        'search.help.scope',
        'graph.help.scope',
        'map.help.scope'
    ].map(i18n);

    return defineComponent(Help);

    function prettyCommand(shortcut) {
        return F.string.shortcut(shortcut.character, shortcut);
    }

    function sortFn(s1, s2) {
        var i1 = SCOPE_SORTING_HINTS.indexOf(s1),
            i2 = SCOPE_SORTING_HINTS.indexOf(s2);

        if (i1 < 0) i1 = SCOPE_SORTING_HINTS.length;
        if (i2 < 0) i2 = SCOPE_SORTING_HINTS.length;

        return i1 === i2 ? 0 : i1 > i2;
    }

    function Help() {
        this.after('initialize', function() {
            this.allShortcuts = {};

            this.onRegisterKeyboardShortcuts = _.debounce(this.onRegisterKeyboardShortcuts.bind(this), 1000);

            this.on('escape', this.onEscape);
            this.on(document, 'toggleHelp', this.onDisplay);
            this.on(document, 'keyboardShortcutsRegistered', this.onKeyboardShortcutsRegistered);
            this.on(document, 'registerKeyboardShortcuts', this.onRegisterKeyboardShortcuts);

            this.$node.html(helpTemplate({}));

            this.trigger(document, 'registerKeyboardShortcuts', {
                scope: 'Help',
                shortcuts: {
                    escape: { fire: 'escape', desc: i18n('help.shortcut.escape.desc') },
                    'shift-h': { fire: 'toggleHelp', desc: i18n('help.shortcut.toggle.desc') }
                }
            })
            this.trigger(document, 'requestKeyboardShortcuts');

        });

        this.onRegisterKeyboardShortcuts = function() {
            // Shortcuts updated, regenerate list from keyboard.js
            this.trigger(document, 'requestKeyboardShortcuts');
        };

        this.onKeyboardShortcutsRegistered = function(e, data) {
            this.$node.find('ul').html(
                sectionsTemplate({
                    scopes: Object.keys(data).sort(sortFn).map(scope => ({
                        className: scope.toLowerCase(),
                        title: scope,
                        shortcuts: Object.keys(data[scope]).sort().map(key => ({
                            display: prettyCommand(data[scope][key]),
                            desc: data[scope][key].desc
                        }))
                    }))
                })
            );
        };

        this.onDisplay = function(e) {
            if (this.$node.is(':visible')) {
                this.$node.modal('hide');
            } else {
                this.$node.modal();
                _.defer(function() {
                    this.trigger('focusComponent');
                }.bind(this));
            }
        };

        this.onEscape = function(e) {
            this.$node.modal('hide');
            e.stopPropagation();
        };
    }
});
