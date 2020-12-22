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

import com.mware.core.orm.Entity;
import com.mware.core.orm.Field;
import com.mware.core.orm.Id;
import org.apache.commons.lang.StringUtils;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;

@Entity(tableName = "artifactThumbnail")
public class ArtifactThumbnail {
    @Id
    private String id;

    @Field
    private byte[] data;

    @Field
    private String format;

    // Used by SimpleOrm to create instance
    @SuppressWarnings("UnusedDeclaration")
    protected ArtifactThumbnail() {
    }

    public ArtifactThumbnail(
            String artifactVertexId,
            String type,
            byte[] data,
            String format,
            int width, int height
    ) {
        this.id = createId(artifactVertexId, type, width, height);
        this.data = data;
        this.format = format;
    }

    public static String createId(String artifactVertexId, String type, int width, int height) {
        return artifactVertexId
                + ":" + type
                + ":" + StringUtils.leftPad(Integer.toString(width), 8, '0')
                + ":" + StringUtils.leftPad(Integer.toString(height), 8, '0');
    }

    public byte[] getData() {
        return data;
    }

    public String getFormat() {
        return format;
    }

    public BufferedImage getImage() {
        try {
            byte[] data = getData();
            return ImageIO.read(new ByteArrayInputStream(data));
        } catch (IOException e) {
            throw new RuntimeException("Could not load image", e);
        }
    }
}
