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
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.*;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.util.VisibilityValidator;

import java.util.ResourceBundle;

@Singleton
public class EdgeSetPropertyVisibility implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(EdgeSetPropertyVisibility.class);
    private final Graph graph;
    private final WorkspaceRepository workspaceRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final GraphRepository graphRepository;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;

    @Inject
    public EdgeSetPropertyVisibility(
            Graph graph,
            WorkspaceRepository workspaceRepository,
            VisibilityTranslator visibilityTranslator,
            GraphRepository graphRepository,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository
    ) {
        this.graph = graph;
        this.workspaceRepository = workspaceRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.graphRepository = graphRepository;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "graphEdgeId") String graphEdgeId,
            @Required(name = "newVisibilitySource") String newVisibilitySource,
            @Optional(name = "oldVisibilitySource") String oldVisibilitySource,
            @Optional(name = "propertyKey") String propertyKey,
            @Required(name = "propertyName") String propertyName,
            @ActiveWorkspaceId String workspaceId,
            ResourceBundle resourceBundle,
            User user,
            Authorizations authorizations
    ) throws Exception {
        Edge edge = graph.getEdge(graphEdgeId, authorizations);
        if (edge == null) {
            throw new BcResourceNotFoundException("Could not find edge: " + graphEdgeId, graphEdgeId);
        }

        VisibilityValidator.validate(graph, visibilityTranslator, resourceBundle, newVisibilitySource, user, authorizations);

        // add the vertex to the workspace so that the changes show up in the diff panel
        workspaceRepository.updateEntityOnWorkspace(workspaceId, edge.getVertexId(Direction.IN), user);
        workspaceRepository.updateEntityOnWorkspace(workspaceId, edge.getVertexId(Direction.OUT), user);

        Property property = graphRepository.updatePropertyVisibilitySource(
                edge,
                propertyKey,
                propertyName,
                oldVisibilitySource,
                newVisibilitySource,
                workspaceId,
                user,
                authorizations
        );
        this.graph.flush();

        webQueueRepository.broadcastPropertyChange(edge, property.getKey(), property.getName(), workspaceId);
        workQueueRepository.pushOnDwQueue(
                edge,
                property.getKey(),
                property.getName(),
                workspaceId,
                newVisibilitySource,
                Priority.HIGH,
                ElementOrPropertyStatus.UPDATE,
                null
        );

        return BcResponse.SUCCESS;
    }
}
