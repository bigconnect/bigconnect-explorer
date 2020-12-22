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
    'require',
    'util/messages'
], function(
    defineComponent,
    require,
    i18n) {
    'use strict';

    return defineComponent(FileUpload);

    function FileUpload() {

        this.defaultAttrs({
            buttonText: i18n('admin.utils.file-upload.button.select'),
            uploadSelector: '.btn-file',
            uploadInputSelector: 'input',
            removeSelector: '.btn-danger',
            selectedFileSelector: '.selected-file'

            // TODO: add accepted filetypes attribute
        });

        this.after('initialize', function() {
            var self = this;

            this.on('change', {
                uploadInputSelector: this.onFileChange
            });
            this.on('click', {
                removeSelector: this.onRemove
            });
            this.on('reset', this.onRemove);

            require(['./fileUploadTemplate.hbs'], function(tpl) {
                self.$node.html(tpl(self.attr));
            });
        });

        this.onRemove = function(event) {
            this.select('uploadInputSelector').val('');
            this.updateFile();
        }

        this.onFileChange = function(event) {
            var files = event.target.files;

            this.updateFile(files && files.length && files[0]);
        };

        this.updateFile = function(file) {
            var self = this;

            this.trigger('fileChanged', {
                file: file
            });

            if (!file) {
                this.select('removeSelector').hide();
                this.select('uploadSelector').show();
                return this.select('selectedFileSelector').empty();
            }

            require(['./fileUploadItemTemplate.hbs'], function(tpl) {
                self.select('uploadSelector').hide();
                self.select('removeSelector').show();
                self.select('selectedFileSelector').html(tpl({ file: file }));
            });
        };

    }
});
