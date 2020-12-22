
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

    return withVertexPopover;

    function withVertexPopover() {

        this.before('teardown', function() {
            this.attr.cy.removeListener('pan zoom position', this.onViewportChanges);
            this.attr.cy.removeListener('tap', this.onTap);
        });

        this.after('teardown', function() {
            if (this.dialog) {
                this.dialog.remove();
            }
        })

        this.after('initialize', function() {
            if (!this.attr.cy) throw new Error('cy attr required');
            if (!this.attr.cyNode || this.attr.cyNode.length !== 1) {
                throw new Error('cyNode attr required: ' + this.attr.cyNode);
            }

            this.onViewportChanges = _.throttle(this.onViewportChanges.bind(this), 1000 / 30);
            this.onTap = this.onTap.bind(this);

            if (!_.isFunction(this.getTemplate)) {
                throw new Error('Implementations should define getTemplate')
            }
            this.getTemplate().then(this.setupWithTemplate.bind(this));
        });

        this.setupWithTemplate = function(tpl) {
            this.dialog = $('<div class="dialog-popover">')
                .css({position: 'absolute'})
                .html(tpl(this.attr))
                .appendTo(this.$node);

            this.popover = this.dialog.find('.popover');

            this.attr.cy.on('pan zoom position', this.onViewportChanges);
            this.attr.cy.on('tap', this.onTap);
            this.onViewportChanges();

            this.positionDialog();
            if (this.popoverInitialize) {
                this.popoverInitialize();
            }
        };

        this.onTap = function() {
            if (this.attr.teardownOnTap !== false) {
                this.teardown();
            }
        };

        this.onViewportChanges = function() {
            if (!this.ignoreViewportChanges) {
                this.dialogPosition = this.attr.cyNode.renderedPosition();
                this.dialogPosition.y -= this.attr.cyNode.height() / 2 * this.attr.cy.zoom();
                this.positionDialog();
            }
        };

        this.positionDialog = function() {
            var width = this.popover.outerWidth(true),
                height = this.popover.outerHeight(true),
                proposed = {
                    left: Math.max(0, Math.min(this.$node.width() - width, this.dialogPosition.x - (width / 2))),
                    top: Math.max(0, Math.min(this.$node.height() - height, this.dialogPosition.y - height))
                };

            this.dialog.css(proposed);
            this.popover.show();
        }
    }
});
