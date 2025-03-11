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
import com.mware.core.exception.BcAccessDeniedException;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workspace.WorkspaceHelper;
import com.mware.core.security.AuditEventType;
import com.mware.core.security.AuditService;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.SandboxStatusUtil;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Vertex;
import com.mware.ge.store.StorableVertex;
import com.mware.security.ACLProvider;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.framework.utils.StringUtils;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.core.config.Configuration;
import io.bigconnect.dw.image.face.CompreFaceService;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.jackson.JacksonConverterFactory;

@Singleton
public class VertexRemove implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexRemove.class);
    public static final String CONFIG_BASE_URL = "base-compre-face.url";
    public static final String CONFIG_API_KEY = "face-detector.api.key";

    private final Graph graph;
    private final WorkspaceHelper workspaceHelper;
    private final ACLProvider aclProvider;
    private final AuditService auditService;
    private final Configuration configuration;
    private CompreFaceService compreFaceService;

    @Inject
    public VertexRemove(
            final Graph graph,
            final WorkspaceHelper workspaceHelper,
            final ACLProvider aclProvider,
            final AuditService auditService,
            final Configuration configuration) {
        this.graph = graph;
        this.workspaceHelper = workspaceHelper;
        this.aclProvider = aclProvider;
        this.auditService = auditService;
        this.configuration = configuration;
        prepare();
    }

    // Modified prepare method to use injected configuration
    private void prepare() {
        String baseUrl = configuration.get(CONFIG_BASE_URL, null);
        if (!StringUtils.isEmpty(baseUrl)) {
            Retrofit compreFaceRetrofit = new Retrofit.Builder()
                    .baseUrl(baseUrl)
                    .addConverterFactory(JacksonConverterFactory.create())
                    .build();
            compreFaceService = compreFaceRetrofit.create(CompreFaceService.class);
        }
    }

    private void handlePersonDelete(Vertex vertex) {
        try {
            String title = BcSchema.TITLE.getFirstPropertyValue(vertex);
            if (!StringUtils.isEmpty(title)) {
                String apiKey = configuration.get(CONFIG_API_KEY, "");

                try {
                    Response<Void> response = compreFaceService.deleteSubject(apiKey, title).execute();

                    if (response.isSuccessful()) {
                        LOGGER.info("Successfully deleted person from face recognition system: " + title);
                    } else {
                        LOGGER.warn("Failed to delete person from face recognition system: " + title +
                                ", status code: " + response.code());
                    }
                } catch (Exception e) {
                    LOGGER.error("Error calling face recognition API to delete person: " + title, e);
                }
            } else {
                LOGGER.warn("Cannot delete person from face recognition system - no title property found");
            }
        } catch (Exception e) {
            LOGGER.error("Error handling person deletion", e);
        }
    }

    private void handleImageDelete(Vertex vertex) {
        try {
            // TODO: Implement API call to remove image from face recognition system
            String id = vertex.getId();
            LOGGER.info("Handling image deletion for: " + id);
        } catch (Exception e) {
            LOGGER.error("Error handling image deletion", e);
        }
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "graphVertexId") String graphVertexId,
            @ActiveWorkspaceId String workspaceId,
            User user,
            Authorizations authorizations
    ) throws Exception {
        Vertex vertex = graph.getVertex(graphVertexId, authorizations);
        if (vertex == null) {
            throw new BcResourceNotFoundException("Could not find vertex with id: " + graphVertexId);
        }

        if (!aclProvider.canDeleteElement(vertex, user, workspaceId)) {
            throw new BcAccessDeniedException("Vertex " + graphVertexId + " is not deleteable", user,
                    graphVertexId);
        }

        // Get concept type and handle special cases before deletion
        String conceptType = ((StorableVertex) vertex).getConceptType();
        if ("person".equalsIgnoreCase(conceptType)) {
            handlePersonDelete(vertex);
        } else if ("image".equalsIgnoreCase(conceptType)) {
            handleImageDelete(vertex);
        }

        SandboxStatus sandboxStatus = SandboxStatusUtil.getSandboxStatus(vertex, workspaceId);
        boolean isPublicVertex = sandboxStatus == SandboxStatus.PUBLIC;

        workspaceHelper.deleteVertex(vertex, workspaceId, isPublicVertex, Priority.HIGH, authorizations, user);
        auditService.auditGenericEvent(user, workspaceId, AuditEventType.DELETE_VERTEX, "id", graphVertexId);

        return BcResponse.SUCCESS;
    }
}