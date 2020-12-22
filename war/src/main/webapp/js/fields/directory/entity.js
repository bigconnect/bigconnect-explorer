
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
    './entityTpl.hbs',
    '../withPropertyField',
    'util/jquery/typeAheadUtil',
    'util/withDataRequest',
    'util/formatters'
], function(defineComponent, template, withPropertyField, TypeAheadUtil, withDataRequest, F) {
    'use strict';

    return defineComponent(DirectoryEntityField, withPropertyField, withDataRequest);

    function DirectoryEntityField() {
        var self = this;

        this.after('initialize', function() {
            this.$node.html(template(_.extend({}, this.attr)));
            self.inputField = this.select('inputSelector');
            if (this.attr.vertexProperty) {
                self.loadingSpan = $('<span>').text(i18n('field.directory.form.display_name.loading'));
                this.$node.append(self.loadingSpan);
                self.inputField.hide();
            }

            self.inputField.typeahead({
                source: directorySearch,
                items: 25,
                minLength: 1,
                matcher: function(displayName) {
                    return displayName.toLowerCase().indexOf(this.query.toLowerCase()) > -1;
                },
                updater: function(displayName) {
                    onSelectionFieldSelected(self.map[displayName]);
                    return displayName;
                }
            }).on('click', function() {
                if (self.inputField.val()) {
                    self.inputField.typeahead('lookup').select();
                } else {
                    self.inputField.typeahead('lookup');
                }
                TypeAheadUtil.adjustDropdownPosition(self.inputField);
            }).on('blur', function() {
                TypeAheadUtil.clearIfNoMatch(self.inputField, 'selection', F.directoryEntity.pretty);
                var directoryEntity = self.inputField.data('selection');
                self.inputField.data('value', directoryEntity ? directoryEntity.id : null);
            });
        });

        this.isValid = function(value) {
            return !!value;
        };

        this.setValue = function(value) {
            if (_.isString(value)) {
                if (!value) {
                    return loadDirectoryEntity(null);
                }
                return self.dataRequest('directory', 'getById', value)
                    .then(loadDirectoryEntity);
            } else {
                self.inputField.val(F.directoryEntity.pretty(value));
                onSelectionFieldSelected(value);
            }

            function loadDirectoryEntity(directoryEntry) {
                if (directoryEntry && directoryEntry.id && directoryEntry.type) {
                    self.setValue(directoryEntry);
                    if (self.loadingSpan) {
                        self.loadingSpan.remove();
                    }
                    self.inputField.show();
                }
            }
        };

        this.getValue = function() {
            var directoryEntity = self.inputField.data('selection');
            return directoryEntity ? directoryEntity.id : null;
        };

        function directorySearch(search, process) {
            self.map = {};

            self.dataRequest('directory', 'search', search)
              .then(function(results) {
                  var entities = _.map(results.entities, function(entity) {
                      var str = F.directoryEntity.pretty(entity);
                      self.map[str] = entity;
                      return str;
                  });
                  process(entities);
                  TypeAheadUtil.adjustDropdownPosition(self.inputField);
              });
        }

        function onSelectionFieldSelected(directoryEntity) {
            self.inputField
              .data('selection', directoryEntity)
              .data('value', directoryEntity.id)
              .trigger('directorySelectionFieldSelected', { personOrGroup: directoryEntity });
        }
    }
});
