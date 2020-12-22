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
package com.mware.artifactThumbnails;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.properties.types.BooleanBcProperty;
import com.mware.core.model.properties.types.IntegerBcProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.orm.SimpleOrmContext;
import com.mware.core.orm.SimpleOrmSession;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.Authorizations;
import com.mware.ge.Vertex;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

import static com.google.common.base.Preconditions.checkNotNull;
import static com.mware.core.model.schema.SchemaRepository.PUBLIC;

@Singleton
public class ArtifactThumbnailRepository {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(ArtifactThumbnailRepository.class);
    private static final String VISIBILITY_STRING = "";
    private final SimpleOrmSession simpleOrmSession;
    private final UserRepository userRepository;
    private BooleanBcProperty yAxisFlippedProperty;
    private IntegerBcProperty clockwiseRotationProperty;

    @Inject
    public ArtifactThumbnailRepository(
            SimpleOrmSession simpleOrmSession,
            UserRepository userRepository,
            final SchemaRepository schemaRepository
    ) {
        this.simpleOrmSession = simpleOrmSession;
        this.userRepository = userRepository;

        String yAxisFlippedPropertyName = schemaRepository.getPropertyNameByIntent("media.yAxisFlipped", PUBLIC);
        if (yAxisFlippedPropertyName != null) {
            this.yAxisFlippedProperty = new BooleanBcProperty(yAxisFlippedPropertyName);
        }

        String clockwiseRotationPropertyName = schemaRepository.getPropertyNameByIntent("media.clockwiseRotation", PUBLIC);
        if (clockwiseRotationPropertyName != null) {
            this.clockwiseRotationProperty = new IntegerBcProperty(clockwiseRotationPropertyName);
        }
    }

    public ArtifactThumbnail getThumbnail(String artifactVertexId,
                                          String thumbnailType,
                                          int width,
                                          int height,
                                          User user,
                                          Authorizations authorizations) {
        final SimpleOrmContext ormContext = authorizations != null
                ? userRepository.getSimpleOrmContext(authorizations.getAuthorizations())
                : userRepository.getSimpleOrmContext(user);
        String id = ArtifactThumbnail.createId(artifactVertexId, thumbnailType, width, height);
        return simpleOrmSession.findById(ArtifactThumbnail.class, id, ormContext);
    }

    public byte[] getThumbnailData(String artifactVertexId, String thumbnailType, int width, int height, User user) {
        ArtifactThumbnail artifactThumbnail = getThumbnail(artifactVertexId, thumbnailType, width, height, user, null);
        if (artifactThumbnail == null) {
            return null;
        }
        return artifactThumbnail.getData();
    }

    public ArtifactThumbnail createThumbnail(Vertex artifactVertex,
                                             String propertyKey,
                                             String thumbnailType,
                                             InputStream in,
                                             int[] boundaryDims,
                                             User user,
                                             Authorizations authorizations) {
        ArtifactThumbnail thumbnail = generateThumbnail(artifactVertex, propertyKey, thumbnailType, in, boundaryDims);
        final SimpleOrmContext ormContext = authorizations != null
                ? userRepository.getSimpleOrmContext(authorizations.getAuthorizations())
                : userRepository.getSimpleOrmContext(user);
        simpleOrmSession.save(thumbnail, VISIBILITY_STRING, ormContext);
        return thumbnail;
    }

    public ArtifactThumbnail generateThumbnail(Vertex artifactVertex, String propertyKey, String thumbnailType, InputStream in, int[] boundaryDims) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        String format;
        int type;
        try {
            BufferedImage originalImage = ImageIO.read(in);
            checkNotNull(originalImage, "Could not generateThumbnail: read original image for artifact " + artifactVertex.getId());
            type = ImageUtils.thumbnailType(originalImage);
            format = ImageUtils.thumbnailFormat(originalImage);

            BufferedImage transformedImage = getTransformedImage(originalImage, artifactVertex, propertyKey);

            //Get new image dimensions, which will be used for the icon.
            int[] transformedImageDims = new int[]{transformedImage.getWidth(), transformedImage.getHeight()};
            int[] newImageDims = getScaledDimension(transformedImageDims, boundaryDims);
            if (newImageDims[0] >= transformedImageDims[0] || newImageDims[1] >= transformedImageDims[1]) {
                LOGGER.info("Original image dimensions %d x %d are smaller "
                                + "than requested dimensions %d x %d returning original.",
                        transformedImageDims[0], transformedImageDims[1],
                        newImageDims[0], newImageDims[1]);
            }
            //Resize the image.
            BufferedImage resizedImage = new BufferedImage(newImageDims[0], newImageDims[1], type);
            Graphics2D g = resizedImage.createGraphics();
            int width = resizedImage.getWidth();
            int height = resizedImage.getHeight();
            if (transformedImage.getColorModel().getNumComponents() != 3) {
                g.drawImage(transformedImage, 0, 0, width, height, null);
            } else {
                g.drawImage(transformedImage, 0, 0, width, height, Color.BLACK, null);
            }
            g.dispose();

            //Write the bufferedImage to a file.
            ImageIO.write(resizedImage, format, out);

            return new ArtifactThumbnail(artifactVertex.getId(), thumbnailType, out.toByteArray(), format, width, height);
        } catch (IOException e) {
            throw new BcResourceNotFoundException("Error reading InputStream");
        }
    }

    public BufferedImage getTransformedImage(BufferedImage originalImage, Vertex artifactVertex, String propertyKey) {
        int cwRotationNeeded = 0;
        if (clockwiseRotationProperty != null) {
            Integer nullable = clockwiseRotationProperty.getPropertyValue(artifactVertex, propertyKey);
            if (nullable != null) {
                cwRotationNeeded = nullable;
            }
        }
        boolean yAxisFlipNeeded = false;
        if (yAxisFlippedProperty != null) {
            Boolean nullable = yAxisFlippedProperty.getPropertyValue(artifactVertex, propertyKey);
            if (nullable != null) {
                yAxisFlipNeeded = nullable;
            }
        }

        //Rotate and flip image.
        return ImageUtils.reOrientImage(originalImage, yAxisFlipNeeded, cwRotationNeeded);
    }

    public int[] getScaledDimension(int[] imgSize, int[] boundary) {
        int originalWidth = imgSize[0];
        int originalHeight = imgSize[1];
        int boundWidth = boundary[0];
        int boundHeight = boundary[1];
        int newWidth = originalWidth;
        int newHeight = originalHeight;

        if (originalWidth > boundWidth) {
            newWidth = boundWidth;
            newHeight = (newWidth * originalHeight) / originalWidth;
        }

        if (newHeight > boundHeight) {
            newHeight = boundHeight;
            newWidth = (newHeight * originalWidth) / originalHeight;
        }

        return new int[]{newWidth, newHeight};
    }
}
