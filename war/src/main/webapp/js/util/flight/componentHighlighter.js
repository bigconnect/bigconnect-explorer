
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
define(['flight/lib/registry'], function(registry) {
    'use strict';

    var highlighter = $('<div>')
        .addClass('component-highlighter')
        .css({
        })
        .appendTo(document.body)

    return {
        highlightComponents: function(enable) {
            var $doc = $(document).off('.highlightcomps');
            highlighter.hide();
            if (enable) {
                $doc.on('mouseover.highlightcomps', _.debounce(mouseover, 50))
            }
        }
    };

    function eventsFromComponentInstances(instances) {
        var events = [];
        Object.keys(instances).forEach(function(identifier) {
            var instanceInfo = instances[identifier];
            instanceInfo.events.forEach(function(event) {
                events.push(event.type);
            })
        })
        events = _.chain(events)
           .unique()
           .sortBy(function(e) {
               return e;
           })
           .value();

        return events;
    }

    function nameFromComponent(component) {
        return component.toString()
            .split(/\s*,\s*/)
            .filter(n => !/^with/.test(n))
            .sort()
            .join(',')
    }

    function logComponent(name, closestComponent) {
        var events = eventsFromComponentInstances(closestComponent.info.instances);

        console.groupCollapsed('Found Component: ' + name);
        /*eslint no-lone-blocks:0*/
        {
            console.groupCollapsed('Listens for events');
            {
                console.log(events.join(', '))
            }
            console.groupEnd();

            console.groupCollapsed('Bound to Node');
            {
                console.log(closestComponent.node)
            }
            console.groupEnd();

            console.groupCollapsed('Flight Component Info');
            {
                console.log(closestComponent.info)
            }
            console.groupEnd();
        }
        console.groupEnd();
    }

    function highlightNode(node, name) {
        var $node = $(node),
            position = $node.offset();

        if (position) {
            var height = $node.outerHeight() || $node.parent().outerHeight();

            highlighter.attr('data-name', name);
            highlighter.css({
                left: Math.round(position.left) + 'px',
                top: Math.round(position.top) + 'px',
                width: $node.outerWidth(),
                height: $node.outerHeight() || $node.parent().outerHeight()
            }).show();
        }
    }

    function mouseover(event) {
        var closestComponent,
            shortestSteps = Number.MAX_VALUE;

        highlighter.hide();

        registry.components.forEach(function(componentInfo) {
            componentInfo.attachedTo.forEach(function(node) {
                Object.keys(componentInfo.instances).forEach(function(identifier) {
                    var instanceInfo = componentInfo.instances[identifier];
                    if (instanceInfo.instance.popover) {
                        node = instanceInfo.instance.popover[0];
                    }
                })
                var walkNode = event.target,
                    found = false,
                    steps = 0;

                while (walkNode) {
                    if (walkNode === node) {
                        found = true;
                        break;
                    }
                    walkNode = walkNode.parentNode;
                    steps++;
                }

                if (found && steps < shortestSteps) {
                    shortestSteps = steps;
                    closestComponent = {
                        info: componentInfo,
                        node: node,
                        steps: steps
                    };
                }
            })
        })

        if (closestComponent) {
            var name = nameFromComponent(closestComponent.info.component);

            logComponent(name, closestComponent);

            highlightNode(closestComponent.node, name);
        }
    }
});
