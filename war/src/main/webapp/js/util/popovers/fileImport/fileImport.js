
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
    '../withPopover',
    './formattedFile.hbs',
    'detail/dropdowns/propertyForm/justification',
    'configuration/plugins/registry',
    'util/visibility/edit',
    'util/ontology/conceptSelect',
    'util/formatters',
    'util/withFormFieldErrors',
    'util/withDataRequest',
    'util/component/attacher'
], function(
    defineComponent,
    withPopover,
    fileTemplate,
    Justification,
    registry,
    VisibilityEditor,
    ConceptSelector,
    F,
    withFormFieldErrors,
    withDataRequest,
    Attacher) {
    'use strict';

    return defineComponent(FileImport, withPopover, withFormFieldErrors, withDataRequest);

    function FileImport() {

        this.defaultAttrs({
            importSelector: '.btn-primary',
            cancelSelector: '.btn-default',
            toggleCheckboxSelector: '.toggle-collapsed',
            importFileButtonSelector: 'button.file-select',
            importFileSelector: 'input.file',
            visibilityInputSelector: '.visibility',
            justificationSelector: '.justification',
            conceptSelector: '.concept-container',
            singleSelector: '.single',
            singleVisibilitySelector: '.single .visibility',
            individualVisibilitySelector: '.individual-visibility',
            vertexTitleSelector: '.title-container input'
        });

        this.before('teardown', function() {
            this.popover
                .find(this.attr.justificationSelector)
                .add(this.attr.visibilityInputSelector)
                .add(this.attr.conceptSelector)
                .teardownAllComponents();
        });

        this.after('teardown', function() {
            if (this.request && this.request.cancel) {
                this.request.cancel();
            }
        });

        this.getTitle = function(files, stringType) {
            if (files.length) {
                var pluralString = i18n('popovers.file_import.files.' + (
                    files.length === 1 || stringType ? 'one' : 'some'
                ), files.length);
                return i18n('popovers.file_import.title', pluralString);
            }
            return i18n('popovers.file_import.nofile.title');
        };

        this.before('initialize', function(node, config) {
            config.template = 'fileImport/template';

            if (!config.files) config.files = [];

            config.hasFile = config.files.length > 0;
            config.multipleFiles = config.files.length > 1;
            config.title = this.getTitle(config.files, config.stringType);

            this.after('setupWithTemplate', function() {
                var self = this;

                this.visibilitySource = null;
                this.visibilitySources = new Array(config.files.length);
                this.vertexTitle = '';
                this.vertexTitles = new Array(config.files.length);
                this.concepts = new Array(config.files.length);

                this.on(this.popover, 'visibilitychange', this.onVisibilityChange);
                this.on(this.popover, 'justificationchange', this.onJustificationChange);
                this.on(this.popover, 'conceptSelected', this.onConceptChange);

                this.enterShouldSubmit = 'importSelector';

                this.on(this.popover, 'click', {
                    importSelector: this.onImport,
                    cancelSelector: this.onCancel
                });

                this.on(this.popover, 'change', {
                    toggleCheckboxSelector: this.onCheckboxCopy,
                    importFileSelector: this.onFileChange
                });

                this.on(this.popover, 'keyup', {
                    vertexTitleSelector: this.onVertexTitleChange
                })

                this.setFiles(this.attr.files);
                this.checkValid();
            })
        });

        this.onFileChange = function(event) {
            var files = event.target.files;
            if (files.length) {
                this.setFiles(files);
            }
        };

        this.setFiles = function(files) {
            this.attr.files = files;
            this.popover.find('.popover-title').text(this.getTitle(files, this.attr.stringType));
            this.popover.find(this.attr.importSelector).text(files.length ?
                i18n('popovers.file_import.button.import') :
                i18n('popovers.file_import.button.nofile.import')
            );
            var $single = this.popover.find(this.attr.singleSelector).hide();

            if (files.length === 0) {
                this.popover.find(this.attr.importFileButtonSelector).toggle(!this.attr.stringType);
                this.popover.find(this.attr.toggleCheckboxSelector).hide();
                this.popover.find(this.attr.individualVisibilitySelector).hide();
                $single.html(fileTemplate({
                    name: this.attr.stringType || undefined,
                    index: 'collapsed',
                    justification: true
                }))
            } else if (files.length === 1) {
                this.popover.find(this.attr.importFileButtonSelector).hide();
                this.popover.find(this.attr.toggleCheckboxSelector).hide();
                this.popover.find(this.attr.individualVisibilitySelector).hide();
                $single.html(fileTemplate({
                    name: files[0].name,
                    size: F.bytes.pretty(files[0].size, 0),
                    index: 'collapsed'
                }));
            } else {
                this.popover.find(this.attr.importFileButtonSelector).hide();
                this.popover.find(this.attr.toggleCheckboxSelector).show();
                $single.html(fileTemplate({
                    name: i18n('popovers.file_import.files.some', files.length),
                    size: F.bytes.pretty(_.chain(files)
                            .map(_.property('size'))
                            .reduce(function(memo, num) {
                                return memo + num;
                            }, 0)
                            .value()),
                    index: 'collapsed'
                }));
                this.popover.find(this.attr.individualVisibilitySelector)
                    .hide()
                    .html(
                        $.map(files, function(file, i) {
                            return fileTemplate({
                                name: file.name,
                                size: F.bytes.pretty(file.size, 0),
                                index: i
                            })
                        })
                    )
            }

            Justification.attachTo(this.popover.find(this.attr.justificationSelector).eq(0));
            VisibilityEditor.attachTo(this.popover.find(this.attr.visibilityInputSelector));
            ConceptSelector.attachTo(this.popover.find(this.attr.conceptSelector).eq(0), {
                focus: true,
                defaultText: files.length ?
                    i18n('popovers.file_import.concept.placeholder') :
                    i18n('popovers.file_import.concept.nofile.placeholder')
            });
            ConceptSelector.attachTo(this.popover.find(this.attr.conceptSelector), {
                defaultText: i18n('popovers.file_import.concept.placeholder')
            });
            $single.show();

            this.positionDialog();
        }

        this.onCheckboxCopy = function(e) {
            var $checkbox = $(e.target),
                checked = $checkbox.is(':checked');

            this.popover.find(this.attr.singleSelector).toggle(checked);
            this.popover.toggleClass('collapseVisibility', checked);
            this.popover.find(this.attr.individualVisibilitySelector).toggle(!checked);
            this.popover.find('.errors').empty();
            _.delay(this.positionDialog.bind(this), 50);
            this.checkValid();
        };

        this.onConceptChange = function(event, data) {
            var concept = data.concept,
                index = $(event.target)
                    .closest(this.attr.conceptSelector)
                    .data('concept', concept)
                    .data('fileIndex');

            if (index === 'collapsed') {
                this.concept = concept;
            } else {
                this.concepts[index] = concept;
            }

            this.checkValid();
        };

        this.onJustificationChange = function(event, data) {
            this.justification = data;
            this.checkValid();
        };

        this.onVertexTitleChange = function(event) {
            let index = $(event.target).data('fileIndex');

            if (index === 'collapsed') {
                this.vertexTitle = $(event.target).val();
            } else {
                this.vertexTitles[index] = $(event.target).val();
            }

            this.checkValid();
        };

        this.onVisibilityChange = function(event, data) {
            var index = $(event.target)
                .data('visibility', data)
                .data('fileIndex');

            if (index === 'collapsed') {
                this.visibilitySource = data;
            } else {
                this.visibilitySources[index] = data;
            }

            this.checkValid();
        };

        this.checkValid = function() {
            var self = this,
                collapsed = this.isVisibilityCollapsed(),
                isValid = collapsed ?
                    (this.visibilitySource && this.visibilitySource.valid &&
                     (this.attr.files.length || (
                         this.justification && this.justification.valid))
                    ) :
                    _.every(this.visibilitySources, _.property('valid'));

            if (collapsed) {
                this.popover.find(this.attr.singleVisibilitySelector).find('input').toggleClass('invalid', !isValid);
            } else {
                this.popover.find(this.attr.individualVisibilitySelector).find('.visibility').each(function() {
                    var $visibility = $(this);
                    var fileIndex = $visibility.data('fileIndex')
                    var visibilityValid = self.visibilitySources[fileIndex].valid;

                    $visibility.find('input').toggleClass('invalid', !visibilityValid);
                });
            }

            if (isValid && this.attr.files.length === 0 && !this.concept) {
                isValid = false;
            }

            this.popover.find(this.attr.importSelector).prop('disabled', !isValid);

            return isValid;
        };

        this.isVisibilityCollapsed = function() {
            var checkbox = this.popover.find('.checkbox input');

            return checkbox.length === 0 || checkbox.is(':checked');
        };

        this.onCancel = function() {
            this.teardown();
        };

        this.onImport = function() {
            if (!this.checkValid()) {
                return false;
            }

            var self = this,
                files = this.attr.files,
                geolocation = this.attr.geolocation,
                button = this.popover.find('.btn-primary')
                    .text(files.length ?
                          i18n('popovers.file_import.importing') :
                          i18n('popovers.file_import.creating')
                    )
                    .prop('disabled', true),
                cancelButton = this.popover.find('.btn-default').show(),
                collapsed = this.isVisibilityCollapsed(),
                conceptValue = collapsed ?
                    this.concept && this.concept.id :
                    _.map(this.concepts, function(c) {
                        return c && c.id || '';
                    }),
                visibilityValue = collapsed ?
                    this.visibilitySource.value :
                    _.map(this.visibilitySources, _.property('value')),
                title = collapsed ? this.vertexTitle : this.vertexTitles;

            this.attr.teardownOnTap = false;

            if (files.length) {
                this.request = this.dataRequest('vertex', 'importFiles', files, conceptValue, visibilityValue, title);
            } else if (this.attr.string) {
                this.request = this.dataRequest('vertex', 'importFileString', {
                    string: this.attr.string,
                    type: this.attr.stringMimeType
                }, conceptValue, visibilityValue);
            } else {
                this.request = this.dataRequest('vertex', 'create', this.justification, conceptValue, visibilityValue, geolocation, title);
            }

            if (_.isFunction(this.request.progress)) {
                this.request
                    .progress(function(complete) {
                        var percent = Math.round(complete * 100);
                        button.text(percent + '% ' + (
                            files.length ?
                                  i18n('popovers.file_import.importing') :
                                  i18n('popovers.file_import.creating')
                        ));
                    })
            }

            this.request.then(function(result) {
                var vertexIds = _.isArray(result.vertexIds) ? result.vertexIds : [result.id];
                var page = self.attr.anchorTo.page;

                self.trigger('fileImportSuccess', { vertexIds, position: page });
                self.trigger('selectObjects', { vertexIds }); 				

                _.defer(function() {
                    self.teardown();
                })
            })
            .catch(function(error) {
                self.attr.teardownOnTap = true;
                // TODO: fix error
                self.markFieldErrors(error || 'Unknown Error', self.popover);
                cancelButton.hide();
                button.text(files.length ?
                        i18n('popovers.file_import.button.import') :
                        i18n('popovers.file_import.button.nofile.import')
                    )
                    .removeClass('loading')
                    .prop('disabled', false)

                _.defer(self.positionDialog.bind(self));
            })
        }
    }
});
