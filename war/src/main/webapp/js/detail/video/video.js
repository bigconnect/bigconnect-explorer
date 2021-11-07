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
    'util/video/scrubber',
    'util/vertex/formatters',
    'util/withDataRequest',
    'util/requirejs/promise!util/service/propertiesPromise',
    './transcriptEntry.hbs',
    'sf'
], function(
    defineComponent,
    VideoScrubber,
    F,
    withDataRequest,
    config,
    transcriptEntryTemplate,
    sf) {
    'use strict';

    return defineComponent(Video, withDataRequest);

    function Video() {

        this.attributes({
            model: null,
            previewSelector: '.video-preview',
            currentTranscriptSelector: '.currentTranscript',
            ignoreUpdateModelNotImplemented: true
        })

        this.after('initialize', function() {
            var self = this;

            this.on('scrubberFrameChange', this.onScrubberFrameChange);
            this.on('playerTimeUpdate', this.onPlayerTimeUpdate);
            this.on('updateModel', this.onUpdateModel);
            this.on(this.$node.parents('.type-content'), 'avLinkClicked', this.onAVLinkClicked);

            this.model = this.attr.model;
            this.render();
        });

        this.render = function() {
            const codecAndFormat = this.getFormatAndCodec();

            if (!_.contains(["MP4", "WEBM"], codecAndFormat.format)) {
                this.videoRendered = false;
                return this.$node.empty();
            }

            const formatsReady = {
                mp4: "MP4" === codecAndFormat.format,
                webm: "WEBM" === codecAndFormat.format
            }

            if (!this.videoRendered) {
                this.$node.html('<div class="video-preview"></div><div class="currentTranscript"></div>')
                var durationProperty = _.findWhere(this.model.properties, { name: config['ontology.intent.property.videoDuration'] });
                if (durationProperty) {
                    this.duration = durationProperty.value * 1000;
                }

                const rawUrl = F.vertex.raw(this.model);
                const posterFrameUrl = F.vertex.image(this.model);
                const videoPreviewImageUrl = F.vertex.videoPreviewImage(this.model);

                VideoScrubber.attachTo(this.select('previewSelector'), {
                    rawUrl,
                    posterFrameUrl,
                    codecAndFormat,
                    videoPreviewImageUrl,
                    duration: this.duration,
                    allowPlayback: true,
                    formatsReady,
                    vertexId: this.model.id
                });
                this.videoRendered = true;
            }

            if (this.videoRendered && !this.transcriptRendered) {
                this.renderTranscript();
            }
        };

        this.renderTranscript = function(key, time) {
            var self = this,
                currentTime = time || 0,
                transcriptProperties = _.where(this.model.properties, { name: ONTOLOGY_CONSTANTS.PROP_VIDEO_TRANSCRIPT });

            if (!transcriptProperties.length) return;

            var transcriptKey = key ? key : transcriptProperties[0].key;

            this.dataRequest('vertex', 'highlighted-text', this.model.id, transcriptKey)
                .catch(function() {
                    return '';
                })
                .then(function(artifactText) {
                    self.currentTranscriptKey = transcriptKey;
                    self.currentTranscript = processArtifactText(artifactText);
                    self.updateCurrentTranscript(currentTime);
                });
        };

        this.onUpdateModel = function(event, data) {
            this.model = data.model;
            this.render();
        };

        this.getFormatAndCodec = function() {
            return {
                format: F.vertex.prop(this.model, ONTOLOGY_CONSTANTS.PROP_VIDEO_FORMAT),
                codec: F.vertex.prop(this.model, ONTOLOGY_CONSTANTS.PROP_VIDEO_CODEC)
            }
        };

        this.onPlayerTimeUpdate = function(evt, data) {
            var time = data.currentTime * 1000;
            this.updateCurrentTranscript(time);
        };

        this.onScrubberFrameChange = function(evt, data) {
            if (!this.duration) {
                if (!this._noDurationWarned) {
                    console.warn('No duration property for artifact, unable to sync transcript');
                    this._noDurationWarned = true;
                }
                return;
            }
            var frameIndex = data.index,
                numberOfFrames = data.numberOfFrames,
                time = (this.duration / numberOfFrames) * frameIndex;

            this.updateCurrentTranscript(time);
        };

        this.updateCurrentTranscript = function(time) {
            var entry = this.findTranscriptEntryForTime(time),
                html = '';

            if (entry) {
                var timeLabel = (_.isUndefined(entry.start) ? '' : formatTimeOffset(entry.start)) +
                    ' - ' +
                    (_.isUndefined(entry.end) ? '' : formatTimeOffset(entry.end));
                html = transcriptEntryTemplate({
                    time: timeLabel,
                    text: formatTranscript(entry.text)
                });
            }
            this.select('currentTranscriptSelector').html(html);
        };

        this.findTranscriptEntryForTime = function(time) {
            if (!this.currentTranscript || !this.currentTranscript.entries) {
                return null;
            }
            var bestMatch = this.currentTranscript.entries[0];
            for (var i = 0; i < this.currentTranscript.entries.length; i++) {
                if (this.currentTranscript.entries[i].start <= time) {
                    bestMatch = this.currentTranscript.entries[i];
                }
            }
            return bestMatch;
        };

        this.onAVLinkClicked = function(event, data) {
            this.trigger(this.select('previewSelector'), 'seekToTime', data);
            if (data.transcriptKey !== this.currentTranscriptKey) {
                this.renderTranscript(data.transcriptKey, data.seekTo);
            }
        };
    }

    function processArtifactText(text) {
        // Looks like JSON ?
        if (/^\s*{/.test(text)) {
            var json;
            try {
                json = JSON.parse(text);
            } catch(e) { /*eslint no-empty:0*/ }

            if (json && !_.isEmpty(json.entries)) {
                return json;
            }
        }
        return null;
    }

    function formatTranscript(text) {
        var div = document.createElement('div')
        div.innerHTML = text;
        return div.textContent;
    }

    function formatTimeOffset(time) {
        return sf('{0:h:mm:ss}', new sf.TimeSpan(time));
    }
});
