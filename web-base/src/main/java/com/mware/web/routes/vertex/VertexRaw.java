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
package com.mware.web.routes.vertex;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.MediaBcSchema;
import com.mware.core.model.properties.RawObjectSchema;
import com.mware.core.util.LimitInputStream;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Vertex;
import com.mware.ge.values.storable.StreamingPropertyValue;
import com.mware.web.BadRequestException;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.google.common.base.Preconditions.checkNotNull;

@Singleton
public class VertexRaw implements ParameterizedHandler {
    private static final Pattern RANGE_PATTERN = Pattern.compile("bytes=([0-9]*)-([0-9]*)");

    private final Graph graph;

    @Inject
    public VertexRaw(final Graph graph) {
        this.graph = graph;
    }

    @Handle
    public InputStream handle(
            HttpServletRequest request,
            @Required(name = "graphVertexId") String graphVertexId,
            @Optional(name = "download", defaultValue = "false") boolean download,
            @Optional(name = "playback", defaultValue = "false") boolean playback,
            @Optional(name = "type") String type,
            Authorizations authorizations,
            BcResponse response
    ) throws Exception {
        Vertex artifactVertex = graph.getVertex(graphVertexId, authorizations);
        if (artifactVertex == null) {
            throw new BcResourceNotFoundException("Could not find vertex with id: " + graphVertexId);
        }

        String fileName = BcSchema.FILE_NAME.getOnlyPropertyValue(artifactVertex);

        if (playback) {
            return handlePartialPlayback(request, response, artifactVertex, fileName, type);
        } else {
            String mimeType = getMimeType(artifactVertex);
            response.setContentType(mimeType);
            response.setMaxAge(BcResponse.EXPIRES_1_HOUR);
            if (fileName == null) {
                throw new BcResourceNotFoundException("Could not find fileName on artifact: " + artifactVertex.getId());
            }
            String fileNameWithoutQuotes = fileName.replace('"', '\'');

            if (download) {
                response.addHeader("Content-Disposition", "attachment; filename=\"" + fileNameWithoutQuotes + "\"");
            } else {
                response.addHeader("Content-Disposition", "inline; filename=\"" + fileNameWithoutQuotes + "\"");
            }

            StreamingPropertyValue rawValue = BcSchema.RAW.getPropertyValue(artifactVertex);
            if (rawValue == null) {
                throw new BcResourceNotFoundException("Could not find raw on artifact: " + artifactVertex.getId());
            }
            return rawValue.getInputStream();
        }
    }

    private InputStream handlePartialPlayback(HttpServletRequest request, BcResponse response, Vertex artifactVertex, String fileName, String type) throws IOException {
        if (type == null) {
            throw new BadRequestException("type is required for partial playback");
        }

        InputStream in;
        Long totalLength;
        long partialStart = 0;
        Long partialEnd = null;
        String range = request.getHeader("Range");

        if (range != null) {
            response.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);

            Matcher m = RANGE_PATTERN.matcher(range);
            if (m.matches()) {
                partialStart = Long.parseLong(m.group(1));
                if (m.group(2).length() > 0) {
                    partialEnd = Long.parseLong(m.group(2));
                }
            }
        }

        response.setCharacterEncoding(null);
        response.setContentType(type);
        response.addHeader("Content-Disposition", "attachment; filename=" + fileName);

        StreamingPropertyValue mediaPropertyValue = getStreamingPropertyValue(artifactVertex, type);

        totalLength = mediaPropertyValue.getLength();
        in = mediaPropertyValue.getInputStream();

        if (partialEnd == null) {
            partialEnd = totalLength;
        }

        // Ensure that the last byte position is less than the instance-length
        partialEnd = Math.min(partialEnd, totalLength - 1);
        long partialLength = totalLength;

        if (range != null) {
            partialLength = partialEnd - partialStart + 1;
            response.addHeader("Content-Range", "bytes " + partialStart + "-" + partialEnd + "/" + totalLength);
            if (partialStart > 0) {
                in.skip(partialStart);
            }
        }

        response.addHeader("Content-Length", "" + partialLength);

        return new LimitInputStream(in, partialLength);
    }

    private StreamingPropertyValue getStreamingPropertyValue(Vertex artifactVertex, String type) {
        StreamingPropertyValue mediaPropertyValue = BcSchema.RAW.getPropertyValue(artifactVertex);

        if (!MediaBcSchema.MIME_TYPE_AUDIO_MP4.equals(type)
                && !MediaBcSchema.MIME_TYPE_AUDIO_OGG.equals(type)
                && !MediaBcSchema.MIME_TYPE_VIDEO_WEBM.equals(type)
                && !MediaBcSchema.MIME_TYPE_VIDEO_MP4.equals(type)) {
            throw new BcException("Invalid video type: " + type);
        }
        return mediaPropertyValue;
    }

    private String getMimeType(Vertex artifactVertex) {
        String mimeType = BcSchema.MIME_TYPE.getFirstPropertyValue(artifactVertex);
        if (mimeType == null || mimeType.isEmpty()) {
            mimeType = "application/octet-stream";
        }
        return mimeType;
    }
}
