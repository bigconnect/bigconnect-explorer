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
    'util/domElement'
], function(defineComponent, domElement) {
    'use strict';

    return defineComponent(FlexLayout);

    function FlexLayout() {

        this.attributes({
            layoutConfig: null,
            children: null
        });

        this.before('teardown', function() {
            syncStyles(this.node, null, { container: true });
            _.toArray(this.node.children).forEach(function(el) {
                syncStyles(el, null, { item: true });
            })
        })

        this.after('initialize', function() {

            this.on('updateLayout', function(event, data) {
                if (event.target === this.node) {
                    this.renderChildren(data.layoutConfig, data.children);
                }
            })

            this.renderChildren(this.attr.layoutConfig, this.attr.children);
        });

        this.renderChildren = function(layoutConfig, children) {
            var styling = calculateStyles(layoutConfig)
            syncStyles(this.node, styling, { container: true });

            // Adding new children not in DOM
            while (this.node.childElementCount < children.length) {
                var child = children[this.node.childElementCount]
                this.node.appendChild(child.element)
            }

            // Removing children that shouldn't be in DOM
            while (this.node.childElementCount > children.length) {
                this.node.removeChild(this.node.children[this.node.childElementCount - 1])
            }

            _.toArray(this.node.children).forEach(function(el, i) {
                var child = children[i],
                    style = child.configuration.style;

                syncStyles(el, transformStyle(style), { item: true });
            })
        };
    }

    function syncStyles(el, newStyles, options) {
        var styles = newStyles || {},
            toRemove = (options.container ?
                'flexDirection flexWrap display flexFlow justifyContent alignItems alignContent' :
                'order alignSelf flex flexGrow flexShrink flexBasis'
            ).split(' ');
        _.keys(el.style).forEach(function(name) {
            if (!(name in styles)) {
                if (_.contains(toRemove, name)) {
                    domElement.removeStyles(el, name);
                }
            }
        })

        if (newStyles) {
            $(el).css(newStyles);
        }
    }

    function transformStyle(css) {
        if (!css || !_.isObject(css)) {
            return;
        }
        // If it's an int, it can cause browsers issues
        if (css.flex) {
            css.flex = String(css.flex);
        }
        return css;
    }

    function calculateStyles(override) {
        return _.chain({
                flexDirection: 'column',
                display: 'flex'
            })
            .extend(_.chain(override)
                .map(function(value, key) {
                    return ['flex' + key.substring(0, 1).toUpperCase() + key.substring(1), value];
                })
                .object()
                .value()
            )
            .value()
    }
});
