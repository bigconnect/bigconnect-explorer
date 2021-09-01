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

import com.google.common.annotations.VisibleForTesting;
import com.google.common.collect.Lists;
import com.google.common.collect.Sets;
import com.google.inject.Inject;
import com.mware.core.bootstrap.InjectHelper;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcAccessDeniedException;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.ClientApiWorkspace;
import com.mware.core.model.graph.ElementUpdateContext;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.graph.GraphUpdateContext;
import com.mware.core.model.plugin.PluginStateRepository;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.WorkspaceSchema;
import com.mware.core.model.properties.types.StringBcProperty;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.schema.SchemaConstants;
import com.mware.core.model.user.GraphAuthorizationRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceEntity;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.BcVisibility;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.trace.Traced;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.ClientApiConverter;
import com.mware.core.util.JSONUtil;
import com.mware.ge.*;
import com.mware.ge.values.storable.*;
import com.mware.ontology.WebWorkspaceSchema;
import com.mware.product.*;
import com.mware.web.WebAppPlugin;
import org.apache.commons.codec.digest.DigestUtils;
import org.json.JSONObject;

import javax.inject.Singleton;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static com.google.common.base.Preconditions.checkNotNull;
import static com.mware.core.model.workspace.WorkspaceRepository.*;
import static com.mware.core.util.StreamUtil.stream;

@Singleton
public class WebWorkspaceRepository {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(WebWorkspaceRepository.class);
    public static final BcVisibility VISIBILITY_PRODUCT = new BcVisibility(VISIBILITY_PRODUCT_STRING);

    private final Graph graph;
    private final WebQueueRepository webQueueRepository;
    private final WorkspaceRepository workspaceRepository;
    private final AuthorizationRepository authorizationRepository;
    private final Configuration configuration;
    private final VisibilityTranslator visibilityTranslator;
    private final GraphRepository graphRepository;
    private final PluginStateRepository pluginStateRepository;

    private Collection<WorkProductService> workProductServices;
    private Collection<WebWorkspaceListener> webWorkspaceListeners;

    @Inject
    public WebWorkspaceRepository(
            Graph graph,
            WebQueueRepository webQueueRepository,
            WorkspaceRepository workspaceRepository,
            AuthorizationRepository authorizationRepository,
            VisibilityTranslator visibilityTranslator,
            Configuration configuration,
            GraphAuthorizationRepository graphAuthorizationRepository,
            GraphRepository graphRepository,
            PluginStateRepository pluginStateRepository
    ) {
        this.graph = graph;
        this.webQueueRepository = webQueueRepository;
        this.workspaceRepository = workspaceRepository;
        this.authorizationRepository = authorizationRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.configuration = configuration;
        this.graphRepository = graphRepository;
        this.pluginStateRepository = pluginStateRepository;

        graphAuthorizationRepository.addAuthorizationToGraph(VISIBILITY_PRODUCT_STRING);
    }

    public Dashboard findDashboardById(String workspaceId, String dashboardId, User user) {
        LOGGER.debug("findDashboardById(dashboardId: %s, userId: %s)", dashboardId, user.getUserId());
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspaceId
        );
        Vertex dashboardVertex = graph.getVertex(dashboardId, authorizations);
        if (dashboardVertex == null) {
            return null;
        }
        if (!workspaceRepository.hasReadPermissions(workspaceId, user)) {
            throw new BcAccessDeniedException(
                    "user " + user.getUserId() + " does not have read access to workspace " + workspaceId,
                    user,
                    workspaceId
            );
        }
        return dashboardVertexToDashboard(workspaceId, dashboardVertex, authorizations);
    }

    public void deleteDashboard(String workspaceId, String dashboardId, User user) {
        LOGGER.debug("deleteDashboard(dashboardId: %s, userId: %s)", dashboardId, user.getUserId());
        if (!workspaceRepository.hasWritePermissions(workspaceId, user)) {
            throw new BcAccessDeniedException(
                    "user " + user.getUserId() + " does not have write access to workspace " + workspaceId,
                    user,
                    workspaceId
            );
        }
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspaceId
        );

        Vertex dashboardVertex = graph.getVertex(dashboardId, authorizations);
        Iterable<Vertex> dashboardItemVertices = dashboardVertex.getVertices(
                Direction.OUT,
                WebWorkspaceSchema.DASHBOARD_TO_DASHBOARD_ITEM_RELATIONSHIP_NAME,
                authorizations
        );
        for (Vertex dashboardItemVertex : dashboardItemVertices) {
            graph.deleteVertex(dashboardItemVertex, authorizations);
        }
        graph.deleteVertex(dashboardVertex, authorizations);
        graph.flush();
    }

    public Collection<Dashboard> findAllDashboardsForWorkspace(final String workspaceId, User user) {
        LOGGER.debug("findAllDashboardsForWorkspace(workspaceId: %s, userId: %s)", workspaceId, user.getUserId());
        final Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspaceId
        );
        final Vertex workspaceVertex = workspaceRepository.getVertex(workspaceId, user);
        if (workspaceVertex == null) {
            return null;
        }
        if (!workspaceRepository.hasReadPermissions(workspaceId, user)) {
            throw new BcAccessDeniedException(
                    "user " + user.getUserId() + " does not have read access to workspace " + workspaceId,
                    user,
                    workspaceId
            );
        }
        Iterable<Vertex> dashboardVertices = workspaceVertex.getVertices(
                Direction.OUT,
                WebWorkspaceSchema.WORKSPACE_TO_DASHBOARD_RELATIONSHIP_NAME,
                FetchHints.ALL,
                authorizations
        );
        return stream(dashboardVertices)
                .map(dashboardVertex -> dashboardVertexToDashboard(workspaceId, dashboardVertex, authorizations))
                .collect(Collectors.toList());
    }

    public DashboardItem findDashboardItemById(String workspaceId, String dashboardItemId, User user) {
        LOGGER.debug("findDashboardItemById(dashboardItemId: %s, userId: %s)", dashboardItemId, user.getUserId());
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspaceId
        );
        Vertex dashboardItemVertex = graph.getVertex(dashboardItemId, authorizations);
        if (dashboardItemVertex == null) {
            return null;
        }
        if (!workspaceRepository.hasReadPermissions(workspaceId, user)) {
            throw new BcAccessDeniedException(
                    "user " + user.getUserId() + " does not have read access to workspace " + workspaceId,
                    user,
                    workspaceId
            );
        }
        return dashboardItemVertexToDashboardItem(dashboardItemVertex);
    }

    public void deleteDashboardItem(String workspaceId, String dashboardItemId, User user) {
        LOGGER.debug("deleteDashboardItem(dashboardItemId: %s, userId: %s)", dashboardItemId, user.getUserId());
        if (!workspaceRepository.hasWritePermissions(workspaceId, user)) {
            throw new BcAccessDeniedException(
                    "user " + user.getUserId() + " does not have write access to workspace " + workspaceId,
                    user,
                    workspaceId
            );
        }
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspaceId
        );
        graph.deleteVertex(dashboardItemId, authorizations);
        graph.flush();
    }

    public String addOrUpdateDashboard(String workspaceId, String dashboardId, String title, User user) {
        LOGGER.debug(
                "addOrUpdateDashboard(workspaceId: %s, dashboardId: %s, userId: %s)",
                workspaceId,
                dashboardId,
                user.getUserId()
        );
        if (!workspaceRepository.hasWritePermissions(workspaceId, user)) {
            throw new BcAccessDeniedException(
                    "user " + user.getUserId() + " does not have write access to workspace " + workspaceId,
                    user,
                    workspaceId
            );
        }
        Vertex workspaceVertex = workspaceRepository.getVertex(workspaceId, user);
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspaceId
        );
        Visibility visibility = WorkspaceRepository.VISIBILITY.getVisibility();
        VertexBuilder dashboardVertexBuilder = graph.prepareVertex(dashboardId, visibility, WebWorkspaceSchema.DASHBOARD_CONCEPT_NAME);
        WorkspaceSchema.TITLE.setProperty(dashboardVertexBuilder, title == null ? "" : title, visibility);
        Vertex dashboardVertex = dashboardVertexBuilder.save(authorizations);

        String edgeId = workspaceVertex.getId() + "_hasDashboard_" + dashboardVertex.getId();
        graph.addEdge(
                edgeId,
                workspaceVertex,
                dashboardVertex,
                WebWorkspaceSchema.WORKSPACE_TO_DASHBOARD_RELATIONSHIP_NAME,
                visibility,
                authorizations
        );

        graph.flush();

        return dashboardVertex.getId();
    }

    public String addOrUpdateDashboardItem(
            String workspaceId,
            String dashboardId,
            String dashboardItemId,
            String title,
            String configuration,
            String extensionId,
            User user
    ) {
        LOGGER.debug(
                "addOrUpdateDashboardItem(workspaceId: %s, dashboardId: %s, dashboardItemId: %s, userId: %s)",
                workspaceId,
                dashboardId,
                dashboardItemId,
                user.getUserId()
        );
        if (!workspaceRepository.hasWritePermissions(workspaceId, user)) {
            throw new BcAccessDeniedException(
                    "user " + user.getUserId() + " does not have write access to workspace " + workspaceId,
                    user,
                    workspaceId
            );
        }
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspaceId
        );
        Visibility visibility = WorkspaceRepository.VISIBILITY.getVisibility();
        VertexBuilder dashboardItemVertexBuilder = graph.prepareVertex(dashboardItemId, visibility, WebWorkspaceSchema.DASHBOARD_ITEM_CONCEPT_NAME);
        WebWorkspaceSchema.DASHBOARD_ITEM_EXTENSION_ID.setProperty(
                dashboardItemVertexBuilder,
                extensionId == null ? "" : extensionId,
                visibility
        );
        WorkspaceSchema.TITLE.setProperty(dashboardItemVertexBuilder, title == null ? "" : title, visibility);
        WebWorkspaceSchema.DASHBOARD_ITEM_CONFIGURATION.setProperty(
                dashboardItemVertexBuilder,
                configuration == null ? "" : configuration,
                visibility
        );
        Vertex dashboardItemVertex = dashboardItemVertexBuilder.save(authorizations);

        if (dashboardId != null) {
            Vertex dashboardVertex = graph.getVertex(dashboardId, authorizations);
            checkNotNull(dashboardVertex, "Could not find dashboard vertex with id: " + dashboardId);

            String edgeId = dashboardVertex.getId() + "_hasDashboardItem_" + dashboardItemVertex.getId();
            graph.addEdge(
                    edgeId,
                    dashboardVertex,
                    dashboardItemVertex,
                    WebWorkspaceSchema.DASHBOARD_TO_DASHBOARD_ITEM_RELATIONSHIP_NAME,
                    visibility,
                    authorizations
            );
        }

        graph.flush();

        return dashboardItemVertex.getId();
    }

    public void deleteProduct(String workspaceId, String productId, User user) {
        LOGGER.debug("deleteProduct(productId: %s, userId: %s)", productId, user.getUserId());
        if (!workspaceRepository.hasWritePermissions(workspaceId, user)) {
            throw new BcAccessDeniedException(
                    "user " + user.getUserId() + " does not have write access to workspace " + workspaceId,
                    user,
                    workspaceId
            );
        }

        fireWorkspaceBeforeDeleteProduct(workspaceId, productId, user);

        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspaceId
        );

        Vertex productVertex = graph.getVertex(productId, authorizations);

        String kind = WebWorkspaceSchema.PRODUCT_KIND.getPropertyValue(productVertex);
        WorkProductService workProductService = getWorkProductServiceByKind(kind);

        if (workProductService instanceof WorkProductServiceHasElements) {
            ((WorkProductServiceHasElements) workProductService).cleanUpElements(graph, productVertex, authorizations);
        }

        graph.deleteVertex(productId, authorizations);
        graph.flush();

        Workspace ws = workspaceRepository.findById(workspaceId, user);
        ClientApiWorkspace userWorkspace = workspaceRepository.toClientApi(ws, user, authorizations);
        webQueueRepository.broadcastWorkProductDelete(productId, userWorkspace);
    }

    public WorkProductAncillaryResponse addOrUpdateProductAncillaryVertex(
            String workspaceId,
            String productId,
            String vertexId,
            User user,
            String sourceGuid,
            UpdateProductEdgeOptions productEdgeOptions,
            GraphUpdateContext.Update<Vertex> updateVertexFn) {
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                VISIBILITY_PRODUCT_STRING,
                workspaceId
        );
        Vertex productVertex = graph.getVertex(productId, authorizations);
        if (productVertex == null) {
            throw new BcException("Unable to update vertex, productId not found: " + productId);
        }

        String kind = WebWorkspaceSchema.PRODUCT_KIND.getPropertyValue(productVertex);
        WorkProductService service = getWorkProductServiceByKind(kind);
        if (!(service instanceof WorkProductServiceHasElements)) {
            throw new BcException("Service doesn't support entities");
        }
        WorkProductServiceHasElements elementsService = (WorkProductServiceHasElements) service;

        Vertex vertex = null;
        Edge edge = null;
        Visibility workspaceVisibility = WorkspaceRepository.VISIBILITY.getVisibility();
        Visibility productVisibility = VISIBILITY_PRODUCT.getVisibility();

        try (GraphUpdateContext ctx = graphRepository.beginGraphUpdate(Priority.NORMAL, user, authorizations)) {
            ctx.setPushOnQueue(false);
            vertex = ctx.getOrCreateVertexAndUpdate(vertexId, productVisibility, SchemaConstants.CONCEPT_TYPE_THING, updateVertexFn).get();

            edge = (Edge) elementsService.addOrUpdateProductEdgeToAncillaryEntity(
                    ctx,
                    productVertex,
                    vertex.getId(),
                    productEdgeOptions,
                    workspaceVisibility
            ).get();

            webQueueRepository.broadcastWorkProductAncillaryChange(
                    productVertex.getId(), workspaceId, vertex.getId(), user, sourceGuid
            );
        } catch (Exception e) {
            throw new BcException("Unable to add or update vertex", e);
        }

        return new WorkProductAncillaryResponse(
                ClientApiConverter.toClientApiVertex(vertex, workspaceId, authorizations),
                elementsService.populateProductVertexWithWorkspaceEdge(edge)
        );
    }

    public void deleteProductAncillaryVertex(String workspaceId, String vertexId, User user, String sourceGuid) {
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                VISIBILITY_PRODUCT_STRING,
                workspaceId
        );

        List<String> productIds = new ArrayList<>();
        try (GraphUpdateContext ctx = graphRepository.beginGraphUpdate(Priority.NORMAL, user, authorizations)) {
            Graph graph = ctx.getGraph();
            Vertex annotation = graph.getVertex(vertexId, authorizations);
            annotation.getEdgeInfos(Direction.BOTH, authorizations).forEach(edgeInfo -> {
                if (WebWorkspaceSchema.PRODUCT_TO_ENTITY_RELATIONSHIP_NAME.equals(edgeInfo.getLabel())) {
                    productIds.add(edgeInfo.getVertexId());
                }
                graph.deleteEdge(edgeInfo.getEdgeId(), authorizations);
            });
            graph.deleteVertex(annotation, authorizations);
        }
        for (String productId : productIds) {
            webQueueRepository.broadcastWorkProductAncillaryChange(
                    productId, workspaceId, vertexId, user, sourceGuid
            );
        }
    }

    public InputStream getProductPreviewById(String workspaceId, String productId, User user) {
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspaceId
        );
        Vertex productVertex = graph.getVertex(productId, authorizations);
        if (productVertex != null) {
            Property previewDataUrlProperty = WebWorkspaceSchema.PRODUCT_PREVIEW_DATA_URL.getProperty(productVertex, user.getUserId());
            if (previewDataUrlProperty != null) {
                StreamingPropertyValue previewValue = (StreamingPropertyValue) previewDataUrlProperty.getValue();
                if (previewValue != null) {
                    return previewValue.getInputStream();
                }
            }
        }
        return null;
    }

    public Vertex getProductVertex(String workspaceId, String productId, User user) {
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspaceId
        );

        return graph.getVertex(productId, authorizations);
    }

    public Map<String, String> getLastActiveProductIdsByWorkspaceId(Iterable<String> workspaceIds, User user) {
        return getToUserEdges(workspaceIds, user)
                .filter(wse -> WebWorkspaceSchema.LAST_ACTIVE_PRODUCT_ID.getPropertyValue(wse, null) != null)
                .collect(Collectors.toMap(
                        wse -> wse.getVertexId(Direction.OUT),
                        wse -> WebWorkspaceSchema.LAST_ACTIVE_PRODUCT_ID.getPropertyValue(wse, null)
                ));
    }

    public String getLastActiveProductId(String workspaceId, User user) {
        Map<String, String> l = getLastActiveProductIdsByWorkspaceId(Lists.newArrayList(workspaceId), user);
        return l.get(workspaceId);
    }


    public void setLastActiveProductId(String workspaceId, String productId, User user) {
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                UserRepository.VISIBILITY_STRING
        );
        getToUserEdges(Lists.newArrayList(workspaceId), user)
                .forEach(e -> WebWorkspaceSchema.LAST_ACTIVE_PRODUCT_ID.setProperty(e, productId, WorkspaceRepository.VISIBILITY.getVisibility(), authorizations));
        graph.flush();
    }

    public Product updateProductPreview(String workspaceId, String productId, String previewDataUrl, User user) {
        LOGGER.debug(
                "updateProductPreview(workspaceId: %s, productId: %s, userId: %s)",
                workspaceId,
                productId,
                user.getUserId()
        );
        if (!workspaceRepository.hasReadPermissions(workspaceId, user)) {
            throw new BcAccessDeniedException(
                    "user " + user.getUserId() + " does not have read access to workspace " + workspaceId,
                    user,
                    workspaceId
            );
        }

        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspaceId
        );
        Visibility visibility = WorkspaceRepository.VISIBILITY.getVisibility();
        Vertex productVertex;
        ProductPreview preview = getProductPreviewFromUrl(previewDataUrl);

        try (GraphUpdateContext ctx = graphRepository.beginGraphUpdate(Priority.NORMAL, user, authorizations)) {
            productVertex = ctx.getOrCreateVertexAndUpdate(productId, visibility, SchemaConstants.CONCEPT_TYPE_THING, elCtx -> {
                if (preview == null) {
                    WebWorkspaceSchema.PRODUCT_PREVIEW_DATA_URL.removeProperty(elCtx.getMutation(), user.getUserId(), visibility);
                } else {
                    StreamingPropertyValue value = new DefaultStreamingPropertyValue(new ByteArrayInputStream(preview.getImageData()), ByteArray.class);
                    value.searchIndex(false);
                    Metadata metadata = Metadata.create();
                    metadata.add("product#previewImageMD5", Values.stringValue(preview.getMD5()), visibility);
                    WebWorkspaceSchema.PRODUCT_PREVIEW_DATA_URL.addPropertyValue(
                            elCtx.getMutation(),
                            user.getUserId(),
                            value,
                            metadata,
                            visibility
                    );
                }
            }).get();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        webQueueRepository.broadcastWorkProductPreviewChange(productVertex.getId(), workspaceId, user, preview == null ? null : preview.getMD5());

        return productVertexToProduct(workspaceId, productVertex, false, null, authorizations, user);
    }

    public Collection<Product> findAllProductsForWorkspace(String workspaceId, User user) {
        LOGGER.debug("findAllProductsForWorkspace(workspaceId: %s, userId: %s)", workspaceId, user.getUserId());
        final Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspaceId
        );
        final Vertex workspaceVertex = workspaceRepository.getVertex(workspaceId, user);
        if (workspaceVertex == null) {
            return null;
        }
        if (!workspaceRepository.hasReadPermissions(workspaceId, user)) {
            throw new BcAccessDeniedException(
                    "user " + user.getUserId() + " does not have read access to workspace " + workspaceId,
                    user,
                    workspaceId
            );
        }
        Iterable<Vertex> productVertices = workspaceVertex.getVertices(
                Direction.OUT,
                WebWorkspaceSchema.WORKSPACE_TO_PRODUCT_RELATIONSHIP_NAME,
                authorizations
        );
        return stream(productVertices)
                .map(productVertex -> productVertexToProduct(workspaceId, productVertex, false, null, authorizations, user))
                .collect(Collectors.toList());
    }

    public Product findProductById(String workspaceId, String productId, GetExtendedDataParams params, boolean includeExtended, User user) {
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                VISIBILITY_PRODUCT_STRING,
                workspaceId
        );
        Vertex productVertex = getProductVertex(workspaceId, productId, user);
        if (productVertex == null) {
            return null;
        }

        String kind = WebWorkspaceSchema.PRODUCT_KIND.getPropertyValue(productVertex);
        WorkProductService workProductService = getWorkProductServiceByKind(kind);
        WorkProductExtendedData extendedData = null;
        if (includeExtended) {
            checkNotNull(params, "params is required when getting extended data");
            extendedData = workProductService.getExtendedData(graph, workspaceRepository.getVertex(workspaceId, user), productVertex, params, user, authorizations);
        }

        return productVertexToProduct(workspaceId, productVertex, includeExtended, extendedData, authorizations, user);
    }

    public Product addOrUpdateProduct(String workspaceId, String productId, String title, String kind, JSONObject params, User user) {
        LOGGER.debug(
                "addOrUpdateProduct(workspaceId: %s, productId: %s, userId: %s)",
                workspaceId,
                productId,
                user.getUserId()
        );
        if (!workspaceRepository.hasWritePermissions(workspaceId, user)) {
            throw new BcAccessDeniedException(
                    "user " + user.getUserId() + " does not have write access to workspace " + workspaceId,
                    user,
                    workspaceId
            );
        }

        Vertex workspaceVertex = workspaceRepository.getVertex(workspaceId, user);
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspaceId
        );
        Visibility visibility = WorkspaceRepository.VISIBILITY.getVisibility();

        AtomicBoolean isNew = new AtomicBoolean();
        Vertex productVertex;
        try (GraphUpdateContext ctx = graphRepository.beginGraphUpdate(Priority.NORMAL, user, authorizations)) {
            productVertex = ctx.getOrCreateVertexAndUpdate(productId, visibility, WebWorkspaceSchema.PRODUCT_CONCEPT_NAME, elemCtx -> {
                isNew.set(elemCtx.isNewElement());
                if (title != null) {
                    WorkspaceSchema.TITLE.updateProperty(elemCtx, title.substring(0, Math.min(title.length(), 128)), visibility);
                }
                if (kind != null) {
                    if (getWorkProductServiceByKind(kind) == null) {
                        throw new BcException("invalid kind: " + kind);
                    }
                    WebWorkspaceSchema.PRODUCT_KIND.updateProperty(elemCtx, kind, visibility);
                }
                if (params != null) {
                    updateProductData(elemCtx, WebWorkspaceSchema.PRODUCT_DATA, params.optJSONObject("data"));
                    updateProductData(elemCtx, WebWorkspaceSchema.PRODUCT_EXTENDED_DATA, params.optJSONObject("extendedData"));
                }
            }).get();

            String edgeId = workspaceVertex.getId() + "_hasProduct_" + productVertex.getId();
            ctx.getOrCreateEdgeAndUpdate(
                    edgeId,
                    workspaceId,
                    productVertex.getId(),
                    WebWorkspaceSchema.WORKSPACE_TO_PRODUCT_RELATIONSHIP_NAME,
                    visibility,
                    edgeCtx -> {
                    }
            );
        } catch (Exception e) {
            throw new BcException("Could not addOrUpdateProduct(workspaceId: " + workspaceId + ", productId: " + productId + ")", e);
        }

        graph.flush();
        workspaceRepository.clearCache();

        Workspace ws = workspaceRepository.findById(workspaceId, user);
        ClientApiWorkspace userWorkspace = workspaceRepository.toClientApi(ws, user, authorizations);

        String skipSourceId = null;
        if (params != null && params.has("broadcastOptions")) {
            JSONObject broadcastOptions = params.getJSONObject("broadcastOptions");
            if (broadcastOptions.optBoolean("preventBroadcastToSourceGuid", false)) {
                skipSourceId = broadcastOptions.getString("sourceGuid");
            }
        }
        webQueueRepository.broadcastWorkProductChange(
                productVertex.getId(),
                skipSourceId,
                userWorkspace.getWorkspaceId(),
                webQueueRepository.getPermissionsWithUsers(userWorkspace, null)
        );

        Product product = productVertexToProduct(workspaceId, productVertex, false, null, authorizations, user);
        if (isNew.get()) {
            fireWorkspaceAddProduct(product, user);
        }
        fireWorkspaceProductUpdated(product, params, user);
        return product;
    }

    public WorkProductAncillaryResponse addOrUpdateProductAncillaryVertex(
            String workspaceId,
            String productId,
            String vertexId,
            User user,
            UpdateProductEdgeOptions productEdgeOptions,
            GraphUpdateContext.Update<Vertex> updateVertexFn) {
        return addOrUpdateProductAncillaryVertex(workspaceId, productId, vertexId, user, null, productEdgeOptions, updateVertexFn);
    }

    private Stream<Edge> getToUserEdges(Iterable<String> workspaceIds, User user) {
        HashSet<String> workspaceIdsSet = Sets.newHashSet(workspaceIds);
        checkNotNull(user, "User is required");
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                UserRepository.VISIBILITY_STRING
        );
        Vertex userVertex = graph.getVertex(user.getUserId(), authorizations);
        checkNotNull(userVertex, "Could not find user vertex with id " + user.getUserId());
        List<String> edgeIds = stream(userVertex.getEdgeInfos(Direction.IN, WORKSPACE_TO_USER_RELATIONSHIP_NAME, authorizations))
                .filter(ei -> workspaceIdsSet.contains(ei.getVertexId()))
                .map(EdgeInfo::getEdgeId)
                .collect(Collectors.toList());
        return stream(graph.getEdges(edgeIds, authorizations));
    }

    private void updateProductData(ElementUpdateContext<Vertex> elemCtx, StringBcProperty property, JSONObject data) {
        if (data == null) {
            return;
        }
        Visibility visibility = WorkspaceRepository.VISIBILITY.getVisibility();
        Metadata metadata = Metadata.create();
        JSONUtil.streamKeys(data).forEach(key -> {
            Object valueObject = data.get(key);
            if (JSONObject.NULL.equals(valueObject)) {
                property.removeProperty(elemCtx, key, visibility);
            } else {
                String value = valueObject.toString();
                property.updateProperty(elemCtx, key, value, metadata, visibility);
            }
        });
    }

    private ProductPreview getProductPreviewFromUrl(String url) {
        if (url != null && url.contains("base64")) {
            String encodingPrefix = "base64,";
            int contentStartIndex = url.indexOf(encodingPrefix) + encodingPrefix.length();
            byte[] imageData = Base64.getDecoder().decode(url.substring(contentStartIndex));
            return new ProductPreview(imageData, DigestUtils.md5Hex(imageData));
        }
        return null;
    }

    private JSONObject getProductDataJson(Vertex productVertex) {
        JSONObject data = new JSONObject();
        Iterable<Property> dataProperties = WebWorkspaceSchema.PRODUCT_DATA.getProperties(productVertex);
        for (Property dataProperty : dataProperties) {
            data.put(dataProperty.getKey(), dataProperty.getValue());
        }
        return data;
    }

    private JSONObject getProductExtendedDataJson(Vertex productVertex, WorkProductExtendedData extendedData) {
        JSONObject extendedDataJson;
        if (extendedData == null) {
            extendedDataJson = new JSONObject();
        } else {
            extendedDataJson = ClientApiConverter.clientApiToJSONObject(extendedData);
        }
        Iterable<Property> extendedDataProperties = WebWorkspaceSchema.PRODUCT_EXTENDED_DATA.getProperties(productVertex);
        for (Property extendedDataProperty : extendedDataProperties) {
            extendedDataJson.put(extendedDataProperty.getKey(), JSONUtil.parseObject(((TextValue)extendedDataProperty.getValue()).stringValue()));
        }
        return extendedDataJson;
    }

    private String getProductPreviewDataMd5(Vertex productVertex, User user) {
        Property previewDataUrlProperty = WebWorkspaceSchema.PRODUCT_PREVIEW_DATA_URL.getProperty(productVertex, user.getUserId());
        String md5 = null;
        if (previewDataUrlProperty != null) {
            Metadata.Entry entry = previewDataUrlProperty.getMetadata().getEntry("product#previewImageMD5");
            if (entry != null) {
                md5 = ((TextValue) entry.getValue()).stringValue();
            }
        }
        return md5;
    }

    private Product productVertexToProduct(
            String workspaceId,
            Vertex productVertex,
            boolean includeExtended,
            WorkProductExtendedData workProductExtendedData,
            Authorizations authorizations,
            User user
    ) {
        String title = WorkspaceSchema.TITLE.getPropertyValue(productVertex);
        String kind = WebWorkspaceSchema.PRODUCT_KIND.getPropertyValue(productVertex);
        JSONObject data = getProductDataJson(productVertex);
        JSONObject extendedData = includeExtended ? getProductExtendedDataJson(productVertex, workProductExtendedData) : null;
        String md5 = getProductPreviewDataMd5(productVertex, user);

        // Don't use current workspace, use the product workspace.
        List<EdgeInfo> edgeInfos = Lists.newArrayList(productVertex.getEdgeInfos(Direction.BOTH, WebWorkspaceSchema.WORKSPACE_TO_PRODUCT_RELATIONSHIP_NAME, authorizations));
        if (edgeInfos.size() > 0) {
            workspaceId = edgeInfos.get(0).getVertexId();
        }

        return new GeProduct(productVertex.getId(), workspaceId, title, kind, data, extendedData, md5);
    }

    private Dashboard dashboardVertexToDashboard(
            String workspaceId,
            Vertex dashboardVertex,
            Authorizations authorizations
    ) {
        String title = WorkspaceSchema.TITLE.getPropertyValue(dashboardVertex);
        Iterable<Vertex> dashboardItemVertices = dashboardVertex.getVertices(
                Direction.OUT,
                WebWorkspaceSchema.DASHBOARD_TO_DASHBOARD_ITEM_RELATIONSHIP_NAME,
                authorizations
        );
        List<DashboardItem> items = stream(dashboardItemVertices)
                .map(this::dashboardItemVertexToDashboardItem)
                .collect(Collectors.toList());
        return new GeDashboard(dashboardVertex.getId(), workspaceId, title, items);
    }

    private DashboardItem dashboardItemVertexToDashboardItem(Vertex dashboardItemVertex) {
        String dashboardItemId = dashboardItemVertex.getId();
        String extensionId = WebWorkspaceSchema.DASHBOARD_ITEM_EXTENSION_ID.getPropertyValue(
                dashboardItemVertex,
                null
        );
        String dashboardItemTitle = WorkspaceSchema.TITLE.getPropertyValue(dashboardItemVertex, null);
        String configuration = WebWorkspaceSchema.DASHBOARD_ITEM_CONFIGURATION.getPropertyValue(
                dashboardItemVertex,
                null
        );
        return new GeDashboardItem(dashboardItemId, extensionId, dashboardItemTitle, configuration);
    }

    public WorkProductService getWorkProductServiceByKind(String kind) {
        if (kind == null) {
            throw new BcException("Work product kind must not be null");
        }
        if (workProductServices == null) {
            if (configuration == null) {
                throw new BcException("Configuration not injected");
            } else {
                workProductServices = InjectHelper.getInjectedServices(WebAppPlugin.class, configuration)
                        .stream()
                        .filter(plugin -> pluginStateRepository.isEnabled(plugin.getClass().getName()))
                        .map(WebAppPlugin::getWorkProductService)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toList());
            }
        }
        Optional<WorkProductService> foundProductService = workProductServices.stream()
                .filter(workProduct -> workProduct.getKind().equals(kind))
                .findFirst();

        if (foundProductService.isPresent()) {
            return foundProductService.get();
        } else {
            throw new BcException("Work Product of kind: " + kind + " not found");
        }
    }

    protected void fireWorkspaceBeforeDeleteProduct(String workspaceId, String productId, User user) {
        for (WebWorkspaceListener workspaceListener : getWebWorkspaceListeners()) {
            workspaceListener.workspaceBeforeDeleteProduct(workspaceId, productId, user);
        }
    }

    protected void fireWorkspaceProductUpdated(Product product, JSONObject params, User user) {
        for (WebWorkspaceListener workspaceListener : getWebWorkspaceListeners()) {
            workspaceListener.workspaceProductUpdated(product, params, user);
        }
    }

    protected void fireWorkspaceAddProduct(Product product, User user) {
        for (WebWorkspaceListener workspaceListener : getWebWorkspaceListeners()) {
            workspaceListener.workspaceAddProduct(product, user);
        }
    }

    public Collection<WebWorkspaceListener> getWebWorkspaceListeners() {
        if (webWorkspaceListeners == null) {
            webWorkspaceListeners = InjectHelper.getInjectedServices(WebWorkspaceListener.class, configuration);
        }
        return webWorkspaceListeners;
    }

    @Traced
    protected Iterable<Edge> findModifiedEdges(
            final Workspace workspace,
            List<WorkspaceEntity> workspaceEntities,
            boolean includeHidden,
            User user
    ) {
        Authorizations systemAuthorizations = authorizationRepository.getGraphAuthorizations(
                user,
                BcVisibility.SUPER_USER_VISIBILITY_STRING,
                workspace.getWorkspaceId()
        );

        Iterable<Vertex> vertices = stream(WorkspaceEntity.toVertices(workspaceEntities, graph, systemAuthorizations))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                user,
                VISIBILITY_STRING,
                workspace.getWorkspaceId()
        );
        Iterable<String> edgeIds = graph.findRelatedEdgeIdsForVertices(vertices, authorizations);

        return graph.getEdges(
                edgeIds,
                includeHidden ? FetchHints.ALL_INCLUDING_HIDDEN : FetchHints.ALL,
                authorizations
        );
    }

    @VisibleForTesting
    public void setWorkProductServices(List<WorkProductService> workProductServices) {
        this.workProductServices = workProductServices;
    }

    private class ProductPreview {
        private byte[] imageData;
        private String md5;

        ProductPreview(byte[] imageData, String md5) {
            this.imageData = imageData;
            this.md5 = md5;
        }

        public byte[] getImageData() {
            return imageData;
        }

        public String getMD5() {
            return md5;
        }
    }
}
