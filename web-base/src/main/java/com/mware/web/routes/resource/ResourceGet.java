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
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.schema.Concept;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.user.User;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import org.apache.commons.lang.StringUtils;

import javax.imageio.ImageIO;
import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.awt.image.FilteredImageSource;
import java.awt.image.ImageFilter;
import java.awt.image.RGBImageFilter;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.google.common.base.Preconditions.checkNotNull;

@Singleton
public class ResourceGet implements ParameterizedHandler {
    private final SchemaRepository ontologyRepository;
    private final boolean disableTint;

    private static Pattern hexPattern = Pattern.compile("^#.*$");
    private static Pattern rgbPattern = Pattern.compile("^\\s*rgb\\((\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*\\)\\s*$");

    @Inject
    public ResourceGet(
            SchemaRepository ontologyRepository,
            Configuration configuration
    ) {
        this.ontologyRepository = ontologyRepository;
        this.disableTint = configuration.getBoolean(ResourceGet.class.getName() + ".disableTint", false);
    }

    @Handle
    public void handle(
            @Required(name = "id") String id,
            @Optional(name = "state") String state,
            @Optional(name = "tint") String tint,
            User user,
            HttpServletRequest request,
            BcResponse response
    ) throws Exception {
        if (disableTint) {
            tint = null;
        }

        Glyph glyph = getConceptImage(id, state, user.getCurrentWorkspaceId());
        if (glyph == null || !glyph.isValid()) {
            throw new BcResourceNotFoundException("Could not find resource with id: " + id);
        }

        response.setContentType("image/png");
        response.setMaxAge(BcResponse.EXPIRES_10_SECONDS);
        glyph.write(tint, request, response);
    }

    private Glyph getConceptImage(String conceptName, String state, String workspaceId) {
        Concept concept = ontologyRepository.getConceptByName(conceptName, workspaceId);
        if (concept == null) {
            return null;
        }

        Glyph glyph = getGlyph(concept, "selected".equals(state));

        if (glyph.isValid()) {
            return glyph;
        }

        String parentConceptIri = concept.getParentConceptName();
        if (parentConceptIri == null) {
            return null;
        }

        return getConceptImage(parentConceptIri, state, workspaceId);
    }

    private Glyph getGlyph(Concept concept, boolean isSelected) {
        Glyph glyph = null;
        if (isSelected && concept.hasGlyphIconSelectedResource()) {
            byte[] resource = concept.getGlyphIconSelected();
            if (resource != null) {
                glyph = new Image(resource);
            } else {
                glyph = new Path("/"+concept.getGlyphIconSelectedFilePath());
            }
        } else if (concept.hasGlyphIconResource()) {
            byte[] resource = concept.getGlyphIcon();
            if (resource != null) {
                glyph = new Image(resource);
            } else {
                glyph = new Path("/"+concept.getGlyphIconFilePath());
            }
        }

        return glyph;
    }

    interface Glyph {
        boolean isValid();
        void write(String tint, HttpServletRequest request, BcResponse response) throws IOException;
    }

    abstract class AbstractGlyph implements Glyph {

        private int[] convert(String tint) {
            if (tint != null) {
                if (hexPattern.matcher(tint).matches()) {
                    int hex = Integer.parseInt(tint.replace("#", ""), 16);
                    int r = (hex >> 16) & 0xff;
                    int g = (hex >> 8) & 0xff;
                    int b = (hex >> 0) & 0xff;
                    return new int[]{r, g, b};
                }

                Matcher m = rgbPattern.matcher(tint);
                if (m.matches()) {
                    return new int[]{
                            Integer.parseInt(m.group(1)),
                            Integer.parseInt(m.group(2)),
                            Integer.parseInt(m.group(3))
                    };
                }
            }
            return null;
        }

        void write(BufferedImage bufferedImage, String tint, OutputStream outputStream) {
            int[] tintColor = convert(tint);
            if (tintColor != null && bufferedImage.getType() == BufferedImage.TYPE_4BYTE_ABGR) {
                ImageFilter filter = new RGBImageFilter() {
                    @Override
                    public int filterRGB(int x, int y, int rgb) {
                        int a = (rgb >> 24) & 0xff;
                        int r = tintColor[0];
                        int g = tintColor[1];
                        int b = tintColor[2];
                        return a << 24 | r << 16 | g << 8 | b;
                    }
                };

                FilteredImageSource filteredImageSource = new FilteredImageSource(bufferedImage.getSource(), filter);
                java.awt.Image image = Toolkit.getDefaultToolkit().createImage(filteredImageSource);

                int width = image.getWidth(null);
                int height = image.getHeight(null);
                bufferedImage = new BufferedImage(width, height, BufferedImage.TYPE_4BYTE_ABGR);
                Graphics g = bufferedImage.getGraphics();
                g.drawImage(image, 0, 0, null);
            }
            try {
                ImageIO.write(bufferedImage, "png", outputStream);
            } catch (IOException e) {
                throw new BcException("Unable to tint image", e);
            }
        }
    }

    class Image extends AbstractGlyph {
        private byte[] img;
        public Image(byte[] img) {
            this.img = img;
        }
        public boolean isValid() {
            if (img == null || img.length <= 0) {
                return false;
            }
            return true;
        }
        public void write(String tint, HttpServletRequest request, BcResponse response) throws IOException {
            try (ByteArrayInputStream is = new ByteArrayInputStream(img)) {
                BufferedImage bufferedImage = ImageIO.read(is);
                write(bufferedImage, tint, response.getOutputStream());
            }
        }
    }

    class Path extends AbstractGlyph {
        private String path;
        public Path(String path) {
            this.path = path;
        }
        public boolean isValid() {
            if (StringUtils.isEmpty(path)) {
                return false;
            }
            return true;
        }
        public void write(String tint, HttpServletRequest request, BcResponse response) throws IOException {
            ServletContext servletContext = request.getServletContext();
            try (InputStream in = servletContext.getResourceAsStream(path)) {
                checkNotNull(in, "Could not find resource: " + path);
                BufferedImage base = ImageIO.read(in);
                write(base, tint, response.getOutputStream());
            }
        }
    }
}
