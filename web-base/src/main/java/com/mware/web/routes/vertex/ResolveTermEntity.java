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
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.PropertyJustificationMetadata;
import com.mware.core.model.clientapi.dto.ClientApiSourceInfo;
import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.graph.GraphUpdateContext;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.types.PropertyMetadata;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.termMention.TermMentionBuilder;
import com.mware.core.model.termMention.TermMentionRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.BcVisibility;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.ge.*;
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
import java.util.Date;
import java.util.ResourceBundle;

@Singleton
public class ResolveTermEntity implements ParameterizedHandler {
    private static final String MULTI_VALUE_KEY = ResolveTermEntity.class.getName();
    private final Graph graph;
    private final GraphRepository graphRepository;
    private final SchemaRepository schemaRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final WorkspaceRepository workspaceRepository;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final TermMentionRepository termMentionRepository;

    @Inject
    public ResolveTermEntity(
            Graph graph,
            GraphRepository graphRepository,
            SchemaRepository schemaRepository,
            VisibilityTranslator visibilityTranslator,
            WorkspaceRepository workspaceRepository,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository,
            TermMentionRepository termMentionRepository
    ) {
        this.graph = graph;
        this.graphRepository = graphRepository;
        this.schemaRepository = schemaRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.workspaceRepository = workspaceRepository;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
        this.termMentionRepository = termMentionRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "artifactId") String artifactId,
            @Required(name = "propertyKey") String propertyKey,
            @Required(name = "propertyName") String propertyName,
            @Required(name = "mentionStart") long mentionStart,
            @Required(name = "mentionEnd") long mentionEnd,
            @Required(name = "sign") String title,
            @Required(name = "visibilitySource") String visibilitySource,
            @Optional(name = "resolvedVertexId") String resolvedVertexId,
            @Optional(name = "sourceInfo") String sourceInfoString,
            @Optional(name = "conceptId") String conceptId,
            @Optional(name = "resolvedFromTermMention") String resolvedFromTermMention,
            @JustificationText String justificationText,
            @ActiveWorkspaceId String workspaceId,
            ResourceBundle resourceBundle,
            User user,
            Authorizations authorizations
    ) throws Exception {
        String artifactHasEntityIri = schemaRepository.getRequiredRelationshipNameByIntent("artifactHasEntity", workspaceId);

        Workspace workspace = workspaceRepository.findById(workspaceId, user);

        VisibilityJson visibilityJson = VisibilityJson.updateVisibilitySourceAndAddWorkspaceId(null, visibilitySource, workspaceId);
        VisibilityValidator.validate(graph, visibilityTranslator, resourceBundle, visibilityJson, user, authorizations);

        String id = resolvedVertexId == null ? graph.getIdGenerator().nextId() : resolvedVertexId;

        final Vertex artifactVertex = graph.getVertex(artifactId, authorizations);
        BcVisibility bcVisibility = visibilityTranslator.toVisibility(visibilityJson);
        Visibility visibility = bcVisibility.getVisibility();
        ZonedDateTime modifiedDate = ZonedDateTime.now();

        PropertyMetadata propertyMetadata = new PropertyMetadata(modifiedDate, user, visibilityJson, visibility);

        Vertex vertex;
        Edge edge;

        try (GraphUpdateContext ctx = graphRepository.beginGraphUpdate(Priority.NORMAL, user, authorizations)) {
            if (resolvedVertexId != null) {
                vertex = graph.getVertex(id, authorizations);
                conceptId = vertex.getConceptType();
            } else {
                if (conceptId == null) {
                    throw new BcException("conceptId required when creating entity");
                }

                vertex = ctx.getOrCreateVertexAndUpdate(id, visibility, conceptId, elemCtx -> {
                    elemCtx.updateBuiltInProperties(propertyMetadata);

                    BcSchema.TITLE.updateProperty(elemCtx, MULTI_VALUE_KEY, title, propertyMetadata);

                    if (justificationText != null && sourceInfoString == null) {
                        BcSchema.JUSTIFICATION.updateProperty(elemCtx, justificationText, propertyMetadata);
                    }
                }).get();
            }

            edge = ctx.getOrCreateEdgeAndUpdate(null, artifactVertex.getId(), vertex.getId(), artifactHasEntityIri, visibility, edgeCtx -> {
                edgeCtx.updateBuiltInProperties(propertyMetadata);
            }).get();
        }

        if (resolvedVertexId == null) {
            workspaceRepository.updateEntityOnWorkspace(workspace, vertex.getId(), user);
        }

        authorizations = termMentionRepository.getAuthorizations(authorizations);

        ClientApiSourceInfo sourceInfo = ClientApiSourceInfo.fromString(sourceInfoString);
        new TermMentionBuilder()
                .outVertex(artifactVertex)
                .propertyKey(propertyKey)
                .propertyName(propertyName)
                .start(mentionStart)
                .end(mentionEnd)
                .title(title)
                .type("ent")
                .snippet(sourceInfo == null ? null : sourceInfo.snippet)
                .conceptName(conceptId)
                .visibilityJson(visibilityJson)
                .resolvedTo(vertex, edge)
                .resolvedFromTermMention(resolvedFromTermMention)
                .process(getClass().getName())
                .save(this.graph, visibilityTranslator, user, authorizations);

        this.graph.flush();
        webQueueRepository.pushTextUpdated(artifactId);
        webQueueRepository.broadcastPropertyChange(edge, null, null, null);
        workQueueRepository.pushGraphPropertyQueue(
                edge,
                null,
                null,
                null,
                null,
                Priority.NORMAL,
                ElementOrPropertyStatus.UPDATE,
                null
        );

        return BcResponse.SUCCESS;
    }
}
