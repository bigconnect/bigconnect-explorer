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
package com.mware.product;

import com.google.common.collect.Lists;
import com.mware.core.model.graph.ElementUpdateContext;
import com.mware.core.model.graph.GraphUpdateContext;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.security.BcVisibility;
import com.mware.core.user.User;
import com.mware.core.util.StreamUtil;
import com.mware.ge.*;
import com.mware.ontology.WebWorkspaceSchema;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

public abstract class WorkProductServiceHasElementsBase<TVertex extends WorkProductVertex, TEdge extends WorkProductEdge>
        implements WorkProductService, WorkProductServiceHasElements {
    private final AuthorizationRepository authorizationRepository;

    protected WorkProductServiceHasElementsBase(
            AuthorizationRepository authorizationRepository
    ) {
        this.authorizationRepository = authorizationRepository;
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
        WorkProductExtendedData extendedData = new WorkProductExtendedData();
        String id = productVertex.getId();

        if (params.isIncludeVertices()) {
            Map<String, TVertex> vertices = new HashMap<>();
            List<Edge> productVertexEdges = Lists.newArrayList(productVertex.getEdges(
                    Direction.OUT,
                    WebWorkspaceSchema.PRODUCT_TO_ENTITY_RELATIONSHIP_NAME,
                    authorizations
            ));

            List<String> ids = productVertexEdges.stream()
                    .map(edge -> edge.getOtherVertexId(id))
                    .collect(Collectors.toList());
            Map<String, Vertex> othersById = StreamUtil.stream(graph.getVertices(ids, FetchHints.NONE, authorizations))
                    .collect(Collectors.toMap(Vertex::getId, Function.identity()));

            for (Edge propertyVertexEdge : productVertexEdges) {
                String otherId = propertyVertexEdge.getOtherVertexId(id);
                TVertex vertex = createWorkProductVertex();
                vertex.setId(otherId);
                if (!othersById.containsKey(otherId)) {
                    vertex.setUnauthorized(true);
                }
                populateProductVertexWithWorkspaceEdge(propertyVertexEdge, vertex);
                vertices.put(otherId, vertex);
            }
            extendedData.setVertices(vertices);
        }

        if (params.isIncludeEdges()) {
            Map<String, TEdge> edges = new HashMap<>();
            Authorizations systemAuthorizations = authorizationRepository.getGraphAuthorizations(
                    user,
                    BcVisibility.SUPER_USER_VISIBILITY_STRING
            );
            Iterable<Vertex> productVertices = Lists.newArrayList(productVertex.getVertices(
                    Direction.OUT,
                    WebWorkspaceSchema.PRODUCT_TO_ENTITY_RELATIONSHIP_NAME,
                    systemAuthorizations
            ));
            Iterable<RelatedEdge> productRelatedEdges = graph.findRelatedEdgeSummaryForVertices(productVertices, authorizations);
            List<String> ids = StreamUtil.stream(productRelatedEdges)
                    .map(RelatedEdge::getEdgeId)
                    .collect(Collectors.toList());
            Map<String, Boolean> relatedEdgesById = graph.doEdgesExist(ids, authorizations);

            for (RelatedEdge relatedEdge : productRelatedEdges) {
                String edgeId = relatedEdge.getEdgeId();
                TEdge edge = createWorkProductEdge();
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
            extendedData.setEdges(edges);
        }

        return extendedData;
    }

    protected abstract TEdge createWorkProductEdge();

    protected abstract void populateCustomProductVertexWithWorkspaceEdge(Edge propertyVertexEdge, TVertex vertex);

    protected abstract TVertex createWorkProductVertex();

    @Override
    public void cleanUpElements(Graph graph, Vertex productVertex, Authorizations authorizations) {
        Iterable<Edge> productElementEdges = productVertex.getEdges(
                Direction.OUT,
                WebWorkspaceSchema.PRODUCT_TO_ENTITY_RELATIONSHIP_NAME,
                authorizations
        );

        for (Edge productToElement : productElementEdges) {
            graph.deleteEdge(productToElement, authorizations);
        }

        graph.flush();
    }

    @Override
    public void addElements(GraphUpdateContext ctx, Vertex productVertex, Iterable vertexIds, Visibility visibility) {
        for (Object id : vertexIds) {
            addOrUpdateProductEdgeToEntity(ctx, productVertex, id.toString(), new UpdateProductEdgeOptions(), visibility);
        }
    }

    @Override
    public GraphUpdateContext.UpdateFuture<Edge> addOrUpdateProductEdgeToAncillaryEntity(GraphUpdateContext ctx, Vertex productVertex, String entityId, UpdateProductEdgeOptions options, Visibility visibility) {
        if (options == null) {
            options = new UpdateProductEdgeOptions();
        }
        options.setAncillary(true);

        return addOrUpdateProductEdgeToEntity(ctx, productVertex, entityId, options, visibility);
    }

    public GraphUpdateContext.UpdateFuture<Edge> addOrUpdateProductEdgeToEntity(GraphUpdateContext ctx, Vertex productVertex, String entityId, UpdateProductEdgeOptions options, Visibility visibility) {
        return addOrUpdateProductEdgeToEntity(
                ctx,
                getEdgeId(productVertex.getId(), entityId),
                productVertex,
                entityId,
                options,
                visibility
        );
    }

    public GraphUpdateContext.UpdateFuture<Edge> addOrUpdateProductEdgeToEntity(GraphUpdateContext ctx, String edgeId, Vertex productVertex, String entityId, UpdateProductEdgeOptions options, Visibility visibility) {
        ctx.setPushOnQueue(false);
        return ctx.getOrCreateEdgeAndUpdate(
                edgeId,
                productVertex.getId(),
                entityId,
                WebWorkspaceSchema.PRODUCT_TO_ENTITY_RELATIONSHIP_NAME,
                visibility,
                elemCtx -> {
                    WebWorkspaceSchema.PRODUCT_TO_ENTITY_IS_ANCILLARY.updateProperty(elemCtx, options.isAncillary(), visibility);
                    updateProductEdge(elemCtx, options, visibility);
                }
        );
    }

    @Override
    public void populateProductVertexWithWorkspaceEdge(Edge propertyVertexEdge, WorkProductVertex vertex) {
        vertex.setId(propertyVertexEdge.getVertexId(Direction.IN));

        if (WebWorkspaceSchema.PRODUCT_TO_ENTITY_IS_ANCILLARY.getPropertyValue(propertyVertexEdge, false)) {
            vertex.setAncillary(true);
        }
        populateCustomProductVertexWithWorkspaceEdge(propertyVertexEdge, (TVertex) vertex);
    }

    @Override
    public TVertex populateProductVertexWithWorkspaceEdge(Edge propertyVertexEdge) {
        TVertex vertex = createWorkProductVertex();
        populateProductVertexWithWorkspaceEdge(propertyVertexEdge, vertex);
        return vertex;
    }

    protected void updateProductEdge(
            ElementUpdateContext<Edge> elemCtx,
            UpdateProductEdgeOptions update,
            Visibility visibility
    ) {}

    public static String getEdgeId(String productId, String vertexId) {
        return productId + "_hasVertex_" + vertexId;
    }

}
