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
package com.mware.web.product.graph.routes;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcAccessDeniedException;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.schema.GraphProductSchema;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.user.User;
import com.mware.ge.Authorizations;
import com.mware.ge.Edge;
import com.mware.ge.Graph;
import com.mware.ge.mutation.ElementMutation;
import com.mware.product.WorkProductServiceHasElementsBase;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.parameterProviders.SourceGuid;
import com.mware.web.product.graph.GraphWorkProductService;
import com.mware.workspace.WorkspaceHelper;

@Singleton
public class NodeSetTitle implements ParameterizedHandler {
    private final Graph graph;
    private final WorkspaceRepository workspaceRepository;
    private final WebQueueRepository webQueueRepository;
    private final AuthorizationRepository authorizationRepository;
    private final WorkspaceHelper workspaceHelper;
    @Inject
    public NodeSetTitle(
            Graph graph,
            WorkspaceRepository workspaceRepository,
            WebQueueRepository webQueueRepository,
            AuthorizationRepository authorizationRepository,
            WorkspaceHelper workspaceHelper
    ) {
        this.graph = graph;
        this.workspaceRepository = workspaceRepository;
        this.webQueueRepository = webQueueRepository;
        this.authorizationRepository = authorizationRepository;
        this.workspaceHelper = workspaceHelper;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "compoundNodeId") String compoundNodeId,
            @Required(name = "title") String title,
            @Required(name = "productId") String productId,
            @ActiveWorkspaceId String workspaceId,
            @SourceGuid String sourceGuid,
            User user
    ) throws Exception {
        if (!workspaceRepository.hasWritePermissions(workspaceId, user)) {
            throw new BcAccessDeniedException(
                    "user " + user.getUserId() + " does not have write access to workspace " + workspaceId,
                    user,
                    workspaceId
            );
        }

        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                WorkspaceRepository.VISIBILITY_STRING,
                workspaceId
        );

        String edgeId = WorkProductServiceHasElementsBase.getEdgeId(productId, compoundNodeId);
        Edge productEdge = graph.getEdge(edgeId, authorizations);
        ElementMutation<Edge> m = productEdge.prepareMutation();
        GraphProductSchema.NODE_TITLE.setProperty(m, title, GraphWorkProductService.VISIBILITY.getVisibility());
        m.save(authorizations);
        graph.flush();

        workspaceHelper.broadcastWorkProductChange(workspaceId, productId, sourceGuid, user, authorizations);

        return BcResponse.SUCCESS;
    }
}
