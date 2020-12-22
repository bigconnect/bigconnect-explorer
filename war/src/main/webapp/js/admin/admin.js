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
    './template.hbs',
    'util/component/attacher',
    './bundled/index'
], function(
    defineComponent,
    registry,
    template,
    attacher) {
    'use strict';

    registry.documentExtensionPoint('org.bigconnect.admin',
        'Add admin tools to admin pane',
        function(e) {
            return (e.Component || e.componentPath || e.url) &&
                e.section && e.name && e.subtitle
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/admin'
    );

    var adminList = defineComponent(AdminList);

    adminList.getExtensions = function() {
        var userPrivileges = bcData.currentUser.privileges;
        return registry.extensionsForPoint('org.bigconnect.admin')
            .filter(function(extension) {
                if (_.isFunction(extension.requiredPrivilege)) {
                    if (!extension.requiredPrivilege(userPrivileges)) {
                        return false;
                    }
                } else if (!extension.requiredPrivilege) {
                    if (userPrivileges.indexOf('ADMIN') < 0) {
                        return false;
                    }
                } else {
                    if (userPrivileges.indexOf(extension.requiredPrivilege) < 0) {
                        return false;
                    }
                }
                return true;
            });
    };

    return adminList;

    function AdminList() {
        this.defaultAttrs({
            listSelector: '.admin-list',
            pluginItemSelector: '.admin-list > li a',
            formSelector: '.admin-form'
        });

        this.after('initialize', function() {
            this.loadingAdminExtension = Promise.resolve();
            this.on(document, 'showAdminPlugin', this.onShowAdminPlugin);
            this.on(document, 'didToggleDisplay', this.didToggleDisplay);
            this.on('click', {
                pluginItemSelector: this.onClickPluginItem
            });
            this.$node.html(template({}));
            this.update();
        });

        this.didToggleDisplay = function(event, data) {
            if (data.name === 'admin' && !data.visible) {
                this.$node.find('.admin-list .active').removeClass('active');
                this.loadingAdminExtension.cancel();
                var form = this.select('formSelector').hide().find('.content').removePrefixedClasses('admin_less_cls');
                attacher().node(form).teardown();
                form.empty();
            }
        };

        this.onClickPluginItem = function(event) {
            event.preventDefault();
            this.trigger('showAdminPlugin', $(event.target).closest('li').data('component'));
        };

        this.onShowAdminPlugin = function(event, data) {
            var self = this;

            if (data && data.name && data.section) {
                data.name = data.name.toLowerCase();
                data.section = data.section.toLowerCase();
            }

            var $adminListItem = this.select('listSelector').find('li').filter(function() {
                    return _.isEqual($(this).data('component'), data);
                }),
                container = this.select('formSelector'),
                form = container.find('.content');

            if ($adminListItem.hasClass('active')) {
                attacher().node(form).teardown();
                $adminListItem.removeClass('active');
                self.select('formSelector').hide();
                self.trigger(container, 'paneResized');
                return;
            }
            this.loadingAdminExtension.cancel();
            $adminListItem.addClass('active').siblings('.active').removeClass('active loading').end();

            var extension = _.find(adminList.getExtensions(), function(e) {
                    return e.name.toLowerCase() === data.name &&
                        e.section.toLowerCase() === data.section;
                });

            form.removePrefixedClasses('admin_less_cls');

            if (extension) {
                if (extension.url) {
                    window.open(extension.url, 'ADMIN_OPEN_URL');
                    container.hide();
                    self.trigger(document, 'paneResized');
                    _.delay(function() {
                        $adminListItem.removeClass('active');
                    }, 100)
                } else {
                    $adminListItem.addClass('loading');
                    var promise = attacher()
                        .node(form)
                        .component(extension.component)
                        .path(extension.componentPath)
                        .params(data)
                        .attach({ teardown: true, empty: true })
                        .then(function() {
                            self.trigger(container.show(), 'paneResized');
                        });

                    promise.finally(function() {
                        $adminListItem.removeClass('loading');
                    });
                    this.loadingAdminExtension = promise;
                }
            } else {
                this.trigger(container, 'paneResized');
            }
        };

        this.update = function() {
            var self = this,
                extensions = adminList.getExtensions();

            require(['d3'], function(d3) {
                d3.select(self.select('listSelector').get(0))
                    .selectAll('li')
                    .data(
                        _.chain(extensions)
                        .groupBy('section')
                        .pairs()
                        .sortBy(function(d) {
                            return d[0];
                        })
                        .each(function(d) {
                            d[1] = _.chain(d[1])
                                .sortBy('name')
                                .sortBy(function sortHint({ options }) {
                                    return options && Number.isInteger(options.sortHint) ?
                                        options.sortHint : Number.MAX_VALUE;
                                })
                                .value();
                        })
                        .flatten()
                        .value()
                    )
                    .call(function() {
                        this.exit().remove();
                        this.enter().append('li')
                            .attr('class', function(component) {
                                if (_.isString(component)) {
                                    return 'nav-header';
                                }
                            }).each(function(component) {
                                if (!_.isString(component)) {
                                    d3.select(this).append('a');
                                }
                            });

                        this.each(function(component) {
                            if (_.isString(component)) {
                                this.textContent = component;
                                return;
                            }

                            d3.select(this)
                                .attr('class', 'nav-section')
                                .attr('data-component', JSON.stringify(
                                    _.chain(component)
                                    .pick('section', 'name')
                                    .tap(function(c) {
                                        c.name = c.name.toLowerCase();
                                        c.section = c.section.toLowerCase();
                                    }).value()
                                ))
                                .select('a')
                                .call(function() {
                                    this.append('div')
                                        .attr('class', 'nav-list-title')
                                        .text(component.name);

                                    this.append('div')
                                        .attr('class', 'nav-list-subtitle')
                                        .attr('title', component.subtitle)
                                        .text(component.subtitle)
                                });
                        });
                    });
            });
        };
    }
});
