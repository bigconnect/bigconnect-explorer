
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
    'flight/lib/component'
], function(defineComponent) {
    'use strict';

    const IGNORE_SELECTORS = 'input,select,option,textarea,.bigconnect-allow-focus,.bigconnect-allow-focus *,.Select *,.ReactCodeMirror *, .org-bigconnect-chartdesigner *, .ant-picker, .ant-picker-time-panel-cell-inner';
    const WAIT_FOR_DBLCLICK_SELECTORS = '.bc-allow-dblclick-selection, .bc-allow-dblclick-selection *';

    return defineComponent(ClipboardManager);

    /**
     * Manages clipboard events
     */
    function ClipboardManager() {

        this.after('initialize', function() {
            var self = this;

            this.on('applicationReady currentUserBCDataUpdated', _.once(function() {
                require(['rangy-core', 'rangy-text', 'rangy-highlighter'], function(rangy) {
                    if (!rangy.initialized) rangy.init();
                });
            }));

            // Fullscreen view isn't loaded yet but this isn't needed
            // if it will be
            if (/^#?v=/.test(window.location.hash)) {
                return;
            }

            this.textarea = $('<textarea class="clipboardManager" autocomplete="false" spellcheck="false" />')
                .css({
                    position: 'absolute',
                    zIndex: 10,
                    cursor: 'pointer',
                    top: '-300px',
                    height: '10px',
                    boxSizing: 'border-box'
                })
                .on({
                    cut: this.onCut.bind(this),
                    copy: this.onCopy.bind(this),
                    paste: this.onPaste.bind(this),
                    keydown: this.onKeyDown.bind(this),
                    keyup: this.onKeyDown.bind(this)
                })
                .appendTo(document.body);

            this.on('click', this.onClick);
            this.on('dblclick', this.onClick);
            this.on('clipboardClear', this.clear);
            this.on('clipboardSet', this.set);
            this.on('clipboardFocus', this.focus);
        });

        this.onKeyDown = function(event) {
            this.textarea.val(this.lastSetData && this.lastSetData.text || '').focus().select();
        };

        this.focus = function() {
            this.textarea.focus();
        };

        this.set = function(event, data) {
            this.lastSetData = data;
            this.textarea.val(data && data.text || '').focus().select();
        };

        this.clear = function() {
            this.lastSetData = null;
            this.textarea.val('');
        };

        this.onPaste = function(event) {
            var self = this;
            _.defer(function() {
                require(['util/vertex/urlFormatters'], function(F) {
                    var textarea = self.textarea,
                        val = textarea.val(),
                        parameters = F.vertexUrl.parametersInUrl(val),
                        vertices = parameters && parameters.vertexIds && parameters.vertexIds.length || 0,
                        edges = parameters && parameters.edgeIds && parameters.edgeIds.length || 0,
                        total = vertices + edges;

                    console.debug('Clipboard: Paste', val);

                    self.trigger('clipboardPaste', {data: val});
                    self.lastSetData = null;
                    textarea.val('').focus();

                    if (total === 1) {
                        self.trigger('displayInformation', {message: i18n('element.clipboard.paste.one')});
                    } else if (total > 1) {
                        self.trigger('displayInformation', {
                            message: i18n('element.clipboard.paste.some', total)
                        });
                    }
                });
            });
        };

        this.onCopy = function() {
            console.debug('Clipboard: Copy', this.textarea.val());

            var self = this,
                val = this.textarea.val();

            if (val.length) {
                require(['util/vertex/urlFormatters'], function(F) {
                    var parameters = F.vertexUrl.parametersInUrl(val),
                        vertices = parameters && parameters.vertexIds && parameters.vertexIds.length || 0,
                        edges = parameters && parameters.edgeIds && parameters.edgeIds.length || 0,
                        total = vertices + edges;

                    if (total === 1) {
                        self.trigger('displayInformation', { message: i18n('element.clipboard.copy.one') });
                    } else if (total > 1) {
                        self.trigger('displayInformation', {
                            message: i18n('element.clipboard.copy.some', total)
                        });
                    } else if (!total) {
                        self.trigger('displayInformation', { message: i18n('clipboard.copy') });
                    }
                })
            }
        };

        this.onCut = function() {
            var val = this.textarea.val();
            console.debug('Clipboard: Cut', val);
            this.trigger('clipboardCut', { data: val });
        };

        this.onClick = function(event) {
            const $target = $(event.target);

            if ($target.is(IGNORE_SELECTORS)) {
                return;
            }

            if ($target.is(WAIT_FOR_DBLCLICK_SELECTORS)) {
                this.waitForDblClick(event);
                return;
            }

            if (event.type === 'dblclick') {
                return;
            }

            this.returnFocus(event.target)
        };

        this.waitForDblClick = function(event) {
            const { target, timeStamp } = event;
            const cleanup = () => {
                if (this._dblClickTimer) {
                    clearTimeout(this._dblClickTimer);
                    this._dblClickTimer = null;
                }
                this.previousTimestamp = null;
            }
            const selection = getSelection();

            if (event.type === 'dblclick') {
                cleanup();
                if (selection.isCollapsed) {
                    this.returnFocus(target)
                }
            } else if (!this.previousTimestamp) {
                this.previousTimestamp = timeStamp;
                this._dblClickTimer = _.delay(() => {
                    this.returnFocus(target);
                    cleanup();
                }, 250);
            }
        };

        this.returnFocus = function(target) {
            var inFocus = $(':focus');
            // Check for previous focus, since we are going to steal it to
            // support browser cut/copy/paste events
            if (inFocus.length) {
                this.trigger(inFocus[0], 'focusLostByClipboard');
            } else {
                this.trigger(target, 'focusLostByClipboard');
            }

            if (getSelection().isCollapsed === false) return;

            this.focus();
        };

    }
});
