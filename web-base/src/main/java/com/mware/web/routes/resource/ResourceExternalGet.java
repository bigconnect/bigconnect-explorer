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
package com.mware.web.routes.resource;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.properties.RawObjectSchema;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Vertex;
import com.mware.ge.mutation.ExistingElementMutation;
import com.mware.ge.values.storable.ByteArray;
import com.mware.ge.values.storable.DefaultStreamingPropertyValue;
import com.mware.ge.values.storable.StreamingPropertyValue;
import com.mware.http.HttpRepository;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import org.apache.commons.io.IOUtils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;

@Singleton
public class ResourceExternalGet implements ParameterizedHandler {
    private final Graph graph;
    private final HttpRepository httpRepository;

    @Inject
    public ResourceExternalGet(
            final Graph graph,
            final HttpRepository httpRepository
    ) {
        this.graph = graph;
        this.httpRepository = httpRepository;
    }

    @Handle
    public void handle(
            Authorizations authorizations,
            @Required(name = "vId") String vertexId,
            @Required(name = "url") String url,
            @Required(name = "maxWidth") int maxWidth,
            @Required(name = "maxHeight") int maxHeight,
            @Optional(name = "jpegQuality", defaultValue = "80") int jpegQuality,
            BcResponse response
    ) throws Exception {
        String propertyKey = getPropertyKey(url, maxWidth, maxHeight, jpegQuality);
        Vertex vertex = this.graph.getVertex(vertexId, authorizations);
        if (vertex == null) {
            throw new BcResourceNotFoundException("Could not find vertex: " + vertexId);
        }

        InputStream in;
        StreamingPropertyValue cachedImageValue = RawObjectSchema.CACHED_IMAGE.getPropertyValue(vertex, propertyKey);
        if (cachedImageValue != null) {
            in = cachedImageValue.getInputStream();
        } else {
            byte[] imageData = createAndSaveCachedImage(vertex, propertyKey, url, maxWidth, maxHeight, jpegQuality, authorizations);
            in = new ByteArrayInputStream(imageData);
        }

        ImageUtils.ImageFormat imageFormat = ImageUtils.getImageFormat(in);
        String imageMimeType = imageFormat.getImageMimeType();
        if (imageMimeType == null) {
            imageMimeType = "image";
        }

        response.setContentType(imageMimeType);
        response.addHeader("Content-Disposition", "inline; filename=thumbnail-" + maxWidth + "x" + maxHeight + ".jpg");
        response.setMaxAge(BcResponse.EXPIRES_1_HOUR);

        response.write(imageFormat.getPushBackIn());
    }

    private byte[] createAndSaveCachedImage(Vertex vertex, String propertyKey, String url, int maxWidth, int maxHeight, int jpegQuality, Authorizations authorizations) throws IOException {
        byte[] imageData = getAndSaveImageData(vertex, url, authorizations);
        imageData = ImageUtils.resize(imageData, maxWidth, maxHeight, jpegQuality);

        StreamingPropertyValue value = new DefaultStreamingPropertyValue(new ByteArrayInputStream(imageData), ByteArray.class);
        value.searchIndex(false);
        ExistingElementMutation<Vertex> m = vertex.prepareMutation();
        RawObjectSchema.CACHED_IMAGE.addPropertyValue(m, propertyKey, value, vertex.getVisibility());
        m.save(authorizations);
        return imageData;
    }

    private byte[] getAndSaveImageData(Vertex vertex, String url, Authorizations authorizations) throws IOException {
        String propertyKey = getPropertyKey(url, null, null, null);
        StreamingPropertyValue originalImage = RawObjectSchema.CACHED_IMAGE.getPropertyValue(vertex, propertyKey);
        if (originalImage != null) {
            return IOUtils.toByteArray(originalImage.getInputStream());
        }
        byte[] imageData = httpRepository.get(url);
        StreamingPropertyValue value = new DefaultStreamingPropertyValue(new ByteArrayInputStream(imageData), ByteArray.class);
        value.searchIndex(false);
        ExistingElementMutation<Vertex> m = vertex.prepareMutation();
        RawObjectSchema.CACHED_IMAGE.addPropertyValue(m, propertyKey, value, vertex.getVisibility());
        m.save(authorizations);
        return imageData;
    }

    private String getPropertyKey(String url, Integer maxWidth, Integer maxHeight, Integer jpegQuality) {
        String result = url;
        if (maxWidth != null) {
            result += "-" + Integer.toString(maxWidth);
        }
        if (maxHeight != null) {
            result += "-" + Integer.toString(maxHeight);
        }
        if (jpegQuality != null) {
            result += "-" + Integer.toString(jpegQuality);
        }
        return result;
    }
}

