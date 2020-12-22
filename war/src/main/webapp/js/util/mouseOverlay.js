
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
    ],
    function(defineComponent) {
        'use strict';

        return defineComponent(MouseOverlay);

        function MouseOverlay() {

            this.after('initialize', function() {
                this.overlayNode = $(`
                <div class="tooltip fade right in">
                    <div class="tooltip-arrow"></div>
                    <div class="tooltip-inner">
                        <div class="message"></div>
                        <div class="subtitle"></div>
                    </div>
                </div>`)
                    .css('transform', '')
                    .hide()
                    .appendTo(document.body);

                this.transformProperty = $.cssProps.transform;
                this.textNode = this.overlayNode.find('.tooltip-inner');
                this.textNodeMessage = this.overlayNode.find('.message');
                this.textNodeSubtitle = this.overlayNode.find('.subtitle');

                var $win = $(window);
                this.position = [$win.width() / 2, $win.height() / 2];

                this.on('displayInformation', this.onDisplayInformation);
                this.on('hideInformation', this.onHideInformation);
                this.on('mousemove.displayInformation', this.onMouseMove);
                this.on(document, 'click', this.onClick);
            });

            this.hide = function() {
                clearTimeout(this.timeout);
                this.overlayNode.hide();
                this.tracking = false;
            };

            this.onClick = function() {
                this.hide();
            };

            this.onHideInformation = function(event, data) {
                this.hide();
            };

            /**
             * @options data.dismiss [click, auto]
             * @options data.dismissDuration default 2000
             */
            this.onDisplayInformation = function(event, data) {
                var self = this;

                if (data && 'position' in data && _.isArray(data.position) && data.position.length === 2) {
                    this.position = data.position;
                }

                clearTimeout(this.timeout);
                if (!this.position) return;

                this.tracking = true;
                this.textNode.css('text-align', data.subtitle ? 'left' : 'center');
                this.textNodeMessage
                    .css('font-weight', data.subtitle ? 'bold' : 'normal')
                    .text(data.message);
                if (data.subtitle) {
                    this.textNodeSubtitle.text(data.subtitle);
                } else {
                    this.textNodeSubtitle.empty();
                }
                this.overlayNode
                    .css('transform',
                        'translate(' + this.position[0] + 'px,' + this.position[1] + 'px)'
                    ).show();

                this.timeout = _.delay(function() {
                    self.overlayNode.hide();
                    self.tracking = false;
                }, data.dismissDuration || 2000);

                requestAnimationFrame(function align() {
                    if (self.tracking) {
                        if (self.mouseMoved) {
                            self.overlayNode[0].style[self.transformProperty] =
                                'translate(' + self.position[0] + 'px,' + self.position[1] + 'px)';
                            self.mouseMoved = false;
                        }
                        requestAnimationFrame(align);
                    }
                });
            };

            this.onMouseMove = function(event) {
                this.mouseMoved = true;
                this.position = [event.pageX + 10, event.pageY - 10];
            };
        }
    });
