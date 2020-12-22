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

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.artifactThumbnails.ArtifactThumbnailRepository;
import com.mware.core.model.schema.Concept;
import com.mware.core.model.schema.SchemaConstants;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.ActiveWorkspaceId;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.TimeUnit;

import static com.google.common.base.Preconditions.checkNotNull;

@Singleton
public class MapMarkerImage implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(MapMarkerImage.class);

    private final SchemaRepository ontologyRepository;
    private ArtifactThumbnailRepository artifactThumbnailRepository;
    private final Cache<String, byte[]> imageCache = CacheBuilder.newBuilder()
            .expireAfterWrite(10, TimeUnit.MINUTES)
            .build();

    @Inject
    public MapMarkerImage(
            final SchemaRepository schemaRepository,
            final ArtifactThumbnailRepository artifactThumbnailRepository
    ) {
        this.ontologyRepository = schemaRepository;
        this.artifactThumbnailRepository = artifactThumbnailRepository;
    }

    @Handle
    public void handle(
            @Required(name = "type") String typeStr,
            @Optional(name = "scale", defaultValue = "1") long scale,
            @Optional(name = "heading", defaultValue = "0.0") double headingParam,
            @Optional(name = "selected", defaultValue = "false") boolean selected,
            BcResponse response,
            @ActiveWorkspaceId String workspaceId
    ) throws Exception {
        int heading = roundHeadingAngle(headingParam);
        typeStr = typeStr.isEmpty() ? SchemaConstants.CONCEPT_TYPE_THING : typeStr;
        String cacheKey = typeStr + scale + heading + (selected ? "selected" : "unselected");
        byte[] imageData = imageCache.getIfPresent(cacheKey);
        if (imageData == null) {
            LOGGER.info("map marker cache miss %s (scale: %d, heading: %d)", typeStr, scale, heading);

            Concept concept = ontologyRepository.getConceptByName(typeStr, workspaceId);

            boolean isMapGlyphIcon = false;
            byte[] glyphIcon = getMapGlyphIcon(concept, workspaceId);
            if (glyphIcon != null) {
                isMapGlyphIcon = true;
            } else {
                glyphIcon = getGlyphIcon(concept, workspaceId);
                if (glyphIcon == null) {
                    response.respondWithNotFound();
                    return;
                }
            }

            imageData = getMarkerImage(new ByteArrayInputStream(glyphIcon), scale, selected, heading, isMapGlyphIcon);
            imageCache.put(cacheKey, imageData);
        }

        response.setHeader("Cache-Control", "max-age=" + (5 * 60));
        response.write(imageData);
    }

    private int roundHeadingAngle(double heading) {
        while (heading < 0.0) {
            heading += 360.0;
        }
        while (heading > 360.0) {
            heading -= 360.0;
        }
        return (int) (Math.round(heading / 10.0) * 10.0);
    }

    private byte[] getMarkerImage(InputStream resource, long scale, boolean selected, int heading, boolean isMapGlyphIcon) throws IOException {
        BufferedImage resourceImage = ImageIO.read(resource);
        if (resourceImage == null) {
            return null;
        }

        if (heading != 0) {
            resourceImage = rotateImage(resourceImage, heading);
        }

        BufferedImage backgroundImage = getBackgroundImage(scale, selected);
        if (backgroundImage == null) {
            return null;
        }
        int[] resourceImageDim = new int[]{resourceImage.getWidth(), resourceImage.getHeight()};

        BufferedImage image = new BufferedImage(backgroundImage.getWidth(), backgroundImage.getHeight(), BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        if (isMapGlyphIcon) {
            int[] boundary = new int[]{backgroundImage.getWidth(), backgroundImage.getHeight()};
            int[] scaledDims = artifactThumbnailRepository.getScaledDimension(resourceImageDim, boundary);
            g.drawImage(resourceImage, 0, 0, scaledDims[0], scaledDims[1], null);
        } else {
            g.drawImage(backgroundImage, 0, 0, backgroundImage.getWidth(), backgroundImage.getHeight(), null);
            int size = image.getWidth() * 2 / 3;
            int[] boundary = new int[]{size, size};
            int[] scaledDims = artifactThumbnailRepository.getScaledDimension(resourceImageDim, boundary);
            int x = (backgroundImage.getWidth() - scaledDims[0]) / 2;
            int y = (backgroundImage.getWidth() - scaledDims[1]) / 2;
            g.drawImage(resourceImage, x, y, scaledDims[0], scaledDims[1], null);
        }
        g.dispose();
        return imageToBytes(image);
    }

    private BufferedImage rotateImage(BufferedImage image, int angleDeg) {
        BufferedImage rotatedImage = new BufferedImage(image.getWidth(), image.getHeight(), image.getType());
        Graphics2D g = rotatedImage.createGraphics();
        g.rotate(Math.toRadians(angleDeg), rotatedImage.getWidth() / 2, rotatedImage.getHeight() / 2);
        g.drawImage(image, 0, 0, image.getWidth(), image.getHeight(), null);
        g.dispose();
        return rotatedImage;
    }

    private BufferedImage getBackgroundImage(long scale, boolean selected) throws IOException {
        String imageFileName;
        if (scale == 1) {
            imageFileName = selected ? "marker-background-selected.png" : "marker-background.png";
        } else if (scale == 2) {
            imageFileName = selected ? "marker-background-selected-2x.png" : "marker-background-2x.png";
        } else {
            return null;
        }

        try (InputStream in = MapMarkerImage.class.getResourceAsStream(imageFileName)) {
            checkNotNull(in, "Could not find resource: " + imageFileName);
            return ImageIO.read(in);
        }
    }

    private byte[] imageToBytes(BufferedImage image) throws IOException {
        ByteArrayOutputStream imageData = new ByteArrayOutputStream();
        ImageIO.write(image, "png", imageData);
        imageData.close();
        return imageData.toByteArray();
    }

    private byte[] getMapGlyphIcon(Concept concept, String workspaceId) {
        byte[] mapGlyphIcon = null;
        for (Concept con = concept; mapGlyphIcon == null && con != null; con = ontologyRepository.getParentConcept(con, workspaceId)) {
            mapGlyphIcon = con.getMapGlyphIcon();
        }
        return mapGlyphIcon;
    }

    private byte[] getGlyphIcon(Concept concept, String workspaceId) {
        byte[] glyphIcon = null;
        for (Concept con = concept; glyphIcon == null && con != null; con = ontologyRepository.getParentConcept(con, workspaceId)) {
            glyphIcon = con.hasGlyphIconResource() ? con.getGlyphIcon() : null;
        }
        return glyphIcon;
    }
}
