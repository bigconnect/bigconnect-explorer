
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

    return withElementScrollingPositionUpdates;

    function withElementScrollingPositionUpdates() {

        this.before('teardown', function() {
            this.removePositionUpdating();
        });

        this.after('initialize', function() {
            this.on('registerForPositionChanges', this.onRegisterForPositionChanges);
            this.on('unregisterForPositionChanges', this.onUnregisterForPositionChanges);
        });

        this.onRegisterForPositionChanges = function(event, data) {

            event.stopPropagation();

            let range = data.anchorTo && data.anchorTo.range;
            if (range) {
                range = range.cloneRange()
            }

            var self = this,
                $target = $(event.target),
                scroller = data && data.scrollSelector ?
                    $target.closest(data.scrollSelector) :
                    $target.scrollParent(),
                sendPositionChange = function() {
                    let position, width, height;
                    if (range) {
                        const rects = range.getClientRects();
                        let box;
                        if (rects.length) {
                            box = _.sortBy(rects, function(r) {
                                return r.top * -1;
                            })[0];
                        } else {
                            box = range.getBoundingClientRect();
                        }

                        width = box.width;
                        height = box.height;
                        const { left, top } = box;
                        position = { left, top };

                        if (scroller[0] === document) {
                            position.top += scroller.scrollTop();
                        }
                    } else {
                        width = $target.outerWidth();
                        height = $target.outerHeight();
                        position = $target.offset();
                        if ((width === 0 || height === 0) && _.isFunction(event.target.getBBox)) {
                            var box = event.target.getBBox();
                            width = box.width;
                            height = box.height;
                        }
                    }

                    const eventData = {
                        position: {
                            x: position.left + width / 2,
                            y: position.top + height / 2,
                            xMin: position.left,
                            xMax: position.left + width,
                            yMin: position.top,
                            yMax: position.top + height
                        }
                    };
                    if (data && data.anchorTo) {
                        eventData.anchor = data.anchorTo;
                    }
                    self.trigger(event.target, 'positionChanged', eventData);
                };

            this.positionChangeScroller = scroller;
            this.sendPositionChange = sendPositionChange;

            this.on(document, 'graphPaddingUpdated', sendPositionChange);
            scroller.on('scroll.positionchange', sendPositionChange);
            sendPositionChange();
        };

        this.onUnregisterForPositionChanges = function(event, data) {
            this.removePositionUpdating();
        };

        this.removePositionUpdating = function() {
            if (this.positionChangeScroller) {
                this.positionChangeScroller.off('.positionchange');
            }
            if (this.sendPositionChange) {
                this.off(document, 'graphPaddingUpdated', this.sendPositionChange);
            }
        }
    }
})
