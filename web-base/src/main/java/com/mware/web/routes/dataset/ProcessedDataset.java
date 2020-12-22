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
package com.mware.web.routes.dataset;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.clientapi.dto.ClientApiObject;
import com.mware.core.model.clientapi.dto.ClientApiUser;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.*;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSearch;
import com.mware.web.model.ResponseType;
import com.mware.web.routes.dataset.ProcessedDataset.ClientApiReadProcessedDatasetResponse.GraphNode;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Singleton
public class ProcessedDataset implements ParameterizedHandler  {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(ProcessedDataset.class);
    private final UserRepository userRepository;
    private final AuthorizationRepository authorizationRepository;
    private final Graph graph;
    private final ReadDataset readDataset;

    @Inject
    public ProcessedDataset(UserRepository userRepository,
                            AuthorizationRepository authorizationRepository,
                            Graph graph, ReadDataset readDataset) {
        this.userRepository = userRepository;
        this.authorizationRepository = authorizationRepository;
        this.graph = graph;
        this.readDataset = readDataset;
    }

    @Handle
    public ClientApiReadProcessedDatasetResponse handle(
            @Required(name = "name") String datasetName,
            @Optional(name = "offset") Integer offset,
            @Optional(name = "size") Integer size,
            @Optional(name = "scope") ClientApiSearch.Scope scope,
            User user
    ) throws Exception {
        ReadDataset.ClientApiReadDatasetResponse readDatasetResponse = readDataset.handle(datasetName, offset, size, scope, ResponseType.Json, user);
        ClientApiUser userMe = userRepository.toClientApiPrivate(user);
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(user, userMe.getCurrentWorkspaceId());

        ClientApiReadProcessedDatasetResponse response = new ClientApiReadProcessedDatasetResponse(readDatasetResponse.name, readDatasetResponse.columns);
        response.nodes = processNodes(readDatasetResponse);
        response.links = processLinks(authorizations, response.nodes);
        response.name = datasetName;

        return response;
    }

    private List<GraphNode> processNodes(ReadDataset.ClientApiReadDatasetResponse readDatasetResponse) {
        return readDatasetResponse.rows.stream().map(row -> {
            GraphNode graphNode = new GraphNode();

            for(int i = 0; i < row.elementData.length; i++) {
                graphNode.put(readDatasetResponse.columns.get(i), row.elementData[i]);
            }

            return graphNode;
        }).collect(Collectors.toList());
    }

    private List<ClientApiReadProcessedDatasetResponse.GraphLink> processLinks(Authorizations authorizations, List<GraphNode> nodes) {
        Map<String, Set<String>> inOutPairs = new HashMap<>();
        Set<String> nodeIds = nodes.stream().map(GraphNode::getId).collect(Collectors.toCollection(HashSet::new));
        Iterable<Vertex> vertices = graph.getVertices(nodeIds, authorizations);

        vertices.forEach(vertex -> {
            Iterable<EdgeVertexPair> inEdgeVertexPairs = getEdgeVertexPairsForDataSetNodes(authorizations, nodeIds, vertex, Direction.IN);
            Iterable<EdgeVertexPair> outEdgeVertexPairs = getEdgeVertexPairsForDataSetNodes(authorizations, nodeIds, vertex, Direction.OUT);

            inEdgeVertexPairs.forEach(in -> inOutPairs.merge(in.getVertex().getId(), new HashSet<>(Collections.singleton(vertex.getId())),
                    (v1, v2) -> { Set<String> oldValues = new HashSet<>(v1);
                        oldValues.addAll(v2);
                        return oldValues;
                    }));

            outEdgeVertexPairs.forEach(out -> inOutPairs.merge(vertex.getId(), new HashSet<>(Collections.singleton(out.getVertex().getId())),
                    (v1, v2) -> {
                        Set<String> oldValues = new HashSet<>(v1);
                        oldValues.addAll(v2);
                        return oldValues;
                    }));
        });

        List<ClientApiReadProcessedDatasetResponse.GraphLink> formattedLinks = new ArrayList<>();
        inOutPairs.forEach((key, value) -> value.forEach(val -> formattedLinks.add(new ClientApiReadProcessedDatasetResponse.GraphLink(key, val))));

        return formattedLinks;
    }

    private List<EdgeVertexPair> getEdgeVertexPairsForDataSetNodes(Authorizations authorizations, Set<String> nodeIds, Vertex vertex, Direction in) {
        return StreamSupport.stream(vertex.getEdgeVertexPairs(in, authorizations).spliterator(), false)
                                                                    .filter(pair -> nodeIds.contains(pair.getVertex().getId()))
                                                                    .collect(Collectors.toList());
    }

    public static class ClientApiReadProcessedDatasetResponse implements ClientApiObject {

        public ClientApiReadProcessedDatasetResponse() {
        }

        public ClientApiReadProcessedDatasetResponse(String name, List<String> columns) {
            this.name = name;
            this.columns = columns;
        }

        public String name;
        public List<String> columns = new ArrayList<>();
        public List<GraphNode> nodes = new ArrayList<>();
        public List<GraphLink> links = new ArrayList<>();

        public static class GraphNode {
            public Map<String, Object> data = new HashMap<>();

            public String getId() {
                return (String) data.get("_id_");
            }

            public void put(String key, Object value) {
                this.data.put(key, value);
            }
        }

        public static class GraphLink {

            public GraphLink(String source, String target) {
                this.source = source;
                this.target = target;
            }

            public String source;
            public String target;
        }
    }
}
