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
    'util/formatters',
    'util/withDataRequest'
], function(
    defineComponent,
    F,
    withDataRequest) {
    'use strict';

    return defineComponent(FindPath, withDataRequest);

    function FindPath() {

        this.after('teardown', function() {
            this.$node.empty();
            this.trigger('defocusPaths');
        });

        this.defaultAttrs({
            pathsSelector: '.found-paths',
            addVerticesSelector: '.add-vertices'
        });

        this.after('initialize', function() {

            this.on('click', {
                pathsSelector: this.onPathClick,
                addVerticesSelector: this.onAddVertices
            });

            this.loadDefaultContent();

            this.on(document, 'focusPaths', this.onFocusPaths);
            this.on(document, 'defocusPaths', this.onDefocusPaths);
            this.on(document, 'workspaceLoaded', this.onWorkspaceLoaded);
        });

        this.updateButton = function($button, workspaceId) {
            var self = this,
                onDifferentWorkspace = workspaceId !== this.attr.process.workspaceId,
                noResults = (self.attr.process.resultsCount || 0) === 0,
                disabled = onDifferentWorkspace || noResults;

            $button.prop('disabled', Boolean(disabled));

            $button.attr('title', onDifferentWorkspace ?
                i18n('popovers.find_path.wrong_workspace') :
                i18n('popovers.find_path.show_path'));
        };

        this.onWorkspaceLoaded = function(event, data) {
            this.updateButton(this.select('pathsSelector'), data.workspaceId);
        };

        this.loadDefaultContent = function() {
            var count = this.attr.process.resultsCount || 0,
                $button = $('<button>').addClass('found-paths btn btn-mini')
                    .text(
                        i18n('popovers.find_path.paths.' + (
                             count === 0 ? 'none' : count === 1 ? 'one' : 'some'
                        ), F.number.pretty(count))
                    );

            this.updateButton($button, bcData.currentWorkspaceId);

            this.$node.empty().append($button);
        };

        this.onFocusPaths = function(event, data) {
            if (data.processId !== this.attr.process.id) {
                this.loadDefaultContent();
            }
        };

        this.onDefocusPaths = function(event, data) {
            this.loadDefaultContent();
        };

        this.onAddVertices = function(event) {
            this.trigger('focusPathsAddVertexIds');
            this.loadDefaultContent();
        };

        this.onPathClick = function(event) {
            var self = this,
                $target = $(event.target).addClass('loading').prop('disabled', true);

            this.dataRequest('longRunningProcess', 'get', this.attr.process.id)
                .done(function(process) {
                    var paths = process.results && process.results.paths || [],
                        vertices = _.chain(paths).flatten().uniq().value();

                    self.trigger('focusPaths', {
                        paths,
                        labels: process.labels,
                        sourceId: self.attr.process.outVertexId,
                        targetId: self.attr.process.inVertexId,
                        processId: self.attr.process.id
                    });

                    $target.hide();

                    var $addButton = $('<button>').addClass('btn btn-mini btn-primary add-vertices');

                    if (vertices.length === 0) {
                        $addButton.prop('disabled', true);
                    }

                    $addButton.text(i18n('popovers.find_path.add'));
                    self.$node.append($addButton);
                })
        };
    }
});
