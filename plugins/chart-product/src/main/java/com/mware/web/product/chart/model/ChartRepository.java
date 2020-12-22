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
package com.mware.web.product.chart.model;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.graph.GraphUpdateContext;
import com.mware.core.model.properties.types.PropertyMetadata;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.user.GraphAuthorizationRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.security.BcVisibility;
import com.mware.core.user.User;
import com.mware.core.util.ClientApiConverter;
import com.mware.ge.*;
import org.json.JSONObject;

import java.util.stream.Collectors;

import static com.google.common.base.Preconditions.checkNotNull;
import static com.mware.core.util.StreamUtil.stream;

@Singleton
public class ChartRepository {
    public static final String VISIBILITY_STRING = "chart";
    public static final BcVisibility VISIBILITY = new BcVisibility(VISIBILITY_STRING);

    private final Graph graph;
    private final GraphRepository graphRepository;
    private final UserRepository userRepository;
    private final AuthorizationRepository authorizationRepository;

    @Inject
    public ChartRepository(
            Graph graph,
            GraphRepository graphRepository,
            UserRepository userRepository,
            GraphAuthorizationRepository graphAuthorizationRepository,
            AuthorizationRepository authorizationRepository
    ) {
        this.graph = graph;
        this.graphRepository = graphRepository;
        this.userRepository = userRepository;
        this.authorizationRepository = authorizationRepository;
        graphAuthorizationRepository.addAuthorizationToGraph(VISIBILITY_STRING);
    }

    public ClientApiChart updateChart(String chartId, String chartName, String datasetId, JSONObject chartData, User user) {
        checkNotNull(chartId, "chartId is required");
        checkNotNull(chartName, "chartName is required");
        checkNotNull(datasetId, "datasetId is required");
        checkNotNull(user, "user is required");
        checkNotNull(chartData, "chartData is required");

        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                UserRepository.VISIBILITY_STRING
        );

        Vertex chartVertex = graph.getVertex(chartId, authorizations);
        if(chartVertex != null) {
            try (GraphUpdateContext ctx = graphRepository.beginGraphUpdate(Priority.LOW, user, authorizations)) {
                ctx.setPushOnQueue(false);
                Visibility visibility = VISIBILITY.getVisibility();

                chartVertex = ctx.update(chartVertex, elemCtx -> {
                    ChartProperties.NAME.updateProperty(elemCtx, chartName, visibility);
                    ChartProperties.DATASET_ID.updateProperty(elemCtx, datasetId, visibility);
                    ChartProperties.CHART_DATA.updateProperty(elemCtx, chartData, visibility);
                }).get();

                return toClientApiChart(chartVertex);
            } catch (Exception e) {
                throw new BcException("Could not update chart", e);
            }
        } else {
            throw new BcException("Could not find an existing chart to update");
        }
    }

    public ClientApiChart saveChart(String name, String datasetId, JSONObject chartData, User user) {
        checkNotNull(name, "name is required");
        checkNotNull(datasetId, "datasetId is required");
        checkNotNull(user, "User is required");
        checkNotNull(chartData, "chartData is required");

        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                UserRepository.VISIBILITY_STRING
        );

        try (GraphUpdateContext ctx = graphRepository.beginGraphUpdate(Priority.LOW, user, authorizations)) {
            ctx.setPushOnQueue(false);
            Visibility visibility = VISIBILITY.getVisibility();
            Vertex chartVertex = ctx.getOrCreateVertexAndUpdate(null, visibility, ChartProperties.CONCEPT_TYPE_CHART, elemCtx -> {
                PropertyMetadata metadata = new PropertyMetadata(user, new VisibilityJson(), visibility);
                if (elemCtx.isNewElement()) {
                    elemCtx.updateBuiltInProperties(metadata);
                }

                ChartProperties.NAME.updateProperty(elemCtx, name, metadata);
                ChartProperties.DATASET_ID.updateProperty(elemCtx, datasetId, metadata);
                ChartProperties.CHART_DATA.updateProperty(elemCtx, chartData, metadata);
            }).get();

            Vertex userVertex = graph.getVertex(user.getUserId(), authorizations);
            checkNotNull(userVertex, "Could not find user vertex with id " + user.getUserId());

            String edgeId = userVertex.getId() + "_" + ChartProperties.HAS_SAVED_CHART + "_" + chartVertex.getId();
            ctx.getOrCreateEdgeAndUpdate(
                    edgeId,
                    userVertex.getId(),
                    chartVertex.getId(),
                    ChartProperties.HAS_SAVED_CHART,
                    VISIBILITY.getVisibility(),
                    elemCtx -> {
                    }
            );

            return toClientApiChart(chartVertex);
        }  catch (Exception ex) {
            throw new BcException("Could not save chart", ex);
        }
    }

    public ClientApiChart getChartById(User user, String id) {
        checkNotNull(id, "Id is required");

        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                UserRepository.VISIBILITY_STRING
        );

        Vertex chartVertex = graph.getVertex(id, authorizations);
        if(chartVertex == null)
            return null;
        else
            return toClientApiChart(chartVertex);
    }

    public void deleteChart(User user, String id) {
        checkNotNull(user, "User is required");
        checkNotNull(id, "id is required");
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                UserRepository.VISIBILITY_STRING
        );

        Vertex chartVertex = graph.getVertex(id, authorizations);
        checkNotNull(chartVertex, "Could not find chart with id " + id);

        graph.deleteVertex(chartVertex, authorizations);
        graph.flush();
    }

    public Iterable<ClientApiChart> getUserSavedCharts(User user) {
        checkNotNull(user, "User is required");

        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                UserRepository.VISIBILITY_STRING
        );

        Vertex userVertex = graph.getVertex(user.getUserId(), authorizations);
        checkNotNull(userVertex, "Could not find user vertex with id " + user.getUserId());
        Iterable<Vertex> userChartVertices = userVertex.getVertices(
                Direction.OUT,
                ChartProperties.HAS_SAVED_CHART,
                authorizations
        );
        return stream(userChartVertices)
                .map(chartVertex -> toClientApiChart(chartVertex))
                .collect(Collectors.toList());
    }

    public static ClientApiChart toClientApiChart(Vertex chartVertex) {
        ClientApiChart result = new ClientApiChart();
        result.id = chartVertex.getId();
        result.name = ChartProperties.NAME.getPropertyValue(chartVertex);
        result.datasetId = ChartProperties.DATASET_ID.getPropertyValue(chartVertex);
        result.chartData = ClientApiConverter.toClientApiValue(ChartProperties.CHART_DATA.getPropertyValue(chartVertex));
        return result;
    }
}
