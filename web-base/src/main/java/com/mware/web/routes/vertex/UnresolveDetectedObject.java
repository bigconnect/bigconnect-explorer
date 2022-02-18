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
package com.mware.web.routes.vertex;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.clientapi.dto.ClientApiVertex;
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.core.model.properties.ArtifactDetectedObject;
import com.mware.core.model.properties.RawObjectSchema;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.WorkspaceHelper;
import com.mware.core.user.User;
import com.mware.core.util.ClientApiConverter;
import com.mware.core.util.SandboxStatusUtil;
import com.mware.ge.Authorizations;
import com.mware.ge.Edge;
import com.mware.ge.Graph;
import com.mware.ge.Vertex;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.ActiveWorkspaceId;

@Singleton
public class UnresolveDetectedObject implements ParameterizedHandler {
    private final Graph graph;
    private final WorkQueueRepository workQueueRepository;
    private final WorkspaceHelper workspaceHelper;

    @Inject
    public UnresolveDetectedObject(
            final Graph graph,
            WorkQueueRepository workQueueRepository,
            final WorkspaceHelper workspaceHelper
    ) {
        this.graph = graph;
        this.workQueueRepository = workQueueRepository;
        this.workspaceHelper = workspaceHelper;
    }

    @Handle
    public ClientApiVertex handle(
            @Required(name = "vertexId") String vertexId,
            @Required(name = "multiValueKey") String multiValueKey,
            @ActiveWorkspaceId String workspaceId,
            User user,
            Authorizations authorizations
    ) throws Exception {
        Vertex artifactVertex = graph.getVertex(vertexId, authorizations);
        ArtifactDetectedObject artifactDetectedObject = RawObjectSchema.DETECTED_OBJECT.getPropertyValue(artifactVertex, multiValueKey);
        Edge edge = graph.getEdge(artifactDetectedObject.getEdgeId(), authorizations);
        Vertex resolvedVertex = edge.getOtherVertex(artifactVertex.getId(), authorizations);

        SandboxStatus edgeSandboxStatus = SandboxStatusUtil.getSandboxStatus(edge, workspaceId);
        boolean isPublicEdge = edgeSandboxStatus == SandboxStatus.PUBLIC;

        workspaceHelper.deleteEdge(workspaceId, edge, artifactVertex, resolvedVertex, isPublicEdge, Priority.HIGH, authorizations, user);

        return (ClientApiVertex) ClientApiConverter.toClientApi(artifactVertex, workspaceId, authorizations);
    }
}
