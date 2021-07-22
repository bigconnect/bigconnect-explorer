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
    'configuration/plugins/registry',
    'util/popovers/withPopover',
    'util/component/attacher'
], function (
    defineComponent,
    registry,
    withPopover,
    Attacher) {
    'use strict';

    const reportConfigurationPath = 'dashboard/configs/report';

    var reportRenderers = registry.extensionsForPoint('org.bigconnect.web.dashboard.reportrenderer'),
        extensions = registry.extensionsForPoint('org.bigconnect.web.dashboard.item');

    return defineComponent(ConfigPopover, withPopover);

    function ConfigPopover() {

        this.before('teardown', function () {
            this.components.forEach(attacher => {
                attacher.teardown()
            });
            this.$node.closest('.card-toolbar').removeClass('active');
        })

        this.before('initialize', function (node, config) {
            config.template = '/dashboard/configureTpl.hbs';
            var paths = config.configurationPaths || [],
                extension = _.findWhere(extensions, {identifier: config.item.extensionId}),
                report = config.item.configuration.report || extension.report,
                addDefaultConfiguration = !extension.options ||
                    extension.options.preventDefaultConfig !== true;
            config.teardownOnTap = !extension.noTeardownOnTap;
            this.extension = extension;
            this.components = [];

            if (extension.configurationPath) {
                /**
                 * FlightJS or React component that renders card configuration
                 * content.
                 *
                 * For Flight, `trigger` an event with the name of the
                 * function instead of invoking directly.
                 *
                 * @typedef org.bigconnect.dashboard.item~ConfigComponent
                 * @property {object} extension
                 * @property {object} item
                 * @property {object} [report]
                 * @property {org.bigconnect.dashboard.item~configurationChanged} configurationChanged Change the configuration
                 */
                paths.push(extension.configurationPath);
            }

            if (report) {
                paths.push(reportConfigurationPath);
            }

            if (addDefaultConfiguration) {
                paths.splice(0, 0, 'dashboard/configs/default');
            }

            config.empty = paths.length === 0;

            this.after('setupWithTemplate', function () {
                var self = this,
                    item = this.attr.item;

                this.$node.closest('.card-toolbar').addClass('active');
                this.on(this.popover, 'redirectEventToItem', function (event, data) {
                    this.$node.closest('.grid-stack-item').find('.item-content').trigger(data.name, data.data);
                });
                this.on(this.$node.closest('.grid-stack-item').find('.item-content'), 'redirectEventToConfiguration', function (event, data) {
                    this.popover.find('.popover-content > div').trigger(data.name, data.data);
                })
                this.on(this.popover, 'configurationChanged', this.onConfigurationChanged);
                this.renderConfigurations(paths);
            });
        });

        this.onConfigurationChanged = function (event, data) {
            this.trigger('configurationChanged', data);

            if (data.options && data.options.changed === 'item.title') return;

            var extension = this.extension,
                reportAdded = data.item.configuration.report || extension.report,
                reportRemoved = !data.item.configuration.report && !extension.report;

            this.attr.item = data.item;

            if (reportAdded) {
                this.teardownConfigPath(reportConfigurationPath);
                this.renderConfigurations([reportConfigurationPath]).then(() => this.updateComponents(data));
            } else if (reportRemoved) {
                this.teardownConfigPath(reportConfigurationPath);
                this.updateComponents(data);
            } else {
                this.updateComponents(data);
            }
        };

        this.updateComponents = function (data) {
            this.components.forEach((attacher) => {
                attacher.params(data).attach({
                    teardown: true,
                    teardownOptions: {
                        react: false
                    }
                });
            });
        };

        this.teardownConfigPath = function (path) {
            this.components = _.chain(this.components)
                .map((attacher) => {
                    if (attacher.path() === path) {
                        attacher.teardown();
                        attacher.node().remove()
                        return null;
                    } else {
                        return attacher;
                    }
                })
                .compact()
                .value();
        }

        this.renderConfigurations = function (paths) {
            const item = this.attr.item,
                self = this,
                root = this.popover.find('.popover-content');

            Promise.map(paths, (path) => {
                const node = $('<div>').data('path', path).appendTo(root);

                return Attacher().node(node)
                    .path(path)
                    .params({
                        extension: this.extension,
                        report: item.configuration.report || this.extension.report,
                        item: item,
                        parentNode: self.$node
                    })
                    .behavior({
                        configurationChanged: (attacher, data) => {
                            this.onConfigurationChanged(null, data);
                        },
                        close: (attacher) => {
                            attacher.teardown();
                            self.teardown();
                        }
                    })
                    .attach();
            }).then((components) => {
                this.components.push(...components);
                this.positionDialog();
            });
        };

    }
});

