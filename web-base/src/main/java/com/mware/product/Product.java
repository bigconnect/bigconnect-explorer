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
package com.mware.product;

import com.mware.core.util.JSONUtil;
import com.mware.ge.values.storable.TextValue;
import org.json.JSONObject;

import java.io.Serializable;
import java.util.Map;

public abstract class Product implements Serializable {
    static long serialVersionUID = 1L;
    private final String id;
    private final String workspaceId;
    private final String title;
    private final String kind;
    private final Map<String, Object> data;
    private final Map<String, Object> extendedData;
    private final String previewImageMD5;

    public Product(String id, String workspaceId, String kind, String title, JSONObject data, JSONObject extendedData, String md5) {
        this.id = id;
        this.workspaceId = workspaceId;
        this.kind = kind;
        this.data = data == null ? null : JSONUtil.toMap(data);
        this.extendedData = extendedData == null ? null : JSONUtil.toMap(extendedData);
        this.title = title;
        this.previewImageMD5 = md5;
    }

    public String getId() {
        return id;
    }

    public String getWorkspaceId() {
        return workspaceId;
    }

    public String getKind() {
        return kind;
    }

    public String getTitle() {
        return title;
    }

    public Map<String, Object> getData() {
        return data;
    }

    public Map<String, Object> getExtendedData() {
        return extendedData;
    }

    public String getPreviewImageMD5() {
        return previewImageMD5;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }

        Product product = (Product) o;

        return id.equals(product.id);
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }

    @Override
    public String toString() {
        return "Product{" +
                "title='" + getTitle() + '\'' +
                ", id='" + id + '\'' +
                ", workspaceId='" + workspaceId + '\'' +
                '}';
    }
}
