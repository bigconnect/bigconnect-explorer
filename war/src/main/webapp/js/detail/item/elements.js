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
    'util/withDataRequest',
    './withItem'
], function(defineComponent, withDataRequest, withItem) {
    'use strict';

    return defineComponent(Elements, withDataRequest, withItem);

    function Elements() {

        this.attributes({
            model: null,
            ignoreUpdateModelNotImplemented: true,
            headerSelector: '.org-bigconnect-layout-elements-header',
            bodySelector: '.org-bigconnect-layout-elements-body',
            listSelector: '.org-bigconnect-layout-elements-list',
            singleSelector: '.org-bigconnect-layout-root'
        })

        this.after('initialize', function() {

            this.on(this.select('listSelector'), 'selectObjects', this.onSelectObjects);
            this.on(this.select('listSelector'), 'objectsSelected', this.onObjectsSelected);

            var self = this,
                $list = this.select('listSelector'),
                key = 'elements[].list',
                heightPreference = bcData.currentUser.uiPreferences['pane-' + key],
                originalHeight = heightPreference ?
                    parseInt(heightPreference, 10) :
                    Math.round($(window).height() * 0.3);

            $list.css({ height: originalHeight + 'px' }).attr('data-height-preference', key);
            createResizable($list);

            // Hack to support nested resizables, destroy and recreate child
            // resizable on parent resize
            $list.parent().closest('.ui-resizable')
                .on('resizestart', function(event) {
                    if ($(event.target).closest($list).length) return;
                    if ($list.data('ui-resizable')) {
                        $list.resizable('destroy');
                    }
                })
                .on('resizestop', function(event) {
                    if ($(event.target).closest($list).length) return;
                    if (!$list.data('ui-resizable')) {
                        createResizable($list);
                    }
                });
        });

        this.onObjectsSelected = function(event, data) {
            event.stopPropagation();
        };

        this.onSelectObjects = function(event, data) {
            event.stopPropagation();

            var self = this;

            this.dataRequest(data.vertexIds.length ? 'vertex' : 'edge', 'store', data)
                .done(function(results) {
                    var first = _.first(results),
                        $single = self.select('singleSelector'),
                        $list = self.select('listSelector'),
                        $histogram = self.select('bodySelector')
                            .add(self.select('headerSelector'));

                    if (self.currentSelectedItemId && first.id === self.currentSelectedItemId) {
                        $single.teardownAllComponents().remove();
                        $histogram.show();
                        $list.find('.element-list').trigger('objectsSelected', {
                            vertices: [], edges: [], vertexIds: [], edgeIds: []
                        });
                        self.currentSelectedItemId = null;
                    } else {
                        self.currentSelectedItemId = first.id;

                        if (!$single.length) {
                            $single = $('<div>')
                                .css('flex', 1)
                                .hide()
                                .insertBefore($list)
                        }

                        require(['detail/item/item'], function(Item) {
                            Item.attachTo($single.empty().teardownAllComponents(), {
                                constraints: ['width'],
                                model: first
                            })
                            self.select('bodySelector')
                                .add(self.select('headerSelector'))
                                .hide();
                            $single.show();
                        });

                        $list.find('.element-list').trigger('objectsSelected', {
                            vertices: data.vertexIds.length ? results : [],
                            edges: data.edgeIds.length ? results : [],
                            vertexIds: data.vertexIds,
                            edgeIds: data.edgeIds
                        })
                    }
                })
        };
    }

    function createResizable(el) {
        $(el).resizable({
            handles: 'n',
            start: function(event) {
                event.stopPropagation();
            },
            stop: function(event) {
                event.stopPropagation();
            },
            resize: function(event, ui) {
                event.stopPropagation();
                $(this).css('top', '');
            }
        });
    }

});
