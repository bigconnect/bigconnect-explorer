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
package com.mware.web.routes.edge;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.schema.SchemaProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.user.User;
import com.mware.ge.Authorizations;
import com.mware.ge.Edge;
import com.mware.ge.Graph;
import com.mware.security.ACLProvider;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.workspace.WorkspaceHelper;

import javax.servlet.http.HttpServletRequest;

@Singleton
public class EdgeDeleteProperty implements ParameterizedHandler {
    private final Graph graph;
    private final SchemaRepository schemaRepository;
    private final WorkspaceHelper workspaceHelper;
    private final ACLProvider aclProvider;
    private final boolean autoPublishComments;

    @Inject
    public EdgeDeleteProperty(
            final Graph graph,
            final WorkspaceHelper workspaceHelper,
            final SchemaRepository schemaRepository,
            final ACLProvider aclProvider,
            final Configuration configuration
    ) {
        this.graph = graph;
        this.workspaceHelper = workspaceHelper;
        this.schemaRepository = schemaRepository;
        this.aclProvider = aclProvider;
        this.autoPublishComments = configuration.getBoolean(Configuration.COMMENTS_AUTO_PUBLISH,
                Configuration.DEFAULT_COMMENTS_AUTO_PUBLISH);
    }

    @Handle
    public ClientApiSuccess handle(
            HttpServletRequest request,
            @Required(name = "edgeId") String edgeId,
            @Required(name = "propertyKey") String propertyKey,
            @Required(name = "propertyName") String propertyName,
            @ActiveWorkspaceId String workspaceId,
            User user,
            Authorizations authorizations
    ) throws Exception {
        SchemaProperty schemaProperty = schemaRepository.getRequiredPropertyByName(propertyName, workspaceId);

        // TODO remove all properties from all edges? I don't think so
        Edge edge = graph.getEdge(edgeId, authorizations);

        aclProvider.checkCanDeleteProperty(edge, propertyKey, propertyName, user, workspaceId);

        boolean isComment = BcSchema.COMMENT.isSameName(propertyName);

        if (isComment && request.getPathInfo().equals("/edge/property")) {
            throw new BcException("Use /edge/comment to save comment properties");
        } else if (!isComment && request.getPathInfo().equals("/edge/comment")) {
            throw new BcException("Use /edge/property to save non-comment properties");
        }

        if (isComment && autoPublishComments) {
            workspaceId = null;
        }

        workspaceHelper.deleteProperties(edge, propertyKey, propertyName, schemaProperty, workspaceId, authorizations,
                user);

        return BcResponse.SUCCESS;
    }
}
