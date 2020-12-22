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
package com.mware.search.behaviour;

import com.google.inject.Inject;
import com.mware.core.model.clientapi.util.StringUtils;
import com.mware.core.model.user.GraphAuthorizationRepository;
import com.mware.core.security.BcVisibility;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.*;
import com.mware.ge.mutation.ElementMutation;
import com.mware.ge.query.QueryResultsIterable;
import com.mware.ge.util.ConvertingIterable;
import com.mware.ge.values.storable.Values;
import com.mware.ontology.BehaviourSchema;
import com.mware.web.model.ClientApiBehaviour;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static com.google.common.base.Preconditions.checkNotNull;
import static com.mware.core.util.StreamUtil.stream;
import static com.mware.ge.util.IterableUtils.singleOrDefault;
import static com.mware.ontology.BehaviourSchema.BEHAVIOUR_CONCEPT_NAME;
import static com.mware.ontology.BehaviourSchema.BEHAVIOUR_QUERY_CONCEPT_NAME;

public class GeBehaviourRepository implements BehaviourRepository {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(GeBehaviourRepository.class);
    public static final BcVisibility VISIBILITY = new BcVisibility(VISIBILITY_STRING);
    public static final String GRAPH_BH_ID_PREFIX = "BH_";
    public static final String GRAPH_BHQ_ID_PREFIX = "BHQ_";

    private final Graph graph;
    private final Authorizations authorizations;

    @Inject
    public GeBehaviourRepository(Graph graph, GraphAuthorizationRepository graphAuthorizationRepository) {
        this.graph = graph;
        graphAuthorizationRepository.addAuthorizationToGraph(VISIBILITY_STRING);
        Set<String> authorizationsSet = new HashSet<>();
        authorizationsSet.add(VISIBILITY_STRING);
        authorizationsSet.add(BcVisibility.SUPER_USER_VISIBILITY_STRING);
        this.authorizations = graph.createAuthorizations(authorizationsSet);
    }

    @Override
    public Iterable<Behaviour> getAllBehaviours() {
        try (QueryResultsIterable<Vertex> vertices = graph.query(authorizations)
                .hasConceptType(BEHAVIOUR_CONCEPT_NAME)
                .vertices()) {
            return new ConvertingIterable<Vertex, Behaviour>(vertices) {
                @Override
                protected Behaviour convert(Vertex vertex) {
                    return createBehaviourFromVertex(vertex);
                }
            };
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    @Override
    public Behaviour findById(String id) {
        Vertex vertex = graph.getVertex(id, authorizations);
        if (vertex != null)
            return createBehaviourFromVertex(vertex);
        else
            return null;
    }

    @Override
    public Behaviour findByName(String name) {
        Iterable<Vertex> vertices = graph.query(authorizations)
                .has(BehaviourSchema.BH_NAME.getPropertyName(), Values.stringValue(name))
                .hasConceptType(BEHAVIOUR_CONCEPT_NAME)
                .vertices();
        Vertex vertex = singleOrDefault(vertices, null);
        if (vertex != null)
            return createBehaviourFromVertex(vertex);
        else
            return null;
    }

    @Override
    public ClientApiBehaviour toClientApi(Behaviour behaviour) {
        checkNotNull(behaviour, "behaviour cannot be null");

        ClientApiBehaviour clientApiBehaviour = new ClientApiBehaviour();
        clientApiBehaviour.id = behaviour.getId();
        clientApiBehaviour.name = behaviour.getName();
        clientApiBehaviour.description = behaviour.getDescription();
        clientApiBehaviour.threshold = behaviour.getThreshold();

        clientApiBehaviour.queries.addAll(
                behaviour.getQueries().stream()
                    .map((bq) -> toClientApiBehaviourItem(bq))
                    .collect(Collectors.toList())
        );

        return clientApiBehaviour;
    }

    @Override
    public ClientApiBehaviour.BehaviourQueryItem toClientApiBehaviourItem(BehaviourQuery behaviourQuery) {
        checkNotNull(behaviourQuery, "behaviourQuery cannot be null");

        ClientApiBehaviour.BehaviourQueryItem clientApi = new ClientApiBehaviour.BehaviourQueryItem();
        clientApi.id = behaviourQuery.getId();
        clientApi.savedSearchId = behaviourQuery.getSavedSearchId();
        clientApi.score = behaviourQuery.getScore();
        return clientApi;
    }

    @Override
    public void createBehaviour(ClientApiBehaviour clientApiBehaviour) {
        String id = GRAPH_BH_ID_PREFIX + graph.getIdGenerator().nextId();
        VertexBuilder builder = graph.prepareVertex(id, VISIBILITY.getVisibility(), BEHAVIOUR_CONCEPT_NAME);
        BehaviourSchema.BH_NAME.setProperty(builder, StringUtils.trimIfNull(clientApiBehaviour.name), VISIBILITY.getVisibility());
        BehaviourSchema.BH_DESCRIPTION.setProperty(builder, StringUtils.trimIfNull(clientApiBehaviour.description), VISIBILITY.getVisibility());
        BehaviourSchema.BH_THRESHOLD.setProperty(builder, clientApiBehaviour.threshold, VISIBILITY.getVisibility());
        Vertex behaviourVertex = builder.save(authorizations);

        clientApiBehaviour.queries.forEach(q -> {
            String qid = GRAPH_BHQ_ID_PREFIX + graph.getIdGenerator().nextId();
            VertexBuilder qbuilder = graph.prepareVertex(qid, VISIBILITY.getVisibility(), BEHAVIOUR_QUERY_CONCEPT_NAME);
            BehaviourSchema.BHQ_SAVED_SEARCH_ID.setProperty(qbuilder, q.savedSearchId, VISIBILITY.getVisibility());
            BehaviourSchema.BHQ_SCORE.setProperty(qbuilder, q.score, VISIBILITY.getVisibility());

            Vertex queryVertex = qbuilder.save(authorizations);
            EdgeBuilder edgeBuilder = graph.prepareEdge(
                    behaviourVertex,
                    queryVertex,
                    BehaviourSchema.BEHAVIOUR_TO_BEHAVIOUR_QUERY_EDGE_NAME,
                    VISIBILITY.getVisibility()
            );
            edgeBuilder.save(authorizations);
        });

        graph.flush();
    }

    @Override
    public void updateBehaviour(ClientApiBehaviour clientApiBehaviour) {
        checkNotNull(clientApiBehaviour);

        Vertex behaviourVertex = graph.getVertex(clientApiBehaviour.id, authorizations);
        checkNotNull(behaviourVertex, "Behaviour with id="+clientApiBehaviour.id+" was not found.");

        ElementMutation mutation = behaviourVertex.prepareMutation();
        BehaviourSchema.BH_NAME.setProperty(mutation, StringUtils.trimIfNull(clientApiBehaviour.name), VISIBILITY.getVisibility());
        BehaviourSchema.BH_DESCRIPTION.setProperty(mutation, StringUtils.trimIfNull(clientApiBehaviour.description), VISIBILITY.getVisibility());
        BehaviourSchema.BH_THRESHOLD.setProperty(mutation, clientApiBehaviour.threshold, VISIBILITY.getVisibility());
        mutation.save(authorizations);

        Iterable<Vertex> behaviourQueryVertices = behaviourVertex.getVertices(
                Direction.OUT,
                BehaviourSchema.BEHAVIOUR_TO_BEHAVIOUR_QUERY_EDGE_NAME,
                FetchHints.ALL,
                authorizations
        );

        behaviourQueryVertices.forEach(bq -> graph.deleteVertex(bq, authorizations));

        clientApiBehaviour.queries.forEach(q -> {
            String qid = GRAPH_BHQ_ID_PREFIX + graph.getIdGenerator().nextId();
            VertexBuilder qbuilder = graph.prepareVertex(qid, VISIBILITY.getVisibility(), BEHAVIOUR_QUERY_CONCEPT_NAME);
            BehaviourSchema.BHQ_SAVED_SEARCH_ID.setProperty(qbuilder, q.savedSearchId, VISIBILITY.getVisibility());
            BehaviourSchema.BHQ_SCORE.setProperty(qbuilder, q.score, VISIBILITY.getVisibility());

            Vertex queryVertex = qbuilder.save(authorizations);
            EdgeBuilder edgeBuilder = graph.prepareEdge(
                    behaviourVertex,
                    queryVertex,
                    BehaviourSchema.BEHAVIOUR_TO_BEHAVIOUR_QUERY_EDGE_NAME,
                    VISIBILITY.getVisibility()
            );
            edgeBuilder.save(authorizations);
        });

        graph.flush();
    }

    @Override
    public void delete(String behaviourId) {
        checkNotNull(behaviourId, "behaviour id cannot be null");
        Vertex behaviourVertex = graph.getVertex(behaviourId, authorizations);
        checkNotNull(behaviourVertex, "Behaviour with id="+behaviourId+" was not found.");

        Iterable<Vertex> behaviourQueryVertices = behaviourVertex.getVertices(
                Direction.OUT,
                BehaviourSchema.BEHAVIOUR_TO_BEHAVIOUR_QUERY_EDGE_NAME,
                FetchHints.ALL,
                authorizations
        );

        behaviourQueryVertices.forEach(bq -> graph.deleteVertex(bq, authorizations));

        graph.deleteVertex(behaviourVertex, authorizations);
        graph.flush();
    }

    private Behaviour createBehaviourFromVertex(Vertex vertex) {
        checkNotNull(vertex, "vertex cannot be null");

        Iterable<Vertex> behaviourQueryVertices = vertex.getVertices(
                Direction.OUT,
                BehaviourSchema.BEHAVIOUR_TO_BEHAVIOUR_QUERY_EDGE_NAME,
                FetchHints.ALL,
                authorizations
        );

        List<BehaviourQuery> behaviourQueries = stream(behaviourQueryVertices)
                .map(this::createBeaBehaviourQueryFromVertex)
                .collect(Collectors.toList());

        return new GeBehaviour(vertex, behaviourQueries);
    }

    private BehaviourQuery createBeaBehaviourQueryFromVertex(Vertex vertex) {
        checkNotNull(vertex, "vertex cannot be null");
        return new GeBehaviourQuery(vertex);
    }
}
