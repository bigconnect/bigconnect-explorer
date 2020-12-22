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
    './textForm.hbs',
    'tpl!util/alert',
    'util/vertex/formatters',
    'util/withDataRequest',
    'util/withTeardown',
    'detail/text/transcriptEntries.hbs',
], function(
    defineComponent,
    withDropdown,
    textTemplate,
    alertTemplate,
    F,
    withDataRequest,
    withTeardown,
    transcriptEntriesTemplate) {
    'use strict';

    return defineComponent(TextForm, withDropdown, withDataRequest, withTeardown);

    function TextForm() {

        this.defaultAttrs({
            inputSelector: 'textarea',
            primarySelector: '.btn-blue',
            visibilityInputSelector: '.visibility input'
        });

        this.before('initialize', function(n, c) {
            c.manualOpen = true;
        });

        this.after('initialize', function() {
            var self = this,
                vertex = this.attr.data,
                property = this.attr.property;

            this.on('change keyup paste', {
                inputSelector: this.onChange
            });
            this.on('click', {
                primarySelector: this.onSave
            });
            this.on('visibilitychange', this.onVisibilityChange);

            this.on('opened', function() {
                this.select('inputSelector').focus();
            });

            this.before('teardown', function() {
                $(document).trigger('resizeForEditText', { open: false });
            });

            require([
                'util/visibility/edit'
            ], function(Visibility) {
                Visibility.attachTo(self.$node.find('.visibility'), {
                    value: property &&
                        property.metadata &&
                        property.metadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON] &&
                        property.metadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON].source
                });
                self.manualOpen();
            });

            this.checkValid();

            this.$node.html(textTemplate({
                graphVertexId: vertex.id || '',
                text: ''
            }));

            this.openText(vertex.id, property.key, property.name)
                .catch(function() {
                    return '';
                })
                .then(function(artifactText) {
                    const html = self.processArtifactText(artifactText);
                    self.select('inputSelector').val(html);
                });

            $(document).trigger('resizeForEditText', { open: true });
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
                textProp = this.attr.property,
                vertexId = this.attr.data.id,
                params = {
                    graphVertexId: vertexId,
                    propertyName: textProp.name,
                    propertyKey: textProp.key,
                    value: this.getValue()
                };

            self.buttonLoading();

            self.dataRequest('vertex', 'editText', params)
                .then(function() {
                    $(document).trigger('resizeForEditText', { open: false });
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
        };

        this.openText = function(vertexId, propertyKey, propertyName) {
            const self = this,
                $section = this.$node.find('.ts-' + F.className.to(propertyKey + propertyName)),
                $info = $section.find('button.info');

            $section.closest('.texts').find('.loading').removeClass('loading');
            $info.addClass('loading');

            if (this.openTextRequest) {
                this.openTextRequest.cancel();
                this.openTextRequest = null;
            }

            this.openTextRequest = this.dataRequest(
                'vertex',
                'text',
                vertexId,
                propertyKey,
                propertyName
            );

            let textPromise = this.openTextRequest;
            return textPromise
        };

        this.processArtifactText = function(text) {
            var self = this,
                warningText = i18n('detail.text.none_available');

            // Looks like JSON ?
            if (/^\s*{/.test(text)) {
                var json;
                try {
                    json = JSON.parse(text);
                } catch(e) { /*eslint no-empty:0*/ }

                if (json && !_.isEmpty(json.entries)) {
                    return transcriptEntriesTemplate({
                        entries: _.map(json.entries, function(e) {
                            return {
                                millis: e.start,
                                time: (_.isUndefined(e.start) ? '' : self.formatTimeOffset(e.start)) +
                                    ' - ' +
                                    (_.isUndefined(e.end) ? '' : self.formatTimeOffset(e.end)),
                                text: e.text
                            };
                        })
                    });
                } else if (json) {
                    text = null;
                    warningText = i18n('detail.transcript.none_available');
                }
            }

            return !text ? alertTemplate({ warning: warningText }) : text;
        };

    }
});
