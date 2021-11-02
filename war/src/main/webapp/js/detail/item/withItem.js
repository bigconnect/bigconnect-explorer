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
    'util/popovers/withElementScrollingPositionUpdates',
    'util/withCollapsibleSections',
    'util/vertex/formatters',
    'util/withDataRequest',
    'util/privileges',
    'util/dnd',
    'require'
], function (
    withElementScrolling,
    withCollapsibleSections,
    F,
    withDataRequest,
    Privileges,
    dnd,
    require) {
    'use strict';

    return withItem;

    function withItem() {

        withElementScrolling.call(this);
        withCollapsibleSections.call(this);
        if (!_.isFunction(this.dataRequest)) {
            withDataRequest.call(this);
        }

        this.attributes({
            propertiesSelector: '.org-bigconnect-properties',
            relationshipsSelector: '.org-bigconnect-relationships',
            commentsSelector: '.org-bigconnect-comments',
            confirmFormSelector: '.confirm-form',
            multipleSelector: '.multiple',
        });

        this.after('initialize', function () {
            this.on('openFullscreen', this.onOpenFullscreen);
            this.on('deleteMultipleItems', this.deleteMultipleItems);

            if (!_.isArray(this.attr.model)) {
                this.on('addProperty', this.redirectToPropertiesComponent);
                this.on('deleteProperty', this.redirectToPropertiesComponent);
                this.on('addNewProperty', this.onAddNewProperty);
                this.on('addNewComment', this.onAddNewComment);
                this.on('deleteItem', this.onDeleteItem);
                this.on('openSourceUrl', this.onOpenSourceUrl);
                this.on('maskWithOverlay', this.onMaskWithOverlay);
                this.on('commentOnSelection', this.onCommentOnSelection);
                this.on('addImage', this.onAddImage);
                this.on('openOriginal', this.onOpenOriginal);
                this.on('downloadOriginal', this.onDownloadOriginal);
                this.on('updateModel', this.onUpdateModel);
                this.on('requeue', this.onRequeue);
                this.on('createWatch', this.onCreateWatch);
                this.on('unresolveMentions', this.onUnresolveTermMentions);
                this.on('refreshItem', this.onRefreshItem);

                this.makeVertexTitlesDraggable();
            }
        });

        this.onRefreshItem = function (evt) {
            const model = this.attr.model;
            this.trigger(document, 'reloadElement', model);
        };

        this.onCreateWatch = function (evt, data) {
            var root = $('<div class="underneath">'),
                self = this;

            $('<tr><td colspan="3"></td></tr>')
                .prependTo(this.select('propertiesSelector').find('table')).find('td').append(root);

            require(['../dropdowns/watchForm/watch'], function (WatchForm) {
                WatchForm.attachTo(root, {
                    data: self.attr.model
                });
            });

        };

        this.onUnresolveTermMentions = function (evt, data) {
            var self = this,
                $container = this.select('confirmFormSelector');

            if ($container.length === 0) {
                $container = $('<div class="confirm-form"></div>').insertBefore(
                    this.select('propertiesSelector')
                );
            }

            require(['../dropdowns/confirmForm/confirmForm'], function (ConfirmForm) {
                var node = $('<div class="underneath"></div>').appendTo($container);
                ConfirmForm.attachTo(node, {
                    data: self.attr.model,
                    service: 'vertex',
                    method: 'unresolveTermMentions',
                    arguments: self.attr.model.id
                });
            });
        };

        this.onDeleteItem = function (event) {
            var self = this,
                $container = this.select('confirmFormSelector');

            if ($container.length === 0) {
                $container = $('<div class="confirm"></div>').insertBefore(
                    this.select('propertiesSelector')
                );
            }

            require(['../dropdowns/confirmForm/confirmForm'], function (ConfirmForm) {
                var node = $('<div class="underneath"></div>').appendTo($container);
                ConfirmForm.attachTo(node, {
                    data: self.attr.model,
                    service: self.attr.model.type,
                    method: 'delete',
                    arguments: self.attr.model.id
                });
            });
        };

        this.deleteMultipleItems = function (event, data) {
            event.stopPropagation();
            const elements = _.map(this.attr.model, (d) => {
                return {type: d.type, id: d.id}
            });

            var self = this,
                $container = this.select('confirmFormSelector');

            if ($container.length === 0) {
                $container = $('<div class="confirm"></div>').insertBefore(
                    this.select('multipleSelector')
                );
            }

            require(['../dropdowns/confirmForm/confirmForm'], function (ConfirmForm) {
                var node = $('<div class="underneath"></div>').appendTo($container);
                ConfirmForm.attachTo(node, {
                    data: self.attr.model,
                    service: 'vertex',
                    method: 'deleteMultiple',
                    arguments: elements
                });
            });
        };

        this.onRequeue = function (event, data) {
            var self = this,
                $container = this.select('confirmFormSelector');

            if ($container.length === 0) {
                $container = $('<div class="confirm"></div>').insertBefore(
                    this.select('propertiesSelector')
                );
            }

            require(['../dropdowns/confirmForm/confirmForm'], function (ConfirmForm) {
                var node = $('<div class="underneath"></div>').appendTo($container);
                ConfirmForm.attachTo(node, {
                    data: self.attr.model,
                    service: self.attr.model.type,
                    method: 'requeue',
                    message: i18n('detail.requeue.form.warning.explanation.' + self.attr.model.type),
                    arguments: self.attr.model.id
                });
            });
        };

        this.onUpdateModel = function (event, data) {
            if (event.target === this.node) {
                this.attr.model = data.model;
            }
        };

        this.redirectToPropertiesComponent = function (event, data) {
            if ($(event.target).closest('.comments').length) {
                return;
            }

            if ($(event.target).closest(this.attr.propertiesSelector).length === 0) {
                event.stopPropagation();

                var properties = this.select('propertiesSelector');
                if (properties.length) {
                    _.defer(function () {
                        properties.trigger(event.type, data);
                    })
                } else {
                    throw new Error('Unable to redirect properties request', event.type, data);
                }
            }
        };

        this.onOpenOriginal = function (event) {
            window.open(F.vertex.raw(this.attr.model));
        };

        this.onDownloadOriginal = function (event) {
            var rawSrc = F.vertex.raw(this.attr.model);
            window.open(rawSrc + (
                /\?/.test(rawSrc) ? '&' : '?'
            ) + 'download=true');
        };

        this.onAddImage = function (event, data) {
            this.$node.find('.entity-glyphicon').trigger('setImage', data);
        };

        this.onCommentOnSelection = function (event, data) {
            var $comments = this.select('commentsSelector');

            if (!$(event.target).is($comments)) {
                $comments.trigger(event.type, data);
            }
        };

        this.makeVertexTitlesDraggable = function () {
            const model = this.attr.model;
            this.$node.find('.org-bigconnect-layout-header .vertex-draggable')
            this.$node.find('.org-bigconnect-layout-header .vertex-draggable')
                .filter(function () {
                    if (!_.isEmpty($(this).attr('data-vertex-id'))) {
                        this.setAttribute('draggable', true)
                        return true
                    }
                    return false
                })
                .on('dragstart', function (e) {
                    const id = e.target.dataset.vertexId;
                    const elements = {vertexIds: [id], edgeIds: []};
                    const dt = e.originalEvent.dataTransfer;

                    if (model.id === id) {
                        const url = F.vertexUrl.url([model], bcData.currentWorkspaceId);
                        dnd.setDataTransferWithElements(dt, {elements: [model]})
                    } else {
                        dnd.setDataTransferWithElements(dt, elements);
                    }
                })
        };

        this.onAddNewProperty = function (event) {
            this.trigger(this.select('propertiesSelector'), 'editProperty');
        };

        this.onAddNewComment = function (event) {
            this.trigger(this.select('commentsSelector'), 'editComment');
        };

        this.onOpenFullscreen = function (event, data) {
            event.stopPropagation();

            var viewing = this.attr.model,
                vertices = data && data.vertices ?
                    data.vertices :
                    _.isObject(viewing) && viewing.vertices ?
                        viewing.vertices :
                        viewing,
                url = F.vertexUrl.url(
                    _.isArray(vertices) ? vertices : [vertices],
                    bcData.currentWorkspaceId
                );
            window.open(url);
        };

        this.onOpenSourceUrl = function (event, data) {
            window.open(data.sourceUrl);
        };

        this.onMaskWithOverlay = function (event, data) {
            event.stopPropagation();
            if (data.done) {
                this.$node.find('.detail-overlay').remove();
                this.trigger('selectObjects');
            } else {
                $('<div>')
                    .addClass('detail-overlay')
                    .toggleClass('detail-overlay-loading', data.loading)
                    .append($('<h1>').text(data.text))
                    .appendTo(this.$node);
            }
        };

    }
});
