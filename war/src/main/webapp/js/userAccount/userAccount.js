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
    './pageList.hbs',
    'util/component/attacher',
    'util/requirejs/promise!util/service/propertiesPromise'
], function(
    defineComponent,
    listTemplate,
    Attacher,
    config) {
    'use strict';

    const PROFILE_EXTENSION_PAGE = {
        identifier: 'profile',
        pageComponentPath: 'userAccount/bundled/profile/profile'
    };

    const ACCESS_EXTENSION_PAGE = {
            identifier: 'access',
            pageComponentPath: 'userAccount/bundled/access/Access'
    };

    const SETTINGS_EXTENSION_PAGE = {
        identifier: 'settings',
        pageComponentPath: 'userAccount/bundled/settings/Settings'
    };

    const WATCHES_EXTENSION_PAGE = {
        identifier: 'watches',
        pageComponentPath: 'userAccount/bundled/watches/watches'
    };

    return defineComponent(UserAccount);

    function UserAccount() {

        this.defaultAttrs({
            listSelector: '.modal-body > .nav',
            listItemSelector: '.modal-body > .nav li a',
            pageSelector: '.modal-body > .page'
        });

        this.after('teardown', function() {
            this.$node.remove();
        });

        this.after('initialize', function() {
            var self = this;

            this.on('hidden', this.teardown);

            this.on('click', {
                listItemSelector: this.onChangePage
            });

            require(['configuration/plugins/registry'], function(registry) {
                registry.documentExtensionPoint('org.bigconnect.user.account.page',
                    'Add new tabs to user account modal dialog',
                    function(e) {
                        return ('identifier' in e) && ('pageComponentPath' in e);
                    },
                    'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/user-profile-section'
                );

                var pages = registry.extensionsForPoint('org.bigconnect.user.account.page');
                if (!_.findWhere(pages, { identifier: SETTINGS_EXTENSION_PAGE.identifier })) {
                    registry.registerExtension('org.bigconnect.user.account.page', SETTINGS_EXTENSION_PAGE);
                    pages.push(SETTINGS_EXTENSION_PAGE);
                }

                if (!_.findWhere(pages, { identifier: ACCESS_EXTENSION_PAGE.identifier })) {
                    registry.registerExtension('org.bigconnect.user.account.page', ACCESS_EXTENSION_PAGE);
                    pages.push(ACCESS_EXTENSION_PAGE);
                }

                if (!_.findWhere(pages, { identifier: PROFILE_EXTENSION_PAGE.identifier })) {
                    registry.registerExtension('org.bigconnect.user.account.page', PROFILE_EXTENSION_PAGE);
                    pages.push(PROFILE_EXTENSION_PAGE);
                }

                const enableWatcher = config['watcher.enabled'] || "false";
                if (enableWatcher === 'true') {
                    if (!_.findWhere(pages, {identifier: WATCHES_EXTENSION_PAGE.identifier})) {
                        registry.registerExtension('org.bigconnect.user.account.page', WATCHES_EXTENSION_PAGE);
                        pages.push(WATCHES_EXTENSION_PAGE);
                    }
                }

                self.select('listSelector').html(
                    listTemplate({
                        pages: _.chain(pages)
                            .map(function(page) {
                                page.displayName = i18n('useraccount.page.' + page.identifier + '.displayName');
                                return page;
                            })
                            .sortBy('displayName')
                            .value()
                    })
                ).find('a').eq(0).trigger('click');
            });
        });

        this.onChangePage = function(event) {
            var componentPath = $(event.target).closest('li')
                    .siblings('.active').removeClass('active').end()
                    .addClass('active')
                    .data('componentPath'),
                container = this.select('pageSelector').teardownAllComponents();

            if (this._attacher) {
                this._attacher.teardown();
            }

            this._attacher = Attacher()
                .node(container)
                .path(componentPath);

            this._attacher.attach();
        };

    }
});
