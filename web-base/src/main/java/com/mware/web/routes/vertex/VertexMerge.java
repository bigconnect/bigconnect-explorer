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
import com.mware.core.exception.BcAccessDeniedException;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.graph.GraphUpdateContext;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.types.PropertyMetadata;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceHelper;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.BcVisibility;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.SandboxStatusUtil;
import com.mware.ge.*;
import com.mware.security.ACLProvider;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.parameterProviders.JustificationText;
import com.mware.web.util.VisibilityValidator;

import java.time.ZonedDateTime;
import java.util.*;

@Singleton
public class VertexMerge implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexMerge.class);

    private static final String MULTI_VALUE_KEY = ResolveTermEntity.class.getName();
    private final Graph graph;
    private final GraphRepository graphRepository;
    private final SchemaRepository schemaRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final WorkspaceRepository workspaceRepository;
    private final WorkQueueRepository workQueueRepository;
    private final WorkspaceHelper workspaceHelper;
    private final ACLProvider aclProvider;

    @Inject
    public VertexMerge(
            final Graph graph,
            final GraphRepository graphRepository,
            final SchemaRepository schemaRepository,
            final VisibilityTranslator visibilityTranslator,
            final WorkspaceRepository workspaceRepository,
            final WorkQueueRepository workQueueRepository,
            final WorkspaceHelper workspaceHelper,
            final ACLProvider aclProvider
    ) {
        this.graph = graph;
        this.graphRepository = graphRepository;
        this.schemaRepository = schemaRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.workspaceRepository = workspaceRepository;
        this.workQueueRepository = workQueueRepository;
        this.workspaceHelper = workspaceHelper;
        this.aclProvider = aclProvider;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "visibilitySource") String visibilitySource,
            @Required(name = "selectedIds[]") String[] selectedIds,
            @Optional(name = "sign") String title,
            @Optional(name = "resolvedVertexId") String resolvedVertexId,
            @Optional(name = "sourceInfo") String sourceInfoString,
            @Optional(name = "conceptId") String conceptId,
            @JustificationText String justificationText,
            @ActiveWorkspaceId String workspaceId,
            ResourceBundle resourceBundle,
            User user,
            Authorizations authorizations
    ) throws Exception {
        Workspace workspace = workspaceRepository.findById(workspaceId, user);

        VisibilityJson visibilityJson = VisibilityJson.updateVisibilitySourceAndAddWorkspaceId(null, visibilitySource, workspaceId);
        VisibilityValidator.validate(graph, visibilityTranslator, resourceBundle, visibilityJson, user, authorizations);

        String id = resolvedVertexId == null ? graph.getIdGenerator().nextId() : resolvedVertexId;


        BcVisibility bcVisibility = visibilityTranslator.toVisibility(visibilityJson);
        Visibility visibility = bcVisibility.getVisibility();
        ZonedDateTime modifiedDate = ZonedDateTime.now();

        PropertyMetadata propertyMetadata = new PropertyMetadata(modifiedDate, user, visibilityJson, visibility);

        Vertex targetVertex = null;
        List<String> selectedVerticesIds = new LinkedList<String>(Arrays.asList(selectedIds));

        try (GraphUpdateContext ctx = graphRepository.beginGraphUpdate(Priority.NORMAL, user, authorizations)) {
            if (resolvedVertexId != null) {
                // Remove target id from selected vertices
                List<String> toRemove = new ArrayList<String>();
                for (String vId : selectedVerticesIds) {
                    if (vId.equalsIgnoreCase(resolvedVertexId)) {
                        toRemove.add(vId);
                    }
                }
                selectedVerticesIds.removeAll(toRemove);
                targetVertex = graph.getVertex(id, authorizations);
                conceptId = targetVertex.getConceptType();
            } else {
                if (conceptId == null) {
                    throw new BcException("conceptId required when creating entity");
                }

                final String conceptType = conceptId;
                targetVertex = ctx.getOrCreateVertexAndUpdate(id, visibility, conceptType, elemCtx -> {
                    elemCtx.updateBuiltInProperties(propertyMetadata);
                    BcSchema.TITLE.updateProperty(elemCtx, MULTI_VALUE_KEY, title, propertyMetadata);
                    if (justificationText != null && sourceInfoString == null) {
                        BcSchema.JUSTIFICATION.updateProperty(elemCtx, justificationText, propertyMetadata);
                    }
                }).get();

            }

            //Go through each vertex
            for (String currentId : selectedVerticesIds) {
                Vertex currentVertex = graph.getVertex(currentId, authorizations);

                Iterable<String> outEdges = currentVertex.getEdgeIds(Direction.OUT, authorizations);
                Iterator outEdgesIdsIterator = outEdges.iterator();
                //Go through all edges and move them
                while (outEdgesIdsIterator.hasNext()) {
                    String edgeId = (String) outEdgesIdsIterator.next();
                    Edge edge = graph.getEdge(edgeId, authorizations);
                    Edge newEdge = ctx.getOrCreateEdgeAndUpdate(null, targetVertex.getId()
                            , edge.getOtherVertexId(currentVertex.getId()), edge.getLabel(), edge.getVisibility(), edgeCtx -> {
                                edgeCtx.updateBuiltInProperties(propertyMetadata);
                            }).get();
                }

                Iterable<String> inEdges = currentVertex.getEdgeIds(Direction.IN, authorizations);
                Iterator inEdgesIdsIterator = inEdges.iterator();
                //Go through all edges and move them
                while (inEdgesIdsIterator.hasNext()) {
                    String edgeId = (String) inEdgesIdsIterator.next();
                    Edge edge = graph.getEdge(edgeId, authorizations);
                    Edge newEdge = ctx.getOrCreateEdgeAndUpdate(null
                            , edge.getOtherVertexId(currentVertex.getId()), targetVertex.getId(), edge.getLabel(), edge.getVisibility(), edgeCtx -> {
                                edgeCtx.updateBuiltInProperties(propertyMetadata);
                            }).get();
                }

                if (!aclProvider.canDeleteElement(currentVertex, user, workspaceId)) {
                    throw new BcAccessDeniedException("Vertex " + currentVertex.getId() + " is not deleteable", user,
                            currentVertex.getId());
                }

                SandboxStatus sandboxStatus = SandboxStatusUtil.getSandboxStatus(currentVertex, workspaceId);
                boolean isPublicVertex = sandboxStatus == SandboxStatus.PUBLIC;
                workspaceHelper.deleteVertex(currentVertex, workspaceId, isPublicVertex, Priority.HIGH, authorizations, user);
            }

        }
        if (resolvedVertexId == null && targetVertex != null) {
            workspaceRepository.updateEntityOnWorkspace(workspace, targetVertex.getId(), user);
        }

        this.graph.flush();

        return BcResponse.SUCCESS;
    }
}
