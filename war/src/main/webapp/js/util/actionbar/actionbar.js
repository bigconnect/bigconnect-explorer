
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
    './actionbar.hbs'
], function(
    defineComponent,
    template
) {
    'use strict';

    var FPS = 1000 / 60,
        TOP_HIDE_THRESHOLD = 40,
        ALIGN_TO_TYPES = [
            'textselection',
            'node'
        ];

    return defineComponent(ActionBar);

    function ActionBar() {

        this.around('teardown', function(original) {
            this.$tip.hide();
            this[this.attr.alignTo + 'Teardown']();
            this.$node.tooltip('destroy');
            if (this.alreadyDisposed) {
                return;
            }
            original.call(this);
            this.alreadyDisposed = true;
        });

        this.after('initialize', function() {
            if (!this.attr.actions) {
                throw 'actions attribute required';
            }
            if (ALIGN_TO_TYPES.indexOf(this.attr.alignTo) === -1) {
                throw 'alignTo only supports ' + ALIGN_TO_TYPES.join(',');
            }

            this.$node.removeAttr('title');
            var tooltip = this.$node.tooltip({
                trigger: 'click',
                title: template({
                    actions: Object.keys(this.attr.actions).map(a => {
                        const action = this.attr.actions[a];
                        if (_.isString(action)) {
                            return { cls: '', event: action, name: a };
                        } else {
                            return {
                                cls: action.className || '',
                                event: action.event,
                                name: a,
                                style: action.style || ''
                            };
                        }
                    })
                }),
                placement: 'bottom',
                container: 'body',
                html: true
            });

            tooltip.tooltip('show');

            this.$tip = tooltip.data('bs.tooltip').$tip
                .addClass('actionbar ' + (this.attr.options && this.attr.options.className || ''))
                .on('click', '.actionbarbutton', this.onActionClick.bind(this));
            this.updatePosition = _.throttle(this[this.attr.alignTo + 'UpdatePosition'].bind(this), FPS);

            this[this.attr.alignTo + 'Initializer']();
            this.updatePosition();
            this.on(document, 'windowResize', this.updatePosition);

            var self = this;

            this.on(document, 'click', function() {
                _.defer(function() {
                    self.teardown();
                });
            });
        });

        this.onActionClick = function(event) {
            var $target = $(event.target).blur();

            this.trigger($target.data('event'));
            this.$tip.hide();
        };

        this.nodeUpdatePosition = function() {
            var offset = this.$node.offset(),
                width = this.$node.width(),
                height = this.$node.height();

            this.updateTipPositionWithDomElement(this.node, 'center');
        };

        this.nodeInitializer = function() {
            this.updatePositionOnScroll(this.node);
        };

        this.nodeTeardown = function() {
            this.scrollParent.off('.actionbar');
        };

        this.textselectionUpdatePosition = function() {
            var selection = getSelection(),
                range = selection.rangeCount > 0 && selection.getRangeAt(0);

            if (range) {
                this.updateTipPositionWithDomElement(range);
            } else this.teardown();
        };

        this.textselectionInitializer = function() {
            var selection = getSelection(),
                closest = selection.anchorNode.parentNode;

            this.updatePositionOnScroll(closest);
        };

        this.textselectionTeardown = function() {
            this.scrollParent.off('.actionbar');
        };

        this.updatePositionOnScroll = function(el) {

            // Reposition on scroll events
            this.scrollParent = $(el).scrollParent()
                .off('.actionbar')
                .on('scroll.actionbar', this.updatePosition);
        };

        this.updateTipPositionWithDomElement = function(el, alignment) {
            var box = null,
                rects = el.getClientRects();

            if (rects.length) {
                box = _.sortBy(rects, function(r) {
                    return r.top * -1;
                })[0];
            } else {
                box = el.getBoundingClientRect();
            }

            var windowScroll = $(window).scrollTop(), // for fullscreen view
                top = box.top + windowScroll,
                position = (alignment === 'center' && rects.length === 1) ?
                    box.left + box.width / 2 :
                    box.left + box.width,
                css = {
                    left: position - this.$tip.width() / 2,
                    top: top + box.height
                };

            if (this.attr.alignWithin) {
                var offset = this.attr.alignWithin.offset(),
                    width = this.attr.alignWithin.width(),
                    padding = parseInt(this.attr.alignWithin.css('padding-left')) * 2,
                    extraPadding = 3,
                    totalWidth = width + (isNaN(padding) ? 0 : padding),
                    tipWidth = this.$tip.width();

                css.left = Math.max(offset.left + extraPadding, css.left);
                css.left = Math.min(offset.left + totalWidth - tipWidth - extraPadding, css.left);
                var arrowPercent = (position - css.left) / tipWidth * 100;
                this.$tip.find('.tooltip-arrow').css('left', arrowPercent.toFixed(2) + '%');
            }

            var topThreshold = this.attr.hideTopThreshold || 0;
            css.opacity = top < topThreshold ? '0' : '1';

            this.$tip.css(_.each(css, function(value, key) {
                if (_.isNumber(value)) {
                    css[key] = Math.round(value);
                }
            }));
        };
    }
});
