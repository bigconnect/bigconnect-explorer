
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
    'util/component/attacher'
], function(defineComponent, withPopover, attacher) {
    'use strict';

    return defineComponent(ExportWorkspace, withPopover);

    function ExportWorkspace() {

        this.defaultAttrs({
            cancelButtonSelector: 'button.btn-default'
        });

        this.before('teardown', function() {
            this.popover.find('.plugin-content').teardownAllComponents();
        });

        this.before('initialize', function(node, config) {
            config.template = 'exportWorkspace/template';
            config.showTitle = config.exporter.showPopoverTitle !== false;
            config.showCancel = config.exporter.showPopoverCancel !== false;
            config.title = i18n('popovers.export_workspace.title', config.exporter.menuItem);
            config.hideDialog = true;

            this.after('setupWithTemplate', function() {
                var self = this,
                    node = this.popover.find('.plugin-content'),
                    workspaceId = this.attr.workspaceId,
                    productId = this.attr.productId,
                    exporter = this.attr.exporter;

                this.on(this.popover, 'click', {
                    cancelButtonSelector: this.onCancel
                });

                var self = this;

                require([exporter.componentPath], function(C) {
                    var attrs = {
                        workspaceId,
                        productId,
                        exporter,
                        cy: self.attr.cy,
                        success: function() {
                            self.onCancel();
                        }
                    };

                    if (_.isFunction(exporter.attributes)) {
                        attrs = exporter.attributes(attrs);
                    }

                    /**
                     * If the exporter extension configuration includes an
                     * `attributes` function, all those attributes will be
                     * available as well.
                     *
                     * @typedef org.bigconnect.graph.export~Exporter
                     * @property {string} workspaceId
                     * @property {string} productId
                     * @property {object} exporter
                     * @property {object} cy The cytoscape object
                     */

                    self.attacher = attacher()
                        .node(node)
                        .component(C)
                        .params(attrs);

                    self.attacher.attach();

                    self.dialog.show();
                    self.positionDialog();
                });
            });

            this.onCancel = function() {
                this.attacher.teardown();
                this.attacher = null;
                this.teardown();
            }
        });
    }
});
