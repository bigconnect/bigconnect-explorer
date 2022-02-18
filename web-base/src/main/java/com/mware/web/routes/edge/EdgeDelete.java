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
import com.mware.core.exception.BcAccessDeniedException;
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workspace.WorkspaceHelper;
import com.mware.core.security.AuditEventType;
import com.mware.core.security.AuditService;
import com.mware.core.user.User;
import com.mware.core.util.SandboxStatusUtil;
import com.mware.ge.*;
import com.mware.security.ACLProvider;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;

@Singleton
public class EdgeDelete implements ParameterizedHandler {
    private final Graph graph;
    private final WorkspaceHelper workspaceHelper;
    private final ACLProvider aclProvider;
    private final AuditService auditService;

    @Inject
    public EdgeDelete(
            final Graph graph,
            final WorkspaceHelper workspaceHelper,
            final ACLProvider aclProvider,
            final AuditService auditService
    ) {
        this.graph = graph;
        this.workspaceHelper = workspaceHelper;
        this.aclProvider = aclProvider;
        this.auditService = auditService;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "edgeId") String edgeId,
            @ActiveWorkspaceId String workspaceId,
            User user,
            Authorizations authorizations
    ) throws Exception {
        Edge edge = graph.getEdge(edgeId, authorizations);
        if (!aclProvider.canDeleteElement(edge, user, workspaceId)) {
            throw new BcAccessDeniedException("Edge " + edgeId + " is not deleteable", user, edge.getId());
        }

        Vertex outVertex = edge.getVertex(Direction.OUT, authorizations);
        Vertex inVertex = edge.getVertex(Direction.IN, authorizations);

        SandboxStatus sandboxStatus = SandboxStatusUtil.getSandboxStatus(edge, workspaceId);

        boolean isPublicEdge = sandboxStatus == SandboxStatus.PUBLIC;

        workspaceHelper.deleteEdge(workspaceId, edge, outVertex, inVertex, isPublicEdge, Priority.HIGH, authorizations, user);
        auditService.auditGenericEvent(user, workspaceId, AuditEventType.DELETE_EDGE, "id", edgeId);

        return BcResponse.SUCCESS;
    }
}
