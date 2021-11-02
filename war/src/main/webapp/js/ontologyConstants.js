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
const ONTOLOGY_CONSTANTS = {
    PUBLIC_ONTOLOGY: 'public-ontology',

    EDGE_LABEL: '__edgeLabel',
    EDGE_THING: 'topObjectProperty',
    ROOT_CONCEPT: '__root',
    THING_CONCEPT: 'thing',

    PROP_TITLE: 'title',
    PROP_COMMENT_ENTRY: 'commentEntry',
    PROP_COMMENT_PATH: 'commentPath',
    PROP_VISIBILITY_JSON: 'visibilityJson',
    PROP_SANDBOX_STATUS: 'sandboxStatus',
    PROP_CONCEPT_TYPE: 'conceptType',
    PROP_JUSTIFICATION: 'justification',
    PROP_MODIFIED_BY: 'modifiedBy',
    PROP_MODIFIED_DATE: 'modifiedDate',
    PROP_TEXT: 'text',
    PROP_VIDEO_TRANSCRIPT: 'videoTranscript',
    PROP_RAW_POSTER_FRAME: 'rawPosterFrame',
    PROP_RAW_LANGUAGE: 'language',
    PROP_VIDEO_FORMAT: 'mediaVideoFormat',
    PROP_AUDIO_FORMAT: 'mediaAudioFormat',
    PROP_VIDEO_CODEC: 'mediaVideoCodec',
    PROP_AUDIO_CODEC: 'mediaAudioCodec',
    PROP_VIDEO_PREVIEW_IMAGE: 'videoPreviewImage',
    PROP_DETECTED_OBJECT: 'detectedObject',
    PROP_DETECTED_OBJECT_META: '_ado',
    PROP_LINK_TITLE: 'linkTitle',
    PROP_TEXT_DESCRIPTION: 'textDescription',
    PROP_INPUT_PRECISION: 'inputPrecision',
    PROP_MIME_TYPE: 'mimeType',
    PROP_SOURCE_URL: 'sourceUrl',
    PROP_SOURCE_TIMEZONE: 'sourceTimezone',
    PROP_SOURCE_TIMEZONE_OFFSET: 'sourceTimezoneOffset',
    PROP_SOURCE_TIMEZONE_OFFSET_DST: 'sourceTimezoneOffsetDst',
    PROP_RAW: 'raw',
    PROP_GEOSHAPE: 'geoShape',
    PROP_SENTIMENT: 'sentiment',

    PROP_METADATA_IMAGE_SCORE: 'imageTagScore',

    EDGE_LABEL_HAS_IMAGE: 'entityHasImageRaw',

    CONCEPT_TYPE_LONG_RUNNING_PROCESS: '__lrp',
    CONCEPT_TYPE_PING: '__p',
    CONCEPT_TYPE_SAVED_SEARCH: '__ss',
    CONCEPT_TYPE_USER: '__usr',
    CONCEPT_TYPE_ROLE: '__rl',
    CONCEPT_TYPE_DASHBOARD: '__dbd',
    CONCEPT_TYPE_DASHBOARD_ITEM: '__dbdi',
    CONCEPT_TYPE_WORKSPACE: '__ws',
    CONCEPT_TYPE_RAW: 'raw',
    CONCEPT_TYPE_PERSON: 'person',
    CONCEPT_TYPE_EVENT: 'event',
    CONCEPT_TYPE_LOCATION: 'location',
    CONCEPT_TYPE_ORGANIZATION: 'organization',
    CONCEPT_TYPE_VIDEO: 'video',
    CONCEPT_TYPE_IMAGE: 'image',
    CONCEPT_TYPE_AUDIO: 'audio',
    CONCEPT_TYPE_DOCUMENT: 'document'
}
