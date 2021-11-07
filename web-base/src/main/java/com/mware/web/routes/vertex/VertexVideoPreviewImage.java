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
import com.mware.core.model.properties.MediaBcSchema;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Vertex;
import com.mware.ge.values.storable.StreamingPropertyValue;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import org.apache.commons.io.IOUtils;

import java.io.InputStream;
import java.io.OutputStream;

@Singleton
public class VertexVideoPreviewImage implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexVideoPreviewImage.class);
    private final Graph graph;

    @Inject
    public VertexVideoPreviewImage(final Graph graph) {
        this.graph = graph;
    }

    @Handle
    public void handle(
            @Required(name = "graphVertexId") String graphVertexId,
            Authorizations authorizations,
            BcResponse response
    ) throws Exception {
        Vertex artifactVertex = graph.getVertex(graphVertexId, authorizations);
        if (artifactVertex == null) {
            LOGGER.warn("Could not find vertex with id: " + graphVertexId);
            response.respondWithNotFound();
            return;
        }

        StreamingPropertyValue videoPreviewImageValue = MediaBcSchema.VIDEO_PREVIEW_IMAGE.getPropertyValue(artifactVertex);
        if (videoPreviewImageValue == null) {
            LOGGER.warn("Could not find video preview image for artifact: %s", artifactVertex.getId());
            response.respondWithNotFound();
            return;
        }

        try (InputStream in = videoPreviewImageValue.getInputStream()) {
            response.setContentType("image/png");
            response.setMaxAge(BcResponse.EXPIRES_1_HOUR);
            response.addHeader("Content-Disposition", "inline; filename=videoPreview.png");
            try (OutputStream out = response.getOutputStream()) {
                IOUtils.copy(in, out);
            }
        }
    }
}
