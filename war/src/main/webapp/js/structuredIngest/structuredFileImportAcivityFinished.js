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

/*eslint no-labels:0*/
define([
    'flight/lib/component',
    'util/withDataRequest'
], function(defineComponent, withDataRequest) {
    'use strict';

    return defineComponent(StructuredFileImportAcivityFinished, withDataRequest);

    function StructuredFileImportAcivityFinished() {

        this.after('teardown', function() {
            this.$node.empty();
        });

        this.defaultAttrs({
            searchRelatedSelector: '.search-related',
            selectVertexSelector: '.select-vertex'
        });

        this.after('initialize', function() {
            this.on('click', {
                searchRelatedSelector: this.onSearchRelatedClick,
                selectVertexSelector: this.onSelectVertex
            });

            this.loadDefaultContent();


            this.on(document, 'workspaceLoaded', this.onWorkspaceLoaded);
            this.trigger(document, 'updateDiff');

            this.req = this.dataRequest('longRunningProcess', 'get', this.attr.process.id)
            this.req.then(results => {
                require(['data/web-worker/store/element/actions'], actions => {
                    bcData.storePromise.then(store => store.dispatch(actions.refreshElement({
                        workspaceId: this.attr.process.workspaceId,
                        vertexId: results.vertexId
                    })));
                });
            })
        });

        this.loadDefaultContent = function() {
            var $searchRelatedButton = $('<button>').addClass('search-related btn btn-xs btn-raised')
                    .text(i18n('activity.tasks.type.structuredFile.searchRelated')),
                $selectVertex = $('<button>').addClass('select-vertex btn btn-xs btn-raised')
                    .text(i18n('activity.tasks.type.structuredFile.selectVertex'));

            this.$node.empty().append($searchRelatedButton).append($selectVertex);

            this.updateButtons(bcData.currentWorkspaceId);
        }

        this.updateButtons = function(workspaceId) {
            var self = this,
                onDifferentWorkspace = workspaceId !== self.attr.process.workspaceId,
                $searchRelatedButton = self.select('searchRelatedSelector'),
                $selectVertexButton = self.select('selectVertexSelector');

            $selectVertexButton.prop('disabled', false);
            $selectVertexButton.attr('title', i18n('activity.tasks.type.structuredFile.selectVertex'));

            if (onDifferentWorkspace) {
                $searchRelatedButton.prop('disabled', true);
                $searchRelatedButton.attr('title', i18n('activity.tasks.type.structuredFile.searchRelatedDifferentWorkspace'));
            } else {
                $searchRelatedButton.prop('disabled', false);
                $searchRelatedButton.attr('title', i18n('activity.tasks.type.structuredFile.searchRelated'));
            }
        };

        this.onWorkspaceLoaded = function(event, data) {
            this.updateButtons(data.workspaceId);
        };

        this.onSelectVertex = function(event) {
            var $target = $(event.target).addClass('loading').prop('disabled', true);

            this.req.then(results => {
                $target.removeClass('loading').prop('disabled', false);
                this.trigger('selectObjects', { vertexIds: [results.vertexId] });
            })
        };

        this.onSearchRelatedClick = function(event) {
            var $target = $(event.target).addClass('loading').prop('disabled', true);

            this.req.then(results => {
                $target.removeClass('loading').prop('disabled', false);
                this.trigger('searchRelated', { vertexId: results.vertexId });
            });
        };
    }
});
