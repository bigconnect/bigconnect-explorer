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
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.properties.BcSchema;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Property;
import com.mware.ge.Vertex;
import com.mware.ge.values.storable.StreamingPropertyValue;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import org.apache.commons.io.IOUtils;

import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Singleton
public class VertexGetPropertyValue implements ParameterizedHandler {
    private static final Pattern RANGE_PATTERN = Pattern.compile("bytes=([0-9]*)-([0-9]*)");
    private Graph graph;

    @Inject
    public VertexGetPropertyValue(
            final Graph graph
    ) {
        this.graph = graph;
    }

    @Handle
    public void handle(
            @Required(name = "graphVertexId") String graphVertexId,
            @Required(name = "propertyKey") String propertyKey,
            @Required(name = "propertyName") String propertyName,
            @Optional(name = "Range") String range,
            @Optional(name = "download", defaultValue = "false") boolean download,
            @Optional(name = "playback", defaultValue = "false") boolean playback,
            Authorizations authorizations,
            BcResponse response
    ) throws Exception {
        PlaybackOptions playbackOptions = new PlaybackOptions();
        playbackOptions.range = range;
        playbackOptions.download = download;
        playbackOptions.playback = playback;

        Vertex vertex = graph.getVertex(graphVertexId, authorizations);
        if (vertex == null) {
            throw new BcResourceNotFoundException(String.format("vertex %s not found", graphVertexId));
        }

        Property property = vertex.getProperty(propertyKey, propertyName);
        if (property == null) {
            throw new BcResourceNotFoundException(String.format("property %s:%s not found on vertex %s", propertyKey, propertyName, vertex.getId()));
        }

        String fileName = BcSchema.FILE_NAME.getOnlyPropertyValue(vertex);

        String mimeType = getMimeType(property);
        if (mimeType != null) {
            response.setContentType(mimeType);
        }

        setFileNameHeaders(response, fileName, playbackOptions);

        long totalLength;
        InputStream in;
        if (property.getValue() instanceof StreamingPropertyValue) {
            StreamingPropertyValue streamingPropertyValue = (StreamingPropertyValue) property.getValue();
            in = streamingPropertyValue.getInputStream();
            totalLength = streamingPropertyValue.getLength();
        } else {
            byte[] value = property.getValue().toString().getBytes();
            in = new ByteArrayInputStream(value);
            totalLength = value.length;
        }

        try {
            if (playbackOptions.playback) {
                handlePartialPlayback(response, in, totalLength, playbackOptions);
            } else {
                handleFullPlayback(response, in);
            }
        } finally {
            in.close();
        }
    }

    private void setFileNameHeaders(BcResponse response, String fileName, PlaybackOptions playbackOptions) {
        if (playbackOptions.download) {
            response.addHeader("Content-Disposition", "attachment; filename=" + fileName);
        } else {
            response.addHeader("Content-Disposition", "inline; filename=" + fileName);
        }
    }

    private void handleFullPlayback(BcResponse response, InputStream in) throws IOException {
        try (OutputStream out = response.getOutputStream()) {
            IOUtils.copy(in, out);
        }
    }

    private void handlePartialPlayback(BcResponse response, InputStream in, long totalLength, PlaybackOptions playbackOptions) throws IOException {
        long partialStart = 0;
        Long partialEnd = null;

        if (playbackOptions.range != null) {
            response.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);

            Matcher m = RANGE_PATTERN.matcher(playbackOptions.range);
            if (m.matches()) {
                partialStart = Long.parseLong(m.group(1));
                if (m.group(2).length() > 0) {
                    partialEnd = Long.parseLong(m.group(2));
                }
            }
        }

        if (partialEnd == null) {
            partialEnd = totalLength;
        }

        // Ensure that the last byte position is less than the instance-length
        partialEnd = Math.min(partialEnd, totalLength - 1);
        long partialLength = totalLength;

        if (playbackOptions.range != null) {
            partialLength = partialEnd - partialStart + 1;
            response.addHeader("Content-Range", "bytes " + partialStart + "-" + partialEnd + "/" + totalLength);
        }

        response.addHeader("Content-Length", "" + partialLength);

        try (OutputStream out = response.getOutputStream()) {
            IOUtils.copyLarge(in, out, partialStart, partialLength);
        }
        response.flushBuffer();
    }

    private String getMimeType(Property property) {
        String mimeType = BcSchema.MIME_TYPE_METADATA.getMetadataValue(property.getMetadata(), null);
        if (mimeType != null) {
            return mimeType;
        }
        return null;
    }

    public class PlaybackOptions {
        public String range;
        public boolean download;
        public boolean playback;
    }
}
