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
    'util/privileges'
], function(Privileges) {
    'use strict';

    FoldersNotSupported.prototype = Object.create(Error.prototype);

    return withFileDrop;

    function FoldersNotSupported() {}

    function withFileDrop() {

        this.after('initialize', function() {
            var self = this;

            if (!this.handleFilesDropped) {
                return console.warn('Implement handleFilesDropped');
            }

            if (this.attr.canEdit === false) {
                return;
            }

            this.node.ondragover = function(e) {
                if (Privileges.canEDIT) {
                    e.dataTransfer.dropEffect = 'copy';
                    $(this).addClass('file-hover');
                } else {
                    e.dataTransfer.dropEffect = 'none';
                    self.trigger('displayInformation', {
                        message: i18n('graph.workspace.readonly'),
                        position: [e.pageX, e.pageY]
                    });
                }
                return false;
            };
            this.node.ondragenter = function(e) {
                e.preventDefault();
                return false;
            };
            this.node.ondragleave = function(e) {
                if (!Privileges.canEDIT) {
                    self.trigger('hideInformation');
                }
                return false;
            };
            this.node.ondrop = function(e) {
                if (e.dataTransfer &&
                    e.dataTransfer.files) {

                    e.preventDefault();
                    e.stopPropagation();

                    if (self.$node.hasClass('uploading')) return;
                    if (e.dataTransfer.files.length === 0 &&
                        (!e.dataTransfer.items ||
                          e.dataTransfer.items.length === 0)) {
                        return;
                    }

                    if (Privileges.canEDIT) {
                        var dt = e.dataTransfer,
                            files = dt.files,
                            items = dt.items,
                            folderCheck = (files.length) ?
                                Promise.all(_.toArray(e.dataTransfer.files).map(function(file) {
                                    return new Promise(function(fulfill, reject) {
                                        var reader = new FileReader(),
                                            slice = file.slice(0, 1000);

                                        reader.onload = fulfill;
                                        reader.onerror = function() {
                                            reject(new FoldersNotSupported());
                                        };
                                        reader.readAsText(slice);
                                    })
                                })) :
                                Promise.resolve();

                        if (BC_MIMETYPES._DataTransferHasBC(dt)) {
                            dt.dropEffect = 'none';
                            return
                        }

                        folderCheck
                            .then(function() {
                                if (files.length) {
                                    self.handleFilesDropped(files, e);
                                } else if (items.length && _.isFunction(self.handleItemsDropped)) {
                                    self.handleItemsDropped(items, e);
                                }
                            })
                            .catch(FoldersNotSupported, function(error) {
                                self.trigger('displayInformation', {
                                    message: i18n('popovers.file_import.folder.error'),
                                    position: [e.pageX, e.pageY]
                                });
                            })
                            .catch(function(error) {
                                console.error(error);

                                self.trigger('displayInformation', {
                                    message: i18n('popovers.file_import.general.error'),
                                    position: [e.pageX, e.pageY]
                                });
                            })
                    } else {
                        self.trigger('hideInformation');
                    }
                }
            };
        });
    }
});
