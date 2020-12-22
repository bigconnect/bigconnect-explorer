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
    'util/withDropdown',
    './commentForm.hbs',
    'tpl!util/alert',
    'util/vertex/formatters',
    'util/withDataRequest'
], function(
    defineComponent,
    withDropdown,
    commentTemplate,
    alertTemplate,
    F,
    withDataRequest) {
    'use strict';

    return defineComponent(CommentForm, withDropdown, withDataRequest);

    function CommentForm() {

        this.defaultAttrs({
            inputSelector: 'textarea',
            primarySelector: '.btn-blue',
            visibilityInputSelector: '.visibility input'
        });

        this.before('initialize', function(n, c) {
            c.manualOpen = true;
        })

        this.after('initialize', function() {
            var self = this;

            this.on('change keyup paste', {
                inputSelector: this.onChange
            });
            this.on('click', {
                primarySelector: this.onSave
            });
            this.on('visibilitychange', this.onVisibilityChange);

            this.$node.html(commentTemplate({
                graphVertexId: this.attr.data.id || '',
                commentText: this.attr.comment && this.attr.comment.value || ''
            }));

            this.on('opened', function() {
                this.select('inputSelector').focus();
            });

            require([
                'util/visibility/edit'
            ], function(Visibility) {
                Visibility.attachTo(self.$node.find('.visibility'), {
                    value: self.attr.comment &&
                        self.attr.comment.metadata &&
                        self.attr.comment.metadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON] &&
                        self.attr.comment.metadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON].source
                });
                self.manualOpen();
            });

            this.checkValid();
        });

        this.onChange = function(event) {
            this.checkValid();
        };

        this.onVisibilityChange = function(event, data) {
            this.visibilitySource = data;
            this.checkValid();
        };

        this.onSave = function(event) {
            var self = this,
                comment = this.attr.comment,
                metadata = comment && comment.metadata,
                visibilityJson = metadata && metadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON],
                params = {
                    name: ONTOLOGY_CONSTANTS.PROP_COMMENT_ENTRY,
                    key: comment && comment.key,
                    value: this.getValue(),
                    metadata: this.attr.path && {
                        [ONTOLOGY_CONSTANTS.PROP_COMMENT_PATH]: this.attr.path
                    },
                    visibilitySource: this.visibilitySource && this.visibilitySource.value || '',
                    sourceInfo: this.attr.sourceInfo
                };

            if (visibilityJson) {
                params.oldVisibilitySource = visibilityJson.source;
            }

            this.buttonLoading();

            this.dataRequest(this.attr.type, 'setProperty', this.attr.data.id, params)
                .then(function() {
                    self.teardown();
                })
                .catch(function(error) {
                    self.markFieldErrors(error);
                    self.clearLoading();
                })
        };

        this.getValue = function() {
            return $.trim(this.select('inputSelector').val());
        };

        this.checkValid = function() {
            var val = this.getValue();
            var visibilityValid = this.visibilitySource && this.visibilitySource.valid;

            if (val.length && visibilityValid) {
                this.select('primarySelector').prop('disabled', false);
            } else {
                this.select('primarySelector').prop('disabled', true);
            }

            this.select('visibilityInputSelector').toggleClass('invalid', !visibilityValid)
        }
    }
});
