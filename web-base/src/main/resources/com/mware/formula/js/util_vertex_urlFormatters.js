
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

    var URL_TYPES = {
            FULLSCREEN: 'v',
            ADMIN: 'admin',
            REDIRECT: 'redirect',
            TOOLS: 'tools'
        },
        V = {
            url: function(vertices, workspaceId) {
                if (!workspaceId) {
                    workspaceId = bcData.currentWorkspaceId;
                }
                return window.location.href.replace(/#.*$/, '') +
                    '#v=' + _.map(vertices, function(v) {
                        if (_.isObject(v) && 'type' in v) {
                            if (v.type === 'extendedDataRow') {
                                return encodeURIComponent(v.id.elementType.toLowerCase().substring(0, 1) + v.id.elementId);
                            } else {
                                return encodeURIComponent(v.type.substring(0, 1) + v.id);
                            }
                        }
                        return encodeURIComponent(_.isString(v) ? v : v.id);
                    }).join(',') + (
                        workspaceId ? ('&w=' + encodeURIComponent(workspaceId)) : ''
                    )
            },

            fragmentUrl: function(vertices, workspaceId) {
                return V.url(vertices, workspaceId).replace(/^.*#/, '#');
            },

            isFullscreenUrl: function(url) {
                var toOpen = V.parametersInUrl(url);

                return toOpen &&
                    toOpen.type === 'FULLSCREEN' &&
                    ((toOpen.vertexIds && toOpen.vertexIds.length) ||
                    (toOpen.edgeIds && toOpen.edgeIds.length));
            },

            parametersInUrl: function(url) {
                var type = _.invert(URL_TYPES),
                    match = url.match(/#(v|admin|redirect|tools)=(.+?)(?:&w=(.*))?$/);

                if (match && match.length === 4) {
                    if (match[1] === URL_TYPES.ADMIN) {
                        var tool = match[2].split(':');
                        if (tool.length !== 2) {
                            return null;
                        }

                        return _.extend(_.mapObject({
                            section: tool[0],
                            name: tool[1]
                        }, function(v) {
                            return decodeURIComponent(v).replace(/\+/g, ' ');
                        }), { type: type[match[1]] });
                    }

                    if (match[1] === URL_TYPES.REDIRECT) {
                        return {
                            type: type[match[1]],
                            redirectUrl: match[2]
                        }
                    }

                    if (match[1] === URL_TYPES.TOOLS) {
                        var tools = _.uniq(match[2].trim().split(','));
                        var toolsWithOptions = _.object(tools.map(function(tool) {
                            var optionsIndex = tool.indexOf('&');
                            var name = tool;
                            var options = {};
                            if (optionsIndex > 0) {
                                name = tool.substring(0, optionsIndex);
                                options = unserialize(tool.substring(optionsIndex + 1)) || {};
                            }
                            if (match[3]) {
                                options.workspaceId = match[3];
                            }
                            return [name, options || {}]
                        }))

                        return {
                            type: type[match[1]],
                            tools: toolsWithOptions
                        };
                    }

                    var objects = _.map(match[2].split(','), function(v) {
                            return decodeURIComponent(v);
                        }),
                        data = _.chain(objects)
                            .groupBy(function(o) {
                                var match = o.match(/^(v|e).*/);
                                if (match) {
                                    if (match[1] === 'v') return 'vertexIds';
                                    if (match[1] === 'e') return 'edgeIds';
                                }
                                return 'vertexIds';
                            })
                            .mapObject(function(ids) {
                                return ids.map(function(val) {
                                    return val.substring(1);
                                });
                            })
                            .value();

                    return _.extend({ vertexIds: [], edgeIds: [] }, data, {
                        workspaceId: decodeURIComponent(match[3] || ''),
                        type: type[match[1]]
                    });
                }
                return null;
            }
    };

    return $.extend({}, { vertexUrl: V });


    function unserialize(str) {
      str = decodeURIComponent(str);
      var chunks = str.split('&'),
          obj = {};
      chunks.forEach(function(c) {
          var split = c.split('=', 2);
          obj[split[0]] = split[1];
      })
      return obj;
    }
});
