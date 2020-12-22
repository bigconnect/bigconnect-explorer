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
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.clientapi.dto.ClientApiSourceInfo;
import com.mware.core.model.clientapi.dto.ClientApiVertex;
import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.graph.GraphUpdateContext;
import com.mware.core.model.properties.ArtifactDetectedObject;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.RawObjectSchema;
import com.mware.core.model.properties.types.PropertyMetadata;
import com.mware.core.model.schema.Concept;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.termMention.TermMentionRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.BcVisibility;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.ClientApiConverter;
import com.mware.ge.*;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.parameterProviders.JustificationText;
import com.mware.web.util.VisibilityValidator;

import java.time.ZonedDateTime;
import java.util.Date;
import java.util.ResourceBundle;
import java.util.concurrent.atomic.AtomicBoolean;

@Singleton
public class ResolveDetectedObject implements ParameterizedHandler {
    private static final String MULTI_VALUE_KEY_PREFIX = ResolveDetectedObject.class.getName();
    private static final String MULTI_VALUE_KEY = ResolveDetectedObject.class.getName();
    private final Graph graph;
    private final SchemaRepository schemaRepository;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final WorkspaceRepository workspaceRepository;
    private final TermMentionRepository termMentionRepository;
    private final GraphRepository graphRepository;

    @Inject
    public ResolveDetectedObject(
            Graph graph,
            SchemaRepository schemaRepository,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository,
            VisibilityTranslator visibilityTranslator,
            WorkspaceRepository workspaceRepository,
            TermMentionRepository termMentionRepository,
            GraphRepository graphRepository
    ) {
        this.graph = graph;
        this.schemaRepository = schemaRepository;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.workspaceRepository = workspaceRepository;
        this.termMentionRepository = termMentionRepository;
        this.graphRepository = graphRepository;
    }

    @Handle
    public ClientApiVertex handle(
            @Required(name = "artifactId") String artifactId,
            @Required(name = "title") String title,
            @Required(name = "conceptId") String conceptId,
            @Required(name = "visibilitySource") String visibilitySource,
            @Optional(name = "graphVertexId") String graphVertexId,
            @JustificationText String justificationText,
            @Optional(name = "sourceInfo") String sourceInfoString,
            @Optional(name = "originalPropertyKey") String originalPropertyKey,
            @Required(name = "x1") double x1,
            @Required(name = "x2") double x2,
            @Required(name = "y1") double y1,
            @Required(name = "y2") double y2,
            ResourceBundle resourceBundle,
            @ActiveWorkspaceId String workspaceId,
            User user,
            Authorizations authorizations
    ) throws Exception {
        String artifactContainsImageOfEntityIri = schemaRepository.getRequiredRelationshipNameByIntent("artifactContainsImageOfEntity", workspaceId);
        Concept concept = schemaRepository.getConceptByName(conceptId, workspaceId);

        Workspace workspace = workspaceRepository.findById(workspaceId, user);

        VisibilityValidator.validate(graph, visibilityTranslator, resourceBundle, visibilitySource, user, authorizations);

        VisibilityJson visibilityJson = VisibilityJson.updateVisibilitySourceAndAddWorkspaceId(null, visibilitySource, workspaceId);
        BcVisibility bcVisibility = visibilityTranslator.toVisibility(visibilityJson);
        Visibility visibility = bcVisibility.getVisibility();

        ZonedDateTime modifiedDate = ZonedDateTime.now();

        PropertyMetadata propertyMetadata = new PropertyMetadata(modifiedDate, user, visibilityJson, visibility);
        String id = graphVertexId == null ? graph.getIdGenerator().nextId() : graphVertexId;

        Vertex artifactVertex = graph.getVertex(artifactId, authorizations);

        Edge edge;
        Vertex resolvedVertex;
        ArtifactDetectedObject artifactDetectedObject;
        String propertyKey;
        final AtomicBoolean isNewVertex = new AtomicBoolean(false);
        try (GraphUpdateContext ctx = graphRepository.beginGraphUpdate(Priority.NORMAL, user, authorizations)) {
            ctx.setPushOnQueue(false);
            edge = ctx.getOrCreateEdgeAndUpdate(null, artifactId, id, artifactContainsImageOfEntityIri, visibility, edgeCtx -> {
                edgeCtx.updateBuiltInProperties(propertyMetadata);
            }).get();

            artifactDetectedObject = new ArtifactDetectedObject(
                    x1,
                    y1,
                    x2,
                    y2,
                    concept.getName(),
                    "user",
                    edge.getId(),
                    id,
                    originalPropertyKey
            );

            propertyKey = artifactDetectedObject.getMultivalueKey(MULTI_VALUE_KEY_PREFIX);
            resolvedVertex = ctx.getOrCreateVertexAndUpdate(id, visibility, concept.getName(), elemCtx -> {
                if (elemCtx.isNewElement()) {
                    isNewVertex.set(true);
                    elemCtx.updateBuiltInProperties(propertyMetadata);
                    BcSchema.TITLE.updateProperty(elemCtx, MULTI_VALUE_KEY, title, propertyMetadata);
                }

                RawObjectSchema.ROW_KEY.updateProperty(elemCtx, id, propertyKey, propertyMetadata);
            }).get();

            if (isNewVertex.get()) {
                ClientApiSourceInfo sourceInfo = ClientApiSourceInfo.fromString(sourceInfoString);
                termMentionRepository.addJustification(resolvedVertex, justificationText, sourceInfo, bcVisibility, authorizations);
                workspaceRepository.updateEntityOnWorkspace(workspace, resolvedVertex.getId(), user);
            }
            RawObjectSchema.DETECTED_OBJECT.addPropertyValue(artifactVertex, propertyKey, artifactDetectedObject, bcVisibility.getVisibility(), authorizations);
        }

        webQueueRepository.broadcastPropertyChange(edge, null, null, workspaceId);
        webQueueRepository.broadcastPropertyChange(artifactVertex, propertyKey, RawObjectSchema.DETECTED_OBJECT.getPropertyName(), null);
        workQueueRepository.pushGraphPropertyQueue(
                artifactVertex,
                propertyKey,
                RawObjectSchema.DETECTED_OBJECT.getPropertyName(),
                null,
                null,
                Priority.HIGH,
                ElementOrPropertyStatus.UPDATE,
                null
        );

        return (ClientApiVertex) ClientApiConverter.toClientApi(artifactVertex, workspaceId, authorizations);
    }
}

