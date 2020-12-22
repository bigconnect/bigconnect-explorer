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
import com.mware.artifactThumbnails.ArtifactThumbnail;
import com.mware.artifactThumbnails.ArtifactThumbnailRepository;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
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

import java.io.InputStream;
import java.io.OutputStream;

@Singleton
public class VertexThumbnail implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexThumbnail.class);

    private final ArtifactThumbnailRepository artifactThumbnailRepository;
    private final Graph graph;

    @Inject
    public VertexThumbnail(
            final ArtifactThumbnailRepository artifactThumbnailRepository,
            final Graph graph
    ) {
        this.artifactThumbnailRepository = artifactThumbnailRepository;
        this.graph = graph;
    }

    @Handle
    public void handle(
            @Required(name = "graphVertexId") String graphVertexId,
            @Optional(name = "width") Integer width,
            User user,
            Authorizations authorizations,
            BcResponse response
    ) throws Exception {
        Vertex artifactVertex = graph.getVertex(graphVertexId, authorizations);
        if (artifactVertex == null) {
            throw new BcResourceNotFoundException("Could not find vertex with id: " + graphVertexId);
        }

        int[] boundaryDims = new int[]{200, 200};
        if (width != null) {
            boundaryDims[0] = boundaryDims[1] = width;
        }

        byte[] thumbnailData;
        ArtifactThumbnail thumbnail = artifactThumbnailRepository
                .getThumbnail(artifactVertex.getId(), "raw", boundaryDims[0], boundaryDims[1], user, authorizations);
        if (thumbnail != null) {
            String format = thumbnail.getFormat();
            response.setContentType("image/" + format);
            response.addHeader("Content-Disposition", "inline; filename=thumbnail" + boundaryDims[0] + "." + format);
            response.setMaxAge(BcResponse.EXPIRES_1_HOUR);

            thumbnailData = thumbnail.getData();
            if (thumbnailData != null) {
                LOGGER.debug("Cache hit for: %s (raw) %d x %d", artifactVertex.getId(), boundaryDims[0], boundaryDims[1]);
                try (OutputStream out = response.getOutputStream()) {
                    out.write(thumbnailData);
                }
                return;
            }
        }

        LOGGER.info("Cache miss for: %s (raw) %d x %d", artifactVertex.getId(), boundaryDims[0], boundaryDims[1]);
        Property rawProperty = BcSchema.RAW.getProperty(artifactVertex);
        StreamingPropertyValue rawPropertyValue = BcSchema.RAW.getPropertyValue(artifactVertex);
        if (rawPropertyValue == null) {
            throw new BcResourceNotFoundException("Could not find raw property on vertex: " + artifactVertex.getId());
        }

        try (InputStream in = rawPropertyValue.getInputStream()) {
            thumbnail = artifactThumbnailRepository
                    .createThumbnail(artifactVertex, rawProperty.getKey(), "raw", in, boundaryDims, user, authorizations);

            String format = thumbnail.getFormat();
            response.setContentType("image/" + format);
            response.addHeader("Content-Disposition", "inline; filename=thumbnail" + boundaryDims[0] + "." + format);
            response.setMaxAge(BcResponse.EXPIRES_1_HOUR);

            thumbnailData = thumbnail.getData();
        }
        try (OutputStream out = response.getOutputStream()) {
            out.write(thumbnailData);
        }
    }
}
