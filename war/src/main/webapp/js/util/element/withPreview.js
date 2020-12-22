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
    'util/deferredImage',
    'util/video/scrubber',
    'util/vertex/formatters'
], function(
    deferredImage,
    VideoScrubber,
    F) {
    'use strict';

    return WithPreview;

    function WithPreview() {

        this.after('initialize', function() {
            this.$node.addClass('has-preview');

            this.on('loadPreview', this.onLoadPreview);
        });

        this.before('teardown', function() {
            this.$node.removeClass('has-preview non_concept_preview video_preview loading');
        });

        this.onLoadPreview = function(event) {
            if (!this.previewLoaded) {
                this.previewLoaded = true;

                var self = this,
                    preview = this.preview = this.$node.find('.preview'),
                    activePreview = this.activePreview = this.$node.find('.active-preview'),
                    vertex = this.vertex,
                    image = vertex && F.vertex.image(vertex, null, 80),
                    videoPreview = vertex && F.vertex.videoPreviewImage(vertex),
                    nonConceptClsName = 'non_concept_preview';

                if (videoPreview) {
                    this.on('itemActivated', this.onVideoPreviewActivated);
                    this.on('itemDeactivated', this.onVideoPreviewDeactivated);
                    this.$node.addClass('video_preview ' + nonConceptClsName);
                    preview.css('display', 'block');

                    var div = preview.find('div');
                    if (!div.length) {
                        div = $('<div>').appendTo(preview);
                    }

                    VideoScrubber.attachTo(div, {
                        posterFrameUrl: image,
                        videoPreviewImageUrl: videoPreview
                    });
                } else {
                    preview.find('div').remove();
                    var concept = F.vertex.concept(vertex),
                        activeImage = F.vertex.selectedImage(vertex, null, 80) || image;

                    if ((preview.css('background-image') || '').indexOf(image) >= 0) {
                        return;
                    }

                    this.$node.removeClass(nonConceptClsName).addClass('loading');

                    deferredImage(image)
                    .always(function() {
                        preview.css('background-image', `url('${image}')`)
                        activePreview.css('background-image', `url('${activeImage}')`)
                    })
                    .done(function() {
                        let imageIsFromConcept = !vertex || F.vertex.imageIsFromConcept(vertex);
                        if (!image || concept.glyphIconHref === image) {
                            self.$node.toggleClass(nonConceptClsName, !imageIsFromConcept)
                            .removeClass('loading');
                        } else {
                            _.delay(function() {
                                deferredImage(image).always(function() {
                                   preview.css('background-image', 'url(' + image + ')');
                                    activePreview.css('background-image', 'url(' + image + ')');
                                    self.$node.toggleClass(nonConceptClsName, !imageIsFromConcept)
                                    .removeClass('loading');
                                })
                            }, 500);
                        }
                    });
                }
            }
        };

        this.onVideoPreviewActivated = function() {
            moveScrubber(this.preview, this.activePreview);
        };

        this.onVideoPreviewDeactivated = function() {
            moveScrubber(this.activePreview, this.preview);
        }
    }

    function moveScrubber(source, dest) {
            var scrubber = source.find('.org-bigconnect-video-scrubber');
            if (scrubber) {
                scrubber.appendTo(dest);
                dest.css('display', 'block');
                source.css('display', 'none');
            }
    }
});
