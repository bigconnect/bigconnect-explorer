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
define(['util/withFormFieldErrors'], function(withFormFieldErrors) {
    'use strict';

    function withDropdown() {

        withFormFieldErrors.call(this);

        this.defaultAttrs({
            cancelButtonSelector: '.btn.cancel'
        });

        this.open = function() {
            if (this.attr.disableDropdownFeatures) return;
            var self = this,
                node = this.$node,
                scrollParent = node.scrollParent(),
                syncScrollTop = true,
                scrollToNode = function(tempNode) {
                    var nodeEl = tempNode[0];
                    if (nodeEl.scrollIntoViewIfNeeded) {
                        nodeEl.scrollIntoViewIfNeeded();
                    } else if (nodeEl.scrollInfoView) {
                        nodeEl.scrollIntoView();
                    }
                    var scrollTop = scrollParent.scrollTop();
                    nodeEl.parentNode.removeChild(nodeEl);
                    requestAnimationFrame(function syncScroll() {
                        scrollParent.scrollTop(scrollTop);
                        if (syncScrollTop) {
                            requestAnimationFrame(syncScroll);
                        }
                    })
                };

            if (node.outerWidth() <= 0) {
                // Fix issue where dropdown is zero width/height
                // when opening dropdown later in detail pane when
                // dropdown is already open earlier in detail pane
                node.css({position: 'relative'});
                return _.defer(this.open.bind(this));
            }

            node.on(TRANSITION_END, function(e) {
                var oe = e.originalEvent || e;

                if (oe.target === self.node && oe.propertyName === 'height') {
                    syncScrollTop = false;
                    node.off(TRANSITION_END);
                    node.css({
                        transition: 'none',
                        height: 'auto',
                        width: '100%',
                        overflow: 'visible'
                    });
                    self.trigger('opened');
                }
            });
            var tempScrollTo = $('<div>')
                    .css({ height: outerHeight + 'px' })
                    .insertBefore(node);
            // Add placeholder node that doesn't animate height which
            // could confuse the browsers scrollTo logic
            scrollToNode(tempScrollTo);
        };

        this.after('teardown', function() {
            this.trigger('dropdownClosed');
            if (!this.attr.disableDropdownFeatures) {
                this.$node.closest('.text').removeClass('dropdown');
                this.$node.remove();
            }
        });

        this.buttonLoading = function(selector) {
            selector = selector || '.btn-primary';
            this.$node.find(selector).addClass('loading').prop('disabled', true);
        };

        this.clearLoading = function() {
            this.$node.find('.btn:disabled').removeClass('loading').prop('disabled', false);
        };

        this.manualOpen = function() {
            if (this.attr.manualOpen) {
                _.defer(this.open.bind(this));
                this.attr.manualOpen = false;
            }
        }

        this.after('initialize', function() {
            if (this.attr.disableDropdownFeatures) {
                this.on('click', {
                    cancelButtonSelector: function() {
                        this.trigger('closeDropdown');
                    }
                });
            } else {
                this.$node.closest('.text').addClass('dropdown');
                this.on('click', {
                    cancelButtonSelector: function() {
                        this.trigger('closeDropdown');
                        this.teardown();
                    }
                });
                if (!this.attr.manualOpen) {
                    _.defer(this.open.bind(this));
                }
            }
        });
    }

    return withDropdown;
});
