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
package com.mware.web.product.graph;

import com.google.common.collect.Queues;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.GraphPosition;
import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.graph.ElementUpdateContext;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.graph.GraphUpdateContext;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.schema.GraphProductSchema;
import com.mware.core.model.user.UserRepository;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.BcVisibility;
import com.mware.core.user.User;
import com.mware.core.util.StreamUtil;
import com.mware.ge.*;
import com.mware.ge.util.CloseableUtils;
import com.mware.ge.values.storable.Values;
import com.mware.ontology.WebWorkspaceSchema;
import com.mware.product.*;
import com.mware.web.product.graph.model.GraphUpdateProductEdgeOptions;
import com.mware.web.product.graph.model.GraphWorkProductExtendedData;
import com.mware.web.product.graph.model.GraphWorkProductVertex;

import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;

import static com.mware.core.model.schema.GraphProductSchema.ENTITY_POSITION;

@Singleton
public class GraphWorkProductService extends WorkProductServiceHasElementsBase<GraphWorkProductVertex, WorkProductEdge> {
    public static final String KIND = "org.bigconnect.web.product.graph.GraphWorkProduct";
    private static final String ROOT_NODE_ID = "root";
    private final AuthorizationRepository authorizationRepository;
    private final GraphRepository graphRepository;
    private final UserRepository userRepository;
    public static final BcVisibility VISIBILITY = new BcVisibility(WorkspaceRepository.VISIBILITY_STRING);

    @Inject
    public GraphWorkProductService(
            AuthorizationRepository authorizationRepository,
            GraphRepository graphRepository,
            UserRepository userRepository
    ) {
        super(authorizationRepository);
        this.authorizationRepository = authorizationRepository;
        this.graphRepository = graphRepository;
        this.userRepository = userRepository;
    }

    @Override
    public WorkProductExtendedData getExtendedData(
            Graph graph,
            Vertex workspaceVertex,
            Vertex productVertex,
            GetExtendedDataParams params,
            User user,
            Authorizations authorizations
    ) {
        GraphWorkProductExtendedData extendedData = new GraphWorkProductExtendedData();

        if (params.isIncludeVertices()) {
            Nodes nodes = getNodes(graph, productVertex, authorizations);

            extendedData.setVertices(nodes.vertices);
            extendedData.setCompoundNodes(nodes.compoundNodes);
        }

        if (params.isIncludeEdges()) {
            extendedData.setEdges(getEdges(graph, productVertex, user, authorizations));
        }

        return extendedData;
    }

    private static class Nodes {
        public Map<String, GraphWorkProductVertex> vertices;
        public Map<String, GraphWorkProductVertex> compoundNodes;
    }

    private Nodes getNodes(
            Graph graph,
            Vertex productVertex,
            Authorizations authorizations
    ) {
        Map<String, GraphWorkProductVertex> vertices = new HashMap<>();
        Map<String, GraphWorkProductVertex> compoundNodes = new HashMap<>();

        Iterable<Edge> productVertexEdges = productVertex.getEdges(
                Direction.OUT,
                WebWorkspaceSchema.PRODUCT_TO_ENTITY_RELATIONSHIP_NAME,
                authorizations
        );
        List<String> ids = StreamUtil.stream(productVertexEdges)
                .map(edge -> edge.getOtherVertexId(productVertex.getId()))
                .collect(Collectors.toList());
        Map<String, Boolean> othersById = graph.doVerticesExist(ids, authorizations);

        Iterator<Edge> edgeIterator = productVertexEdges.iterator();
        try {
            while (edgeIterator.hasNext()) {
                Edge propertyVertexEdge = edgeIterator.next();
                String otherId = propertyVertexEdge.getOtherVertexId(productVertex.getId());
                GraphWorkProductVertex vertexOrNode = new GraphWorkProductVertex();
                vertexOrNode.setId(otherId);
                if (!othersById.getOrDefault(otherId, false)) {
                    vertexOrNode.setUnauthorized(true);
                }
                populateProductVertexWithWorkspaceEdge(propertyVertexEdge, vertexOrNode);
                if ("vertex".equals(vertexOrNode.getType())) {
                    vertices.put(otherId, vertexOrNode);
                } else {
                    compoundNodes.put(otherId, vertexOrNode);
                }
            }
        } finally {
            CloseableUtils.closeQuietly(edgeIterator);
        }

        if (compoundNodes.size() > 0) {
            compoundNodes.keySet()
                    .forEach(compoundNodeId -> {
                        GraphWorkProductVertex compoundNode = compoundNodes.get(compoundNodeId);
                        ArrayDeque<GraphWorkProductVertex> childrenDFS = Queues.newArrayDeque();

                        childrenDFS.push(compoundNode);
                        boolean visible = compoundNode.isVisible();
                        while (!visible && !childrenDFS.isEmpty()) {
                            GraphWorkProductVertex next = childrenDFS.poll();
                            List<String> children = next.getChildren();

                            if (children != null) {
                                children.forEach(nextChildId -> {
                                    GraphWorkProductVertex nextChild = vertices.get(nextChildId);
                                    if (nextChild == null) {
                                        nextChild = compoundNodes.get(nextChildId);
                                    }
                                    if (nextChild != null) {
                                        childrenDFS.push(nextChild);
                                    }
                                });
                            } else {
                                visible = !next.isUnauthorized();
                            }
                        }

                        compoundNode.setVisible(visible);
                    });
        }

        Nodes nodes = new Nodes();
        nodes.vertices = vertices;
        nodes.compoundNodes = compoundNodes;
        return nodes;
    }

    private Map<String, WorkProductEdge> getEdges(
            Graph graph,
            Vertex productVertex,
            User user,
            Authorizations authorizations
    ) {
        Map<String, WorkProductEdge> edges = new HashMap<>();
        Authorizations systemAuthorizations = authorizationRepository.getGraphAuthorizations(
                user,
                BcVisibility.SUPER_USER_VISIBILITY_STRING
        );
        Iterable<String> productVertexIds = productVertex.getVertexIds(
                Direction.OUT,
                WebWorkspaceSchema.PRODUCT_TO_ENTITY_RELATIONSHIP_NAME,
                systemAuthorizations
        );
        Iterable<RelatedEdge> productRelatedEdges = graph.findRelatedEdgeSummary(productVertexIds, authorizations);
        List<String> ids = StreamUtil.stream(productRelatedEdges)
                .map(RelatedEdge::getEdgeId)
                .collect(Collectors.toList());
        Map<String, Boolean> relatedEdgesById = graph.doEdgesExist(ids, authorizations);

        for (RelatedEdge relatedEdge : productRelatedEdges) {
            String edgeId = relatedEdge.getEdgeId();
            WorkProductEdge edge = new WorkProductEdge();
            edge.setEdgeId(relatedEdge.getEdgeId());

            if (relatedEdgesById.get(edgeId)) {
                edge.setLabel(relatedEdge.getLabel());
                edge.setOutVertexId(relatedEdge.getOutVertexId());
                edge.setInVertexId(relatedEdge.getInVertexId());
            } else {
                edge.setUnauthorized(true);
            }
            edges.put(edgeId, edge);
        }

        return edges;
    }

    @Override
    public void cleanUpElements(
            Graph graph,
            Vertex productVertex,
            Authorizations authorizations
    ) {
        Iterable<Edge> productElementEdges = productVertex.getEdges(
                Direction.OUT,
                WebWorkspaceSchema.PRODUCT_TO_ENTITY_RELATIONSHIP_NAME,
                authorizations
        );

        for (Edge productToElement : productElementEdges) {
            if (GraphProductSchema.NODE_CHILDREN.hasProperty(productToElement)) {
                String otherElementId = productToElement.getOtherVertexId(productVertex.getId());
                graph.deleteVertex(otherElementId, authorizations);
            } else {
                graph.deleteEdge(productToElement, authorizations);
            }
        }

        graph.flush();
    }

    public WorkProductVertex addCompoundNode(
            GraphUpdateContext ctx,
            Vertex productVertex,
            GraphUpdateProductEdgeOptions params,
            User user,
            Visibility visibility,
            Authorizations authorizations
    ) {
        try {
            VisibilityJson visibilityJson = VisibilityJson.updateVisibilitySource(null, "");

            String vertexId = params.getId();
            GraphUpdateContext.UpdateFuture<Vertex> vertexFuture = ctx.getOrCreateVertexAndUpdate(vertexId, null, visibility, GraphProductSchema.CONCEPT_TYPE_COMPOUND_NODE, elemCtx -> {
                elemCtx.updateBuiltInProperties(ZonedDateTime.now(), visibilityJson);
            });
            vertexId = vertexFuture.get().getId();

            Edge edge = addOrUpdateProductEdgeToEntity(ctx, productVertex, vertexId, params, visibility).get();

            ctx.flush();

            List<String> childIds = params.getChildren();
            for (String childId : childIds) {
                updateParent(ctx, productVertex, childId, vertexId, visibility, authorizations);
            }

            return populateProductVertexWithWorkspaceEdge(ctx.getGraph().getEdge(edge.getId(), authorizations));
        } catch (Exception ex) {
            throw new BcException("Could not add compound node", ex);
        }
    }

    public void updateVertices(
            GraphUpdateContext ctx,
            Vertex productVertex,
            Map<String, GraphUpdateProductEdgeOptions> updateVertices,
            User user,
            Visibility visibility,
            Authorizations authorizations
    ) {
        @SuppressWarnings("unchecked")
        Set<String> vertexIds = updateVertices.keySet();
        for (String id : vertexIds) {
            GraphUpdateProductEdgeOptions updateData = updateVertices.get(id);
            String edgeId = getEdgeId(productVertex.getId(), id);

            //undoing compound node removal
            if (updateData.hasChildren() && !ctx.getGraph().doesVertexExist(id, authorizations)) {
                addCompoundNode(ctx, productVertex, updateData, user, visibility, authorizations);
            }

            addOrUpdateProductEdgeToEntity(ctx, productVertex, id, updateData, visibility);
        }
    }

    public void removeVertices(
            GraphUpdateContext ctx,
            Vertex productVertex,
            String[] removeVertices,
            boolean removeChildren,
            User user,
            Visibility visibility,
            Authorizations authorizations
    ) {
        for (String id : removeVertices) {
            String edgeId = getEdgeId(productVertex.getId(), id);
            Edge productVertexEdge = ctx.getGraph().getEdge(edgeId, authorizations);

            if (productVertexEdge != null) {
                String parentId = GraphProductSchema.PARENT_NODE.getPropertyValue(productVertexEdge, ROOT_NODE_ID);
                List<String> children = GraphProductSchema.NODE_CHILDREN.getPropertyValue(productVertexEdge);

                if (children != null && children.size() > 0) {
                    if (removeChildren) {
                        Queue<String> childIdQueue = Queues.newArrayDeque();
                        childIdQueue.addAll(children);

                        while (!childIdQueue.isEmpty()) {
                            String childId = childIdQueue.poll();
                            String childEdgeId = getEdgeId(productVertex.getId(), childId);

                            Edge childEdge = ctx.getGraph().getEdge(childEdgeId, authorizations);
                            List<String> nextChildren = GraphProductSchema.NODE_CHILDREN.getPropertyValue(childEdge);

                            if (nextChildren != null) {
                                childIdQueue.addAll(nextChildren);
                                ctx.getGraph().deleteVertex(childId, authorizations);
                            } else {
                                ctx.getGraph().deleteEdge(childEdgeId, authorizations);
                            }
                        }
                    } else {
                        children.forEach(childId -> updateParent(ctx, productVertex, childId, parentId, visibility, authorizations));
                        ctx.getGraph().deleteVertex(id, authorizations);
                    }
                } else {
                    ctx.getGraph().deleteEdge(edgeId, authorizations);
                }

                if (!ROOT_NODE_ID.equals(parentId)) {
                    removeChild(ctx, productVertex, id, parentId, visibility, authorizations);
                }
            }
        }
    }

    private void addChild(
            GraphUpdateContext ctx,
            Vertex productVertex,
            String childId,
            String parentId,
            Visibility visibility,
            Authorizations authorizations
    ) {
        if (parentId.equals(ROOT_NODE_ID)) {
            return;
        }

        String parentEdgeId = getEdgeId(productVertex.getId(), parentId);
        Edge parentProductVertexEdge = ctx.getGraph().getEdge(parentEdgeId, authorizations);

        List<String> children = GraphProductSchema.NODE_CHILDREN.getPropertyValue(parentProductVertexEdge, new ArrayList<>());
        if (!children.contains(childId)) {
            children.add(childId);

            GraphUpdateProductEdgeOptions parentOptions = new GraphUpdateProductEdgeOptions();
            parentOptions.getChildren().addAll(children);
            addOrUpdateProductEdgeToEntity(ctx, parentEdgeId, productVertex, childId, parentOptions, visibility);

            GraphUpdateProductEdgeOptions childOptions = new GraphUpdateProductEdgeOptions();
            childOptions.setParent(parentId);
            addOrUpdateProductEdgeToEntity(ctx, productVertex, childId, childOptions, visibility);
        }
    }

    private void removeChild(
            GraphUpdateContext ctx,
            Vertex productVertex,
            String childId,
            String parentId,
            Visibility visibility,
            Authorizations authorizations
    ) {
        if (parentId.equals(ROOT_NODE_ID)) {
            return;
        }

        String edgeId = getEdgeId(productVertex.getId(), parentId);
        Edge productVertexEdge = ctx.getGraph().getEdge(edgeId, authorizations);
        List<String> children = GraphProductSchema.NODE_CHILDREN.getPropertyValue(productVertexEdge);

        if (children != null) {
            for (int i = 0; i < children.size(); i++) {
                if (children.get(i).equals(childId)) {
                    children.remove(i);
                    break;
                }
            }
            if (children.size() == 0) {
                ctx.getGraph().deleteVertex(parentId, authorizations);

                String ancestorId = GraphProductSchema.PARENT_NODE.getPropertyValue(productVertexEdge, ROOT_NODE_ID);
                if (ancestorId.equals(productVertex.getId())) {
                    removeChild(ctx, productVertex, parentId, ancestorId, visibility, authorizations);
                }
            } else {
                EdgeBuilderByVertexId edgeBuilder = ctx.getGraph().prepareEdge(
                        edgeId,
                        productVertex.getId(),
                        parentId,
                        WebWorkspaceSchema.PRODUCT_TO_ENTITY_RELATIONSHIP_NAME,
                        visibility
                );
                GraphProductSchema.NODE_CHILDREN.setProperty(edgeBuilder, children, visibility);

                edgeBuilder.save(authorizations);
                ctx.flush();
            }
        }
    }

    private void updateParent(
            GraphUpdateContext ctx,
            Vertex productVertex,
            String childId,
            String parentId,
            Visibility visibility,
            Authorizations authorizations
    ) {
        String edgeId = getEdgeId(productVertex.getId(), childId);
        Edge productVertexEdge = ctx.getGraph().getEdge(edgeId, authorizations);
        GraphUpdateProductEdgeOptions updateData = new GraphUpdateProductEdgeOptions();
        GraphPosition graphPosition;

        String oldParentId = GraphProductSchema.PARENT_NODE.getPropertyValue(productVertexEdge, ROOT_NODE_ID);
        graphPosition = calculatePositionFromParents(ctx, productVertex, childId, oldParentId, parentId, authorizations);

        updateData.setPos(graphPosition);
        updateData.setParent(parentId);
        addOrUpdateProductEdgeToEntity(ctx, productVertex, childId, updateData, visibility);

        removeChild(ctx, productVertex, childId, oldParentId, visibility, authorizations);
        addChild(ctx, productVertex, childId, parentId, visibility, authorizations);
    }

    private GraphPosition calculatePositionFromParents(
            GraphUpdateContext ctx,
            Vertex productVertex,
            String childId,
            String oldParentId,
            String newParentId,
            Authorizations authorizations
    ) {
        boolean newParentIsDescendant = false;
        if (!newParentId.equals(ROOT_NODE_ID)) {
            Edge newParentEdge = ctx.getGraph().getEdge(getEdgeId(productVertex.getId(), newParentId), authorizations);
            String parentNode = GraphProductSchema.PARENT_NODE.getPropertyValue(newParentEdge, ROOT_NODE_ID);
            newParentIsDescendant = parentNode.equals(oldParentId);
        }

        GraphPosition parentOffset;
        String parentOffsetId = newParentIsDescendant ? newParentId : oldParentId;
        if (parentOffsetId.equals(ROOT_NODE_ID)) {
            parentOffset = new GraphPosition(0, 0);
        } else {
            String offsetEdgeId = getEdgeId(productVertex.getId(), parentOffsetId);
            Edge offsetEdge = ctx.getGraph().getEdge(offsetEdgeId, authorizations);
            parentOffset = getGraphPosition(offsetEdge);
        }

        String childEdgeId = getEdgeId(productVertex.getId(), childId);
        Edge childEdge = ctx.getGraph().getEdge(childEdgeId, authorizations);

        GraphPosition graphPosition = getGraphPosition(childEdge);

        if (newParentIsDescendant) {
            graphPosition.subtract(parentOffset);
        } else {
            graphPosition.add(parentOffset);
        }

        return graphPosition;
    }

    private GraphPosition getGraphPosition(Edge productVertexEdge) {
        return ENTITY_POSITION.getPropertyValue(productVertexEdge);
    }

    @Override
    protected void updateProductEdge(
            ElementUpdateContext<Edge> elemCtx,
            UpdateProductEdgeOptions updateOptions,
            Visibility visibility
    ) {
        if (updateOptions instanceof GraphUpdateProductEdgeOptions) {
            GraphUpdateProductEdgeOptions update = (GraphUpdateProductEdgeOptions) updateOptions;
            GraphPosition position = update.getPos();
            if (position != null) {
                ENTITY_POSITION.updateProperty(elemCtx, position, visibility);
            }

            String parent = update.getParent();
            if (parent != null) {
                GraphProductSchema.PARENT_NODE.updateProperty(elemCtx, parent, visibility);
            }

            if (update.hasChildren()) {
                GraphProductSchema.NODE_CHILDREN.updateProperty(elemCtx, update.getChildren(), visibility);
            }
        }
    }

    @Override
    protected void populateCustomProductVertexWithWorkspaceEdge(Edge propertyVertexEdge, GraphWorkProductVertex vertex) {
        GraphPosition position = ENTITY_POSITION.getPropertyValue(propertyVertexEdge);
        String parent = GraphProductSchema.PARENT_NODE.getPropertyValue(propertyVertexEdge, ROOT_NODE_ID);
        List<String> children = GraphProductSchema.NODE_CHILDREN.getPropertyValue(propertyVertexEdge);
        String title = GraphProductSchema.NODE_TITLE.getPropertyValue(propertyVertexEdge);

        if (position == null) {
            position = new GraphPosition(0, 0);
        }
        vertex.setPos(position);

        if (children != null) {
            vertex.setChildren(children);
            vertex.setType("compoundNode");
        } else {
            vertex.setType("vertex");
        }

        if (title != null) {
            vertex.setTitle(title);
        }
        vertex.setParent(parent);
    }

    @Override
    public String getKind() {
        return KIND;
    }

    @Override
    protected GraphWorkProductVertex createWorkProductVertex() {
        return new GraphWorkProductVertex();
    }

    @Override
    protected WorkProductEdge createWorkProductEdge() {
        return new WorkProductEdge();
    }
}
