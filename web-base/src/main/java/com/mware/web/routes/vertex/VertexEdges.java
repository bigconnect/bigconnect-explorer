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

 import com.google.common.base.Strings;
 import com.google.inject.Inject;
 import com.google.inject.Singleton;
 import com.mware.core.exception.BcResourceNotFoundException;
 import com.mware.core.model.clientapi.dto.ClientApiVertex;
 import com.mware.core.model.clientapi.dto.ClientApiVertexEdges;
 import com.mware.core.trace.Trace;
 import com.mware.core.trace.TraceSpan;
 import com.mware.core.util.ClientApiConverter;
 import com.mware.ge.*;
 import com.mware.ge.query.QueryResultsIterable;
 import com.mware.ge.query.VertexQuery;
 import com.mware.ge.query.builder.BoolQueryBuilder;
 import com.mware.ge.query.builder.GeQueryBuilder;
 import com.mware.ge.query.builder.GeQueryBuilders;
 import com.mware.web.framework.ParameterizedHandler;
 import com.mware.web.framework.annotations.Handle;
 import com.mware.web.framework.annotations.Optional;
 import com.mware.web.framework.annotations.Required;
 import com.mware.web.parameterProviders.ActiveWorkspaceId;

@Singleton
public class VertexEdges implements ParameterizedHandler {
    private final Graph graph;

    @Inject
    public VertexEdges(final Graph graph) {
        this.graph = graph;
    }

    @Handle
    public ClientApiVertexEdges handle(
            @Required(name = "graphVertexId") String graphVertexId,
            @Optional(name = "offset", defaultValue = "0") int offset,
            @Optional(name = "size", defaultValue = "25") int size,
            @Optional(name = "edgeLabel") String edgeLabel,
            @Optional(name = "relatedVertexId") String relatedVertexId,
            @Optional(name = "direction", defaultValue = "BOTH") String directionStr,
            @ActiveWorkspaceId String workspaceId,
            Authorizations authorizations
    ) throws Exception {
        Vertex vertex;
        Vertex relatedVertex;
        try (TraceSpan ignored = Trace.start("getOriginalVertex").data("graphVertexId", graphVertexId)) {
            vertex = graph.getVertex(graphVertexId, authorizations);
            if (vertex == null) {
                throw new BcResourceNotFoundException("Could not find vertex: " + graphVertexId);
            }
        }

        if (relatedVertexId != null) {
            relatedVertex = graph.getVertex(relatedVertexId, authorizations);
            if (relatedVertex == null) {
                throw new BcResourceNotFoundException("Could not find related vertex: " + relatedVertexId);
            }
        }

        BoolQueryBuilder qb = GeQueryBuilders.boolQuery()
                .skip(offset)
                .limit(size);
        if (!Strings.isNullOrEmpty(edgeLabel)) {
            qb.and(GeQueryBuilders.hasEdgeLabel(edgeLabel));
        }

        VertexQuery edgesQuery = vertex.query(qb, authorizations);
        Direction direction = Direction.valueOf(directionStr.toUpperCase());
        edgesQuery.hasDirection(direction);

        if (!Strings.isNullOrEmpty(relatedVertexId)) {
            edgesQuery.hasOtherVertexId(relatedVertexId);
        }

        try (QueryResultsIterable<Edge> edges = edgesQuery.edges()) {
            ClientApiVertexEdges result = new ClientApiVertexEdges();

            for (Edge edge : edges) {
                String otherVertexId = edge.getOtherVertexId(graphVertexId);
                Vertex otherVertex = graph.getVertex(otherVertexId, FetchHints.ALL, authorizations);

                if (otherVertex == null) {
                    continue;
                }

                result.getRelationships().add(convertEdgeToClientApi(edge, otherVertex, workspaceId, authorizations));
            }

            result.setTotalReferences(edges.getTotalHits());

            return result;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    /**
     * This is overridable so web plugins can modify the resulting set of edges.
     */
    protected ClientApiVertexEdges.Edge convertEdgeToClientApi(Edge edge, Vertex otherVertex, String workspaceId, Authorizations authorizations) {
        ClientApiVertexEdges.Edge clientApiEdge = new ClientApiVertexEdges.Edge();
        clientApiEdge.setRelationship(ClientApiConverter.toClientApiEdge(edge, workspaceId));

        ClientApiVertex clientApiVertex;
        clientApiVertex = ClientApiConverter.toClientApiVertex(otherVertex, workspaceId, authorizations);
        clientApiEdge.setVertex(clientApiVertex);

        return clientApiEdge;
    }
}
