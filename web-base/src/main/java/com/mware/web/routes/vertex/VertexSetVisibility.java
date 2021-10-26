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
import com.mware.core.exception.BcException;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.clientapi.dto.ClientApiVertex;
import com.mware.core.model.clientapi.dto.Privilege;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.user.PrivilegeRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.ClientApiConverter;
import com.mware.core.util.SandboxStatusUtil;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Vertex;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.parameterProviders.SourceGuid;
import com.mware.web.util.VisibilityValidator;

import java.util.ResourceBundle;
import java.util.Set;

@Singleton
public class VertexSetVisibility implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexSetVisibility.class);
    private final Graph graph;
    private final WorkspaceRepository workspaceRepository;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final GraphRepository graphRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final PrivilegeRepository privilegeRepository;

    @Inject
    public VertexSetVisibility(
            Graph graph,
            WorkspaceRepository workspaceRepository,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository,
            GraphRepository graphRepository,
            VisibilityTranslator visibilityTranslator,
            PrivilegeRepository privilegeRepository
    ) {
        this.graph = graph;
        this.workspaceRepository = workspaceRepository;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
        this.graphRepository = graphRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.privilegeRepository = privilegeRepository;
    }

    @Handle
    public ClientApiVertex handle(
            @Required(name = "graphVertexId") String graphVertexId,
            @Required(name = "visibilitySource") String visibilitySource,
            @ActiveWorkspaceId String workspaceId,
            @SourceGuid String sourceGuid,
            ResourceBundle resourceBundle,
            User user,
            Authorizations authorizations
    ) throws Exception {
        VisibilityValidator.validate(graph, visibilityTranslator, resourceBundle, visibilitySource, user, authorizations);

        Vertex graphVertex = graph.getVertex(graphVertexId, authorizations);
        if (graphVertex == null) {
            throw new BcResourceNotFoundException("Could not find vertex: " + graphVertexId);
        }

        // add the vertex to the workspace so that the changes show up in the diff panel
        workspaceRepository.updateEntityOnWorkspace(workspaceId, graphVertexId, user);

        LOGGER.info("changing vertex (%s) visibility source to %s", graphVertex.getId(), visibilitySource);

        Set<String> privileges = privilegeRepository.getPrivileges(user);
        if (!privileges.contains(Privilege.PUBLISH)) {
            throw new BcException("User does not have access to modify the visibility");
        }

        graphRepository.updateElementVisibilitySource(
                graphVertex,
                SandboxStatusUtil.getSandboxStatus(graphVertex, workspaceId),
                visibilitySource,
                workspaceId,
                authorizations
        );

        this.graph.flush();

        webQueueRepository.broadcastPropertyChange(graphVertex, null, BcSchema.VISIBILITY_JSON.getPropertyName(), workspaceId);
        workQueueRepository.pushOnDwQueue(
                graphVertex,
                null,
                BcSchema.VISIBILITY_JSON.getPropertyName(),
                workspaceId,
                visibilitySource,
                Priority.HIGH,
                ElementOrPropertyStatus.UPDATE,
                null
        );

        return (ClientApiVertex) ClientApiConverter.toClientApi(graphVertex, workspaceId, authorizations);
    }
}
