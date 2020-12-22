
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
    'util/audio/scrubber',
    'util/vertex/formatters'
], function(
    defineComponent,
    AudioScrubber,
    F) {
    'use strict';

    return defineComponent(Audio);

    function Audio() {

        this.attributes({
            model: null,
            previewSelector: '.audio-preview'
        })

        this.after('initialize', function() {
            this.model = this.attr.model;
            this.on('updateModel', function(event, data) {
                this.model = data.model;
                this.render();
            })
            this.on(this.$node.parents('.type-content'), 'avLinkClicked', this.onAVLinkClicked);
            this.render();
        });

        this.render = function() {
            const codecAndFormat = this.getFormatAndCodec();
            const audioPlayable = _.contains(["MP4", "OGG", "MP3", "WEBM", "WAV"], codecAndFormat.format)

            if (!audioPlayable) {
                this.rendered = false;
                return this.$node.empty();
            }
            if (!this.rendered) {
                var rawUrl = F.vertex.raw(this.model);
                if (rawUrl) {
                    this.$node.html('<div class="audio-preview"></div>')
                    AudioScrubber.attachTo(this.select('previewSelector'), {
                        rawUrl: rawUrl
                    });
                    this.rendered = true;
                }
            }
        };

        this.getFormatAndCodec = function() {
            return {
                format: F.vertex.prop(this.model, ONTOLOGY_CONSTANTS.PROP_AUDIO_FORMAT),
                codec: F.vertex.prop(this.model, ONTOLOGY_CONSTANTS.PROP_AUDIO_CODEC)
            }
        };

        this.onAVLinkClicked = function(event, data) {
            this.trigger(this.select('previewSelector'), 'seekToTime', data);
        };
    }
});
