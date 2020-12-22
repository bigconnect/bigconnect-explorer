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
import com.mware.artifactThumbnails.ArtifactThumbnailRepository;
import com.mware.bigconnect.ffmpeg.ArtifactThumbnailRepositoryProps;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.properties.MediaBcSchema;
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
import org.apache.commons.io.IOUtils;

import java.io.InputStream;
import java.io.OutputStream;

@Singleton
public class VertexVideoPreviewImage implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexVideoPreviewImage.class);
    private final Graph graph;
    private final ArtifactThumbnailRepository artifactThumbnailRepository;

    @Inject
    public VertexVideoPreviewImage(
            final Graph graph,
            final ArtifactThumbnailRepository artifactThumbnailRepository
    ) {
        this.graph = graph;
        this.artifactThumbnailRepository = artifactThumbnailRepository;
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

        int[] boundaryDims = new int[]{200 * ArtifactThumbnailRepositoryProps.FRAMES_PER_PREVIEW, 200};

        if (width != null) {
            boundaryDims[0] = width * ArtifactThumbnailRepositoryProps.FRAMES_PER_PREVIEW;
            boundaryDims[1] = width;

            response.setContentType("image/jpeg");
            response.addHeader("Content-Disposition", "inline; filename=videoPreview" + boundaryDims[0] + ".jpg");
            response.setMaxAge(BcResponse.EXPIRES_1_HOUR);

            byte[] thumbnailData = artifactThumbnailRepository.getThumbnailData(artifactVertex.getId(), "video-preview", boundaryDims[0], boundaryDims[1], user);
            if (thumbnailData != null) {
                LOGGER.debug("Cache hit for: %s (video-preview) %d x %d", artifactVertex.getId(), boundaryDims[0], boundaryDims[1]);
                try (OutputStream out = response.getOutputStream()) {
                    out.write(thumbnailData);
                }
                return;
            }
        }

        Property videoPreviewImage = MediaBcSchema.VIDEO_PREVIEW_IMAGE.getProperty(artifactVertex);
        StreamingPropertyValue videoPreviewImageValue = MediaBcSchema.VIDEO_PREVIEW_IMAGE.getPropertyValue(artifactVertex);
        if (videoPreviewImageValue == null) {
            LOGGER.warn("Could not find video preview image for artifact: %s", artifactVertex.getId());
            response.respondWithNotFound();
            return;
        }
        try (InputStream in = videoPreviewImageValue.getInputStream()) {
            if (width != null) {
                LOGGER.info("Cache miss for: %s (video-preview) %d x %d", artifactVertex.getId(), boundaryDims[0], boundaryDims[1]);

                response.setContentType("image/jpeg");
                response.addHeader("Content-Disposition", "inline; filename=videoPreview" + boundaryDims[0] + ".jpg");
                response.setMaxAge(BcResponse.EXPIRES_1_HOUR);

                byte[] thumbnailData = artifactThumbnailRepository
                        .createThumbnail(artifactVertex, videoPreviewImage.getKey(), "video-preview", in, boundaryDims, user, null).getData();
                try (OutputStream out = response.getOutputStream()) {
                    out.write(thumbnailData);
                }
            } else {
                response.setContentType("image/png");
                try (OutputStream out = response.getOutputStream()) {
                    IOUtils.copy(in, out);
                }
            }
        }
    }
}
