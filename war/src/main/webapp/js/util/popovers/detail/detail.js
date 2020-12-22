
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
    '../withPopover',
    'util/vertex/formatters',
    'util/withDataRequest'
], function(
    defineComponent,
    withPopover,
    F,
    withDataRequest) {
    'use strict';

    return defineComponent(DetailPopover, withPopover, withDataRequest);

    function DetailPopover() {

        this.defaultAttrs({
            addButtonSelector: '.btn-primary',
            cancelButtonSelector: '.btn-default',
            zoomWithGraph: true
        });

        this.before('teardown', function() {
            this.trigger('closePreviewVertex', { vertexId: this.attr.vertexId })
        });

        this.after('teardown', function() {
            this.$node.remove();
        })

        this.before('initialize', function(node, config) {
            config.template = 'detail/template';
            config.teardownOnTap = false;
            config.hideDialog = true;
            config.keepInView = false;

            this.after('setupWithTemplate', function() {
                var self = this;

                // Make even with graph so below panes
                this.dialog.css({
                    'z-index': 50,
                    'pointer-events': 'none'
                });
                this.popover.css({
                    padding: 0,
                    'border-radius': '3px',
                    border: 'none'
                })
                this.popover.find('.popover-content').css({
                    'border-radius': '3px'
                });

                this.popover.find('.close-popover').css('pointer-events', 'all').on('click', function() {
                    self.teardown();
                })

                this.on('show', function() {
                    this.dialog.show();
                })
                this.on('hide', function() {
                    this.dialog.hide();
                })

                this.load()
                    .then(this.done.bind(this))
                    .catch(this.fail.bind(this));
            });
        });

        this.load = function() {
            if (this.attr.vertexId) {
                return this.dataRequest('vertex', 'store', { vertexIds: this.attr.vertexId });
            } else {
                return this.dataRequest('edge', 'store', { edgeIds: this.attr.edgeIds })
                    .then(function(elements) {
                        if (elements.length === 1) {
                            return elements[0];
                        }
                        return elements;
                    });
            }
        };

        this.fail = function() {
            var self = this;
            Promise.require('tpl!util/alert').then(function(alertTemplate) {
                self.popover.find('.popover-content')
                    .html(alertTemplate({ error: i18n('popovers.preview_vertex.error') }));
                self.dialog.css('display', 'block');
                self.positionDialog();
            })
        };

        this.done = function(element) {
            var self = this,
                $node = this.popover.find('.popover-content .type-content');

            $node.on('finishedLoadingTypeContent errorLoadingTypeContent', function() {
                self.dialog.css('display', 'block');
                self.positionDialog();
            });
            require(['detail/item/item'], function(Item) {
                Item.attachTo($node, {
                    model: element,
                    constraints: ['width', 'height'],
                    context: 'popup'
                });
            })
        };

    }
});
