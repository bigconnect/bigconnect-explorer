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
package com.mware.workspace;

import com.fasterxml.jackson.databind.JsonNode;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcAccessDeniedException;
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.core.model.lock.LockRepository;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceEntity;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.trace.Traced;
import com.mware.core.user.User;
import com.mware.core.util.JSONUtil;
import com.mware.core.util.SandboxStatusUtil;
import com.mware.formula.FormulaEvaluator;
import com.mware.ge.*;
import com.mware.web.model.ClientApiWorkspaceDiff;
import com.mware.web.util.JsonSerializer;

import java.util.ArrayList;
import java.util.List;

import static com.mware.ge.util.IterableUtils.toList;

@Singleton
public class WorkspaceDiffHelper {
    private final Graph graph;
    private final AuthorizationRepository authorizationRepository;
    private final FormulaEvaluator formulaEvaluator;
    private final WebWorkspaceRepository webWorkspaceRepository;
    private final WorkspaceRepository workspaceRepository;
    private final LockRepository lockRepository;

    @Inject
    public WorkspaceDiffHelper(
            Graph graph,
            AuthorizationRepository authorizationRepository,
            FormulaEvaluator formulaEvaluator,
            WebWorkspaceRepository webWorkspaceRepository,
            WorkspaceRepository workspaceRepository,
            LockRepository lockRepository,
            Configuration configuration
    ) {
        this.graph = graph;
        this.authorizationRepository = authorizationRepository;
        this.formulaEvaluator = formulaEvaluator;
        this.webWorkspaceRepository = webWorkspaceRepository;
        this.workspaceRepository = workspaceRepository;
        this.lockRepository = lockRepository;
    }

    @Traced
    public ClientApiWorkspaceDiff getDiff(
            Workspace workspace,
            User user,
            FormulaEvaluator.UserContext userContext
    ) {
        if (!workspaceRepository.hasReadPermissions(workspace.getWorkspaceId(), user)) {
            throw new BcAccessDeniedException(
                    "user " + user.getUserId() + " does not have read access to workspace " + workspace.getWorkspaceId(),
                    user,
                    workspace.getWorkspaceId()
            );
        }

        if (!workspaceRepository.isStagingEnabled(workspace)) {
            return new ClientApiWorkspaceDiff();
        }

        return lockRepository.lock(workspaceRepository.getLockName(workspace), () -> {
            List<WorkspaceEntity> workspaceEntities = workspaceRepository.findEntities(workspace, true, user, false, true);
            Iterable<Edge> workspaceEdges = webWorkspaceRepository.findModifiedEdges(workspace, workspaceEntities, true, user);
            return diff(workspace, workspaceEntities, workspaceEdges, userContext, user);
        });
    }

    @Traced
    private ClientApiWorkspaceDiff diff(
            Workspace workspace,
            Iterable<WorkspaceEntity> workspaceEntities,
            Iterable<Edge> workspaceEdges,
            FormulaEvaluator.UserContext userContext,
            User user
    ) {
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                WorkspaceRepository.VISIBILITY_STRING,
                workspace.getWorkspaceId()
        );

        ClientApiWorkspaceDiff result = new ClientApiWorkspaceDiff();
        for (WorkspaceEntity workspaceEntity : workspaceEntities) {
            List<ClientApiWorkspaceDiff.Item> entityDiffs = diffWorkspaceEntity(
                    workspace,
                    workspaceEntity,
                    userContext,
                    authorizations
            );
            if (entityDiffs != null) {
                result.addAll(entityDiffs);
            }
        }

        for (Edge workspaceEdge : workspaceEdges) {
            List<ClientApiWorkspaceDiff.Item> entityDiffs = diffEdge(workspace, workspaceEdge, authorizations);
            if (entityDiffs != null) {
                result.addAll(entityDiffs);
            }
        }

        return result;
    }

    @Traced
    protected List<ClientApiWorkspaceDiff.Item> diffEdge(
            Workspace workspace,
            Edge edge,
            Authorizations hiddenAuthorizations
    ) {
        List<ClientApiWorkspaceDiff.Item> result = new ArrayList<>();

        SandboxStatus sandboxStatus = SandboxStatusUtil.getSandboxStatus(edge, workspace.getWorkspaceId());
        boolean isPrivateChange = sandboxStatus != SandboxStatus.PUBLIC;
        boolean isPublicDelete = isPublicDelete(edge, hiddenAuthorizations);
        if (isPrivateChange || isPublicDelete) {
            result.add(createWorkspaceDiffEdgeItem(edge, sandboxStatus, isPublicDelete));
        }

        // don't report properties individually when deleting the edge
        if (!isPublicDelete) {
            diffProperties(workspace, edge, result, hiddenAuthorizations);
        }

        return result;
    }

    public static boolean isPublicDelete(Edge edge, Authorizations authorizations) {
        return edge.isHidden(authorizations);
    }

    public static boolean isPublicDelete(Vertex vertex, Authorizations authorizations) {
        return vertex.isHidden(authorizations);
    }

    public static boolean isPublicDelete(Property property, Authorizations authorizations) {
        return property.isHidden(authorizations);
    }

    private ClientApiWorkspaceDiff.EdgeItem createWorkspaceDiffEdgeItem(
            Edge edge,
            SandboxStatus sandboxStatus,
            boolean deleted
    ) {
        Property visibilityJsonProperty = BcSchema.VISIBILITY_JSON.getProperty(edge);
        JsonNode visibilityJson = visibilityJsonProperty == null ? null : JSONUtil.toJsonNode(JsonSerializer.toJsonProperty(
                visibilityJsonProperty));
        return new ClientApiWorkspaceDiff.EdgeItem(
                edge.getId(),
                edge.getLabel(),
                edge.getVertexId(Direction.OUT),
                edge.getVertexId(Direction.IN),
                visibilityJson,
                sandboxStatus,
                deleted
        );
    }

    @Traced
    public List<ClientApiWorkspaceDiff.Item> diffWorkspaceEntity(
            Workspace workspace,
            WorkspaceEntity workspaceEntity,
            FormulaEvaluator.UserContext userContext,
            Authorizations authorizations
    ) {
        List<ClientApiWorkspaceDiff.Item> result = new ArrayList<>();

        FetchHints hints = new FetchHintsBuilder()
                .setIncludeAllProperties(true)
                .setIncludeAllPropertyMetadata(true)
                .setIncludeHidden(true)
                .build();

        // Workspace vertex will be null if deleted, so retrieve with hidden
        Vertex entityVertex = workspaceEntity.getVertex() == null ?
                this.graph.getVertex(workspaceEntity.getEntityVertexId(), hints, authorizations) :
                workspaceEntity.getVertex();

        // vertex can be null if the user doesn't have access to the entity
        if (entityVertex == null) {
            return null;
        }

        SandboxStatus sandboxStatus = SandboxStatusUtil.getSandboxStatus(entityVertex, workspace.getWorkspaceId());
        boolean isPrivateChange = sandboxStatus != SandboxStatus.PUBLIC;
        boolean isPublicDelete = isPublicDelete(entityVertex, authorizations);
        if (isPrivateChange || isPublicDelete) {
            result.add(createWorkspaceDiffVertexItem(
                    entityVertex,
                    sandboxStatus,
                    userContext,
                    isPublicDelete
            ));
        }

        // don't report properties individually when deleting the vertex
        if (!isPublicDelete) {
            diffProperties(workspace, entityVertex, result, authorizations);
        }

        return result;
    }

    private ClientApiWorkspaceDiff.VertexItem createWorkspaceDiffVertexItem(
            Vertex vertex,
            SandboxStatus sandboxStatus,
            FormulaEvaluator.UserContext userContext,
            boolean deleted
    ) {
        String vertexId = vertex.getId();
        String title = deleted ? formulaEvaluator.evaluateTitleFormula(vertex, userContext, null) : null;
        Property visibilityJsonProperty = BcSchema.VISIBILITY_JSON.getProperty(vertex);
        JsonNode visibilityJson = visibilityJsonProperty == null ? null : JSONUtil.toJsonNode(JsonSerializer.toJsonProperty(
                visibilityJsonProperty));
        return new ClientApiWorkspaceDiff.VertexItem(
                vertexId,
                title,
                vertex.getConceptType(),
                visibilityJson,
                sandboxStatus,
                deleted
        );
    }

    @Traced
    protected void diffProperties(
            Workspace workspace,
            Element element,
            List<ClientApiWorkspaceDiff.Item> result,
            Authorizations hiddenAuthorizations
    ) {
        List<Property> properties = toList(element.getProperties());
        SandboxStatus[] propertyStatuses = SandboxStatusUtil.getPropertySandboxStatuses(
                properties,
                workspace.getWorkspaceId()
        );
        for (int i = 0; i < properties.size(); i++) {
            Property property = properties.get(i);
            boolean isPrivateChange = propertyStatuses[i] != SandboxStatus.PUBLIC;
            boolean isPublicDelete = isPublicDelete(property, hiddenAuthorizations);
            if (isPrivateChange || isPublicDelete) {
                Property existingProperty = null;
                if (isPublicDelete && isPublicPropertyEdited(properties, propertyStatuses, property)) {
                    continue;
                } else if (isPrivateChange) {
                    existingProperty = findExistingProperty(properties, propertyStatuses, property);
                }
                result.add(createWorkspaceDiffPropertyItem(
                        element,
                        property,
                        existingProperty,
                        propertyStatuses[i],
                        isPublicDelete
                ));
            }
        }
    }

    private ClientApiWorkspaceDiff.PropertyItem createWorkspaceDiffPropertyItem(
            Element element,
            Property workspaceProperty,
            Property existingProperty,
            SandboxStatus sandboxStatus,
            boolean deleted
    ) {
        JsonNode oldData = null;
        if (existingProperty != null) {
            oldData = JSONUtil.toJsonNode(JsonSerializer.toJsonProperty(existingProperty));
        }
        JsonNode newData = JSONUtil.toJsonNode(JsonSerializer.toJsonProperty(workspaceProperty));

        ElementType type = ElementType.getTypeFromElement(element);
        if (type.equals(ElementType.VERTEX)) {
            return new ClientApiWorkspaceDiff.PropertyItem(
                    type.name().toLowerCase(),
                    element.getId(),
                    ((Vertex)element).getConceptType(),
                    workspaceProperty.getName(),
                    workspaceProperty.getKey(),
                    oldData,
                    newData,
                    sandboxStatus,
                    deleted,
                    workspaceProperty.getVisibility().getVisibilityString()
            );
        } else {
            return new ClientApiWorkspaceDiff.PropertyItem(
                    type.name().toLowerCase(),
                    element.getId(),
                    ((Edge) element).getLabel(),
                    ((Edge) element).getVertexId(Direction.OUT),
                    ((Edge) element).getVertexId(Direction.IN),
                    workspaceProperty.getName(),
                    workspaceProperty.getKey(),
                    oldData,
                    newData,
                    sandboxStatus,
                    deleted,
                    workspaceProperty.getVisibility().getVisibilityString()
            );
        }
    }

    private Property findExistingProperty(
            List<Property> properties,
            SandboxStatus[] propertyStatuses,
            Property workspaceProperty
    ) {
        for (int i = 0; i < properties.size(); i++) {
            Property property = properties.get(i);
            if (property.getName().equals(workspaceProperty.getName())
                    && property.getKey().equals(workspaceProperty.getKey())
                    && propertyStatuses[i] == SandboxStatus.PUBLIC) {
                return property;
            }
        }
        return null;
    }

    public static boolean isPublicPropertyEdited(
            List<Property> properties,
            SandboxStatus[] propertyStatuses,
            Property workspaceProperty
    ) {
        for (int i = 0; i < properties.size(); i++) {
            Property property = properties.get(i);
            if (property.getName().equals(workspaceProperty.getName())
                    && property.getKey().equals(workspaceProperty.getKey())
                    && propertyStatuses[i] == SandboxStatus.PUBLIC_CHANGED) {
                return true;
            }
        }
        return false;
    }
}
