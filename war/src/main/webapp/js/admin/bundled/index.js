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
    'configuration/plugins/registry'
], function(registry) {
    'use strict';

    var adminExtensionPoint = 'org.bigconnect.admin';

    registry.registerExtension(adminExtensionPoint, {
        componentPath: 'admin/bundled/uiExtensionList/index',
        section: 'Plugin',
        name: 'UI Extensions',
        subtitle: 'Extensions Available / Usages'
    });

    registry.registerExtension(adminExtensionPoint, {
        componentPath: 'admin/bundled/pluginList/PluginList',
        section: 'Plugin',
        name: 'List',
        subtitle: 'Loaded plugins'
    });

    registry.registerExtension(adminExtensionPoint, {
        componentPath: 'admin/bundled/users/UserManager',
        section: 'Security',
        name: 'Users',
        subtitle: 'Manage Users'
    });

    registry.registerExtension(adminExtensionPoint, {
        componentPath: 'admin/bundled/roles/RoleManager',
        section: 'Security',
        name: 'Roles',
        subtitle: 'Manage Roles'
    });

    registry.registerExtension(adminExtensionPoint, {
        componentPath: 'admin/bundled/notifications/list',
        section: 'System Notifications',
        name: 'List',
        subtitle: 'View all Notifications'
    });

    registry.registerExtension(adminExtensionPoint, {
        componentPath: 'admin/bundled/ontology-manager/properties/PropertiesList',
        section: 'Schema',
        name: 'Properties',
        subtitle: 'Manage Properties'
    });

    registry.registerExtension(adminExtensionPoint, {
        componentPath: 'admin/bundled/ontology-manager/concepts/ConceptList',
        section: 'Schema',
        name: 'Concepts',
        subtitle: 'Manage Concepts'
    });

    registry.registerExtension(adminExtensionPoint, {
        componentPath: 'admin/bundled/ontology-manager/relationships/RelationshipList',
        section: 'Schema',
        name: 'Relationships',
        subtitle: 'Manage relationships'
    });

    registry.registerExtension(adminExtensionPoint, {
        componentPath: 'admin/bundled/behaviour/BehaviourManager',
        section: 'Behaviour',
        name: 'Manage',
        subtitle: 'Manage Behaviours'
    });

    registry.registerExtension(adminExtensionPoint, {
        componentPath: 'admin/bundled/regex/RegexManager',
        section: 'Extract',
        name: 'Regex',
        subtitle: 'Manage Regex Expressions'
    });

    registry.registerExtension(adminExtensionPoint, {
        componentPath: 'admin/bundled/data/delete/DeleteData',
        section: 'Data',
        name: 'Delete',
        subtitle: 'Delete elements identified by a saved search'
    });
})
