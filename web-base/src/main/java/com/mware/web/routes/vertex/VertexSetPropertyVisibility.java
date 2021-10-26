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
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Property;
import com.mware.ge.Vertex;
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
public class VertexSetPropertyVisibility implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexSetPropertyVisibility.class);
    private final Graph graph;
    private final WorkspaceRepository workspaceRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final GraphRepository graphRepository;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;

    @Inject
    public VertexSetPropertyVisibility(
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
            @Required(name = "graphVertexId") String graphVertexId,
            @Required(name = "newVisibilitySource") String newVisibilitySource,
            @Optional(name = "oldVisibilitySource") String oldVisibilitySource,
            @Optional(name = "propertyKey") String propertyKey,
            @Required(name = "propertyName") String propertyName,
            @ActiveWorkspaceId String workspaceId,
            ResourceBundle resourceBundle,
            User user,
            Authorizations authorizations
    ) throws Exception {
        Vertex vertex = graph.getVertex(graphVertexId, authorizations);
        if (vertex == null) {
            throw new BcResourceNotFoundException("Could not find vertex: " + graphVertexId, graphVertexId);
        }

        VisibilityValidator.validate(graph, visibilityTranslator, resourceBundle, newVisibilitySource, user, authorizations);

        // add the vertex to the workspace so that the changes show up in the diff panel
        workspaceRepository.updateEntityOnWorkspace(workspaceId, graphVertexId, user);

        Property property = graphRepository.updatePropertyVisibilitySource(
                vertex,
                propertyKey,
                propertyName,
                oldVisibilitySource,
                newVisibilitySource,
                workspaceId,
                user,
                authorizations
        );
        this.graph.flush();

        if (webQueueRepository.shouldBroadcastGraphPropertyChange(property.getName(), Priority.HIGH)) {
            webQueueRepository.broadcastPropertyChange(vertex, property.getKey(), property.getName(), workspaceId);
        }
        workQueueRepository.pushOnDwQueue(
                vertex,
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
