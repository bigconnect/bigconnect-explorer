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
define(['configuration/plugins/registry', 'util/promise'], function(registry) {
    'use strict';

    /**
     * Plugin to configure the user interface for displaying and editing visibility authorization strings.
     *
     * The visibility component requires two FlightJS components registered for viewing and editing:
     *
     * @param {string} editorComponentPath The path to {@link org.bigconnect.visibility~Editor} component
     * @param {string} viewerComponentPath The path to {@link org.bigconnect.visibility~Viewer} component
     */
    registry.documentExtensionPoint('org.bigconnect.visibility',
        'Implement custom interface for visibility display and editing',
        function(e) {
            return _.isString(e.editorComponentPath) ||
                _.isString(e.viewerComponentPath)
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/visibility'
    );

    var defaultVisibility = {
            editorComponentPath: 'util/visibility/default/edit',
            viewerComponentPath: 'util/visibility/default/view'
        },
        point = 'org.bigconnect.visibility',
        visibilityExtensions = registry.extensionsForPoint(point),
        components = {
            editor: undefined,
            viewer: undefined
        },
        setComponent = function(type, Component) {
            components[type] = Component;
        };


    if (visibilityExtensions.length === 0) {
        registry.registerExtension(point, defaultVisibility);
        visibilityExtensions = [defaultVisibility];
    }

    if (visibilityExtensions.length > 1) {
        console.warn('Multiple visibility extensions loaded', visibilityExtensions);
    }

    var promises = {
            editor: Promise.require(
                visibilityExtensions[0].editorComponentPath || defaultVisibility.editorComponentPath
            ).then(_.partial(setComponent, 'editor')),
            viewer: Promise.require(
                visibilityExtensions[0].viewerComponentPath || defaultVisibility.viewerComponentPath
            ).then(_.partial(setComponent, 'viewer'))
        },
        internalAttach = function(Component, node, attrs) {
            $(node).teardownComponent(Component);
            Component.attachTo(node, attrs);
        };

    return {
        attachComponent: function(type, node, attrs) {
            var promise;
            if (components[type]) {
                internalAttach(components[type], node, attrs);
                promise = Promise.resolve();
            } else {
                promise = promises[type].then(function(C) {
                    internalAttach(C, node, attrs);
                });
            }
            return promise;
        }
    };
});
