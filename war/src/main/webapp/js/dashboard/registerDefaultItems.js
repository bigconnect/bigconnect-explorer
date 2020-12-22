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
define(['configuration/plugins/registry'], function(registry) {
    'use strict';

    registry.registerExtension('org.bigconnect.web.dashboard.item', {
        title: i18n('dashboard.savedsearches.title'),
        description: i18n('dashboard.savedsearches.description'),
        identifier: 'org-bigconnect-web-saved-search',
        componentPath: 'dashboard/items/savedSearch/savedSearch',
        configurationPath: 'dashboard/items/savedSearch/configure',
        grid: {
            width: 4,
            height: 4
        }
    });

    registry.registerExtension('org.bigconnect.web.dashboard.item', {
        title: i18n('dashboard.notifications.title'),
        description: i18n('dashboard.notifications.description'),
        identifier: 'org-bigconnect-web-notifications',
        componentPath: 'notifications/dashboardItem',
        grid: {
            width: 3,
            height: 3
        }
    });

    registry.registerExtension('org.bigconnect.web.dashboard.toolbar.item', {
        identifier: 'org-bigconnect-notification-clear-all',
        canHandle: function(options) {
            return options.extension.identifier === 'org-bigconnect-web-notifications'
        },
        tooltip: i18n('dashboard.notifications.clearall.hover'),
        icon: 'img/trash.png',
        action: {
            type: 'event',
            name: 'notificationClearAll'
        }
    });

    registry.registerExtension('org.bigconnect.web.dashboard.item', {
        title: i18n('dashboard.pie.entity.title'),
        description: i18n('dashboard.pie.entity.description'),
        identifier: 'org-bigconnect-web-dashboard-concept-counts',
        report: {
            defaultRenderer: 'org-bigconnect-pie',
            endpoint: '/vertex/search',
            endpointParameters: {
                q: '*',
                size: 0,
                filter: '[]',
                aggregations: [
                    {
                        type: 'term',
                        name: 'field',
                        field: '__conceptType'
                    }
                ].map(JSON.stringify)
            }
        },
        grid: {
            width: 4,
            height: 2
        }
    });

    registry.registerExtension('org.bigconnect.web.dashboard.item', {
        title: i18n('dashboard.pie.edge.title'),
        description: i18n('dashboard.pie.edge.description'),
        identifier: 'org-bigconnect-web-dashboard-edge-counts',
        report: {
            defaultRenderer: 'org-bigconnect-pie',
            endpoint: '/edge/search',
            endpointParameters: {
                q: '*',
                size: 0,
                filter: '[]',
                aggregations: [
                    {
                        type: 'term',
                        name: 'field',
                        field: ONTOLOGY_CONSTANTS.EDGE_LABEL
                    }
                ].map(JSON.stringify)
            }
        },
        grid: {
            width: 4,
            height: 2
        }
    });

    registry.registerExtension('org.bigconnect.web.dashboard.item', {
        title: i18n('dashboard.welcome.title'),
        description: i18n('dashboard.welcome.description'),
        identifier: 'org-bigconnect-web-dashboard-welcome',
        componentPath: 'dashboard/items/welcome/welcome',
        options: {
            preventDefaultConfig: true
        },
        grid: {
            width: 6,
            height: 8
        }
    });

    registry.registerExtension('org.bigconnect.web.dashboard.item', {
        title: 'Search Results',
        description: 'Display tabular saved search results',
        identifier: 'org-bigconnect-saved-search-table',
        componentPath: 'dashboard/items/table/card/SavedSearchTableContainer',
        configurationPath: 'dashboard/items/table/card/Config',
        grid: {
            width: 8,
            height: 4
        }
    });

    registry.registerExtension('org.bigconnect.web.dashboard.item', {
        title: 'Behaviour',
        description: 'Run a behaviour',
        identifier: 'org-bigconnect-web-behaviour',
        componentPath: 'dashboard/items/behaviour/behaviour',
        configurationPath: 'dashboard/items/behaviour/configure',
        grid: {
            width: 4,
            height: 4
        }
    });

    registry.registerExtension('org.bigconnect.web.dashboard.item', {
        title: 'Rich Text',
        description: 'Place rich text snippets',
        identifier: 'org-bigconnect-web-richtext',
        componentPath: 'dashboard/items/richtext/RichText',
        grid: {
            width: 4,
            height: 4
        }
    });

    registry.registerExtension('org.bigconnect.dashboard.toolbar.item', {
        identifier: 'rich-text-edit-btn',
        canHandle: function(options) {
            return options.extension.identifier === 'org-bigconnect-web-richtext'
        },
        tooltip: 'Edit contents',
        icon: '/img/glyphicons/glyphicons_151_edit.png',
        action: {
            type: 'event',
            name: 'editRichText'
        }
    });
})
