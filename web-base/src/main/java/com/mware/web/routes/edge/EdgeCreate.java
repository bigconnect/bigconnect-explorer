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
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.clientapi.dto.ClientApiEdge;
import com.mware.core.model.clientapi.dto.ClientApiSourceInfo;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.security.AuditEventType;
import com.mware.core.security.AuditService;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.ClientApiConverter;
import com.mware.ge.Authorizations;
import com.mware.ge.Edge;
import com.mware.ge.Graph;
import com.mware.ge.Vertex;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.parameterProviders.JustificationText;
import com.mware.web.util.VisibilityValidator;

import java.util.ResourceBundle;

@Singleton
public class EdgeCreate implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(EdgeCreate.class);

    private final Graph graph;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final GraphRepository graphRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final AuditService auditService;

    @Inject
    public EdgeCreate(
            Graph graph,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository,
            GraphRepository graphRepository,
            VisibilityTranslator visibilityTranslator,
            AuditService auditService
    ) {
        this.graph = graph;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
        this.graphRepository = graphRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.auditService = auditService;
    }

    @Handle
    public ClientApiEdge handle(
            @Optional(name = "edgeId") String edgeId,
            @Required(name = "outVertexId") String outVertexId,
            @Required(name = "inVertexId") String inVertexId,
            @Required(name = "predicateLabel") String predicateLabel,
            @Required(name = "visibilitySource") String visibilitySource,
            @JustificationText String justificationText,
            ClientApiSourceInfo sourceInfo,
            @ActiveWorkspaceId String workspaceId,
            ResourceBundle resourceBundle,
            User user,
            Authorizations authorizations
    ) throws Exception {
        Vertex inVertex = graph.getVertex(inVertexId, authorizations);
        Vertex outVertex = graph.getVertex(outVertexId, authorizations);

        VisibilityValidator.validate(graph, visibilityTranslator, resourceBundle, visibilitySource, user, authorizations);

        Edge edge = graphRepository.addEdge(
                edgeId,
                outVertex,
                inVertex,
                predicateLabel,
                justificationText,
                sourceInfo,
                visibilitySource,
                workspaceId,
                user,
                authorizations
        );

        graph.flush();

        LOGGER.debug("Created new edge with id: %s", edge.getId());
        auditService.auditGenericEvent(user, workspaceId, AuditEventType.CREATE_EDGE, "id", edge.getId());

        webQueueRepository.broadcastPropertyChange(edge, null, null, workspaceId);
        workQueueRepository.pushOnDwQueue(
                edge,
                null,
                null,
                null,
                null,
                Priority.HIGH,
                ElementOrPropertyStatus.UPDATE,
                null
        );
        return (ClientApiEdge) ClientApiConverter.toClientApi(edge, workspaceId, authorizations);
    }
}
