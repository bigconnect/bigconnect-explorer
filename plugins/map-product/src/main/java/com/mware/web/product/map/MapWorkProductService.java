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
package com.mware.web.product.map;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.graph.ElementUpdateContext;
import com.mware.core.model.graph.GraphUpdateContext;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.ge.*;
import com.mware.product.UpdateProductEdgeOptions;
import com.mware.product.WorkProductEdge;
import com.mware.product.WorkProductServiceHasElementsBase;
import com.mware.product.WorkProductVertex;

import java.util.Map;
import java.util.Set;

@Singleton
public class MapWorkProductService extends WorkProductServiceHasElementsBase<WorkProductVertex, WorkProductEdge> {
    public static final String KIND = "org.bigconnect.web.product.map.MapWorkProduct";

    @Inject
    public MapWorkProductService(
            AuthorizationRepository authorizationRepository
    ) {
        super(authorizationRepository);
    }

    @Override
    protected WorkProductEdge createWorkProductEdge() {
        return new WorkProductEdge();
    }

    @Override
    protected WorkProductVertex createWorkProductVertex() {
        return new WorkProductVertex();
    }

    @Override
    protected void populateCustomProductVertexWithWorkspaceEdge(Edge propertyVertexEdge, WorkProductVertex vertex) {
    }

    @Override
    protected void updateProductEdge(ElementUpdateContext<Edge> elemCtx, UpdateProductEdgeOptions update, Visibility visibility) {
    }

    public void updateVertices(
            GraphUpdateContext ctx,
            Vertex productVertex,
            Map<String, UpdateProductEdgeOptions> updateVertices,
            Visibility visibility
    ) {
        if (updateVertices != null) {
            @SuppressWarnings("unchecked")
            Set<String> vertexIds = updateVertices.keySet();
            for (String id : vertexIds) {
                UpdateProductEdgeOptions updateData = updateVertices.get(id);
                addOrUpdateProductEdgeToEntity(ctx, productVertex, id, updateData, visibility);
            }
        }
    }

    public void removeVertices(
            GraphUpdateContext ctx,
            Vertex productVertex,
            String[] removeVertices,
            Authorizations authorizations
    ) {
        if (removeVertices != null) {
            for (String id : removeVertices) {
                Edge productVertexEdge = ctx.getGraph().getEdge(
                        getEdgeId(productVertex.getId(), id),
                        FetchHints.NONE,
                        authorizations
                );

                if (productVertexEdge != null) {
                    ctx.getGraph().deleteEdge(productVertexEdge, authorizations);
                }
            }
        }
    }

    @Override
    public String getKind() {
        return KIND;
    }
}
