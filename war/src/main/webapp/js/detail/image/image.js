
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
    './image-tpl.hbs',
    'util/vertex/formatters',
    'util/privileges',
    'util/detectedObjects/withFacebox',
    'require'
], function(
    defineComponent,
    template,
    F,
    Privileges,
    withFacebox,
    require) {
    'use strict';

    return defineComponent(ImageView, withFacebox);

    function ImageView() {

        this.attributes({
            model: null,
            imageSelector: 'img',
            artifactImageSelector: '.image-preview',
            ignoreUpdateModelNotImplemented: true
        });

        this.after('initialize', function() {
            this.$node
                .addClass('loading')
                .html(template({
                    src: F.vertex.imageDetail(this.attr.model),
                    id: this.attr.model.id
                }));

            this.on('detectedObjectCoordsChange', this.onCoordsChanged);

            var self = this,
                image = this.select('imageSelector'),
                imageEl = image.get(0),
                naturalWidth = imageEl.naturalWidth,
                naturalHeight = imageEl.naturalHeight;

            if (naturalWidth === 0 || naturalHeight === 0) {
                image.on('load', this.onImageLoaded.bind(this))
            } else {
                this.onImageLoaded();
            }
        });

        this.onCoordsChanged = function(event, data) {
            var self = this,
                vertex = this.attr.model,
                width = parseFloat(data.x2) - parseFloat(data.x1),
                height = parseFloat(data.y2) - parseFloat(data.y1),
                artifactImage = this.$node.find('.image-preview'),
                isLargeEnough = (artifactImage.width() * width) > 5 &&
                    (artifactImage.height() * height) > 5,
                detectedObject;

            if (data.id && data.id !== 'NEW') {
                detectedObject = _.first(F.vertex.props(vertex, 'detectedObject', data.id));
            } else {
                data = _.omit(data, 'id');
            }

            this.trigger('detectedObjectEdit', isLargeEnough ?
                {
                    property: detectedObject,
                    value: data
                } : null
            );
        };


        this.onImageLoaded = function() {
            this.$node.removeClass('loading');

            if (Privileges.missingEDIT) {
                return this.$node.css('cursor', 'default')
            }

            var artifactImage = this.select('artifactImageSelector');
            this.initializeFacebox(artifactImage);
        }
    }
});
