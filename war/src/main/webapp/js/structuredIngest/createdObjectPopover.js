
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
    'util/popovers/withPopover',
    'util/visibility/edit',
    './util'
], function(
    defineComponent,
    withPopover,
    VisibilityEditor,
    util) {
    'use strict';

    return defineComponent(CreatedObjectPopover, withPopover);

    function CreatedObjectPopover() {

        this.defaultAttrs({
            deleteEntitySelector: 'button.deleteEntity',
            deletePropertySelector: 'button.deleteProperty'
        })

        this.before('initialize', function(node, config) {
            config.template = '/structuredIngest/templates/createdObject.hbs'
            config.isEdge = 'inVertex' in config.object;
            config.type = config.isEdge ? 'Relationship' : 'Entity';
            config.properties = _.chain(config.object.properties)
                .map(function(p) {
                    return {
                        hide: p.name === util.CONCEPT_TYPE,
                        headerName: p.key,
                        isIdentifier: Boolean(p.hints && p.hints.isIdentifier),
                        propertyName: (
                            config.ontologyProperties.byTitle[p.name] &&
                            config.ontologyProperties.byTitle[p.name].displayName ||
                            p.name
                        )
                    }
                })
                .value();
        });

        this.after('initialize', function() {
            this.after('setupWithTemplate', function() {
                this.on(this.popover, 'click', {
                    deleteEntitySelector: this.onDeleteEntity,
                    deletePropertySelector: this.onDeleteProperty
                });
                this.on(this.popover, 'visibilitychange', this.onVisibilityChanged);
                VisibilityEditor.attachTo(this.popover.find('.visibility'), {
                    placeholder: this.attr.isEdge ?
                        i18n('csv.file_import.relationship.visibility.placeholder') :
                        i18n('csv.file_import.entity.visibility.placeholder'),
                    value: this.attr.object.visibilitySource
                });
            })
        })

        this.onVisibilityChanged = function(event, data) {
            this.attr.object.visibilitySource = data.value;
        };

        this.onDeleteEntity = function(event) {
            event.stopPropagation();
            event.preventDefault();
            this.trigger('removeMappedObject');
        };

        this.onDeleteProperty = function(event) {
            event.stopPropagation();
            event.preventDefault();

            var $li = $(event.target).closest('li'),
                index = $li.index(),
                property = this.attr.object.properties[index];

            this.trigger('removeMappedObjectProperty', {
                propertyIndex: index
            });

            $li.remove();
            this.positionDialog();
        };
    }
})

