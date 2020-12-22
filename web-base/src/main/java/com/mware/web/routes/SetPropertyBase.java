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
package com.mware.web.routes;

import com.mware.core.exception.BcException;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.security.VisibilityTranslator;
import com.mware.ge.Graph;

import javax.servlet.http.HttpServletRequest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;

public abstract class SetPropertyBase {
    protected final Graph graph;
    protected final VisibilityTranslator visibilityTranslator;

    protected SetPropertyBase(Graph graph, VisibilityTranslator visibilityTranslator) {
        this.graph = graph;
        this.visibilityTranslator = visibilityTranslator;
    }

    protected boolean isCommentProperty(String propertyName) {
        return BcSchema.COMMENT.isSameName(propertyName);
    }

    protected String createPropertyKey(String propertyName, Graph graph) {
        return isCommentProperty(propertyName) ? createCommentPropertyKey() : graph.getIdGenerator().nextId();
    }

    protected void checkRoutePath(String entityType, String propertyName, HttpServletRequest request) {
        boolean isComment = isCommentProperty(propertyName);
        if (isComment && request.getPathInfo().equals(String.format("/%s/property", entityType))) {
            throw new BcException(String.format("Use /%s/comment to save comment properties", entityType));
        } else if (!isComment && request.getPathInfo().equals(String.format("/%s/comment", entityType))) {
            throw new BcException(String.format("Use /%s/property to save non-comment properties", entityType));
        }
    }

    private static String createCommentPropertyKey() {
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");
        dateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
        return dateFormat.format(new Date());
    }
}
