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
package com.mware.web.routes.edge;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.clientapi.dto.ClientApiEdge;
import com.mware.core.model.clientapi.dto.ClientApiSourceInfo;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.graph.VisibilityAndElementMutation;
import com.mware.core.model.schema.SchemaProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.ClientApiConverter;
import com.mware.core.util.GeMetadataUtil;
import com.mware.ge.*;
import com.mware.ge.values.storable.Value;
import com.mware.security.ACLProvider;
import com.mware.web.BadRequestException;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.parameterProviders.JustificationText;
import com.mware.web.routes.SetPropertyBase;
import com.mware.web.util.VisibilityValidator;

import javax.servlet.http.HttpServletRequest;
import java.util.ResourceBundle;

@Singleton
public class EdgeSetProperty extends SetPropertyBase implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(EdgeSetProperty.class);

    private final SchemaRepository schemaRepository;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final WorkspaceRepository workspaceRepository;
    private final GraphRepository graphRepository;
    private final ACLProvider aclProvider;
    private final boolean autoPublishComments;

    @Inject
    public EdgeSetProperty(
            SchemaRepository schemaRepository,
            Graph graph,
            VisibilityTranslator visibilityTranslator,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository,
            WorkspaceRepository workspaceRepository,
            GraphRepository graphRepository,
            ACLProvider aclProvider,
            Configuration configuration
    ) {
        super(graph, visibilityTranslator);
        this.schemaRepository = schemaRepository;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
        this.workspaceRepository = workspaceRepository;
        this.graphRepository = graphRepository;
        this.aclProvider = aclProvider;
        this.autoPublishComments = configuration.getBoolean(Configuration.COMMENTS_AUTO_PUBLISH,
                Configuration.DEFAULT_COMMENTS_AUTO_PUBLISH);
    }

    @Handle
    public ClientApiEdge handle(
            HttpServletRequest request,
            @Required(name = "edgeId") String edgeId,
            @Optional(name = "propertyKey") String propertyKey,
            @Required(name = "propertyName") String propertyName,
            @Required(name = "value") String valueStr,
            @Required(name = "visibilitySource") String visibilitySource,
            @Optional(name = "sourceInfo") String sourceInfo,
            @Optional(name = "metadata") String metadataString,
            @JustificationText String justificationText,
            @ActiveWorkspaceId String workspaceId,
            ResourceBundle resourceBundle,
            User user,
            Authorizations authorizations
    ) throws Exception {
        VisibilityValidator.validate(graph, visibilityTranslator, resourceBundle, visibilitySource, user, authorizations);
        checkRoutePath("edge", propertyName, request);

        boolean isComment = isCommentProperty(propertyName);
        boolean autoPublish = isComment && autoPublishComments;
        if (autoPublish) {
            workspaceId = null;
        }

        if (propertyKey == null) {
            propertyKey = createPropertyKey(propertyName, graph);
        }

        Edge edge = graph.getEdge(edgeId, authorizations);

        aclProvider.checkCanAddOrUpdateProperty(edge, propertyKey, propertyName, user, workspaceId);

        SchemaProperty property = schemaRepository.getRequiredPropertyByName(propertyName, workspaceId);

        Value value;
        try {
            value = property.convertString(valueStr);
        } catch (Exception ex) {
            LOGGER.warn(String.format("Validation error propertyName: %s, valueStr: %s", propertyName, valueStr), ex);
            throw new BadRequestException(ex.getMessage());
        }

        Metadata metadata = GeMetadataUtil.metadataStringToMap(metadataString, visibilityTranslator.getDefaultVisibility());

        VisibilityAndElementMutation<Edge> setPropertyResult = graphRepository.setProperty(
                edge,
                propertyName,
                propertyKey,
                value,
                metadata,
                null,
                visibilitySource,
                workspaceId,
                justificationText,
                ClientApiSourceInfo.fromString(sourceInfo),
                user,
                authorizations
        );
        Edge save = setPropertyResult.elementMutation.save(authorizations);

        if (!autoPublish) {
            // add the vertex to the workspace so that the changes show up in the diff panel
            workspaceRepository.updateEntityOnWorkspace(workspaceId, edge.getVertexId(Direction.IN), user);
            workspaceRepository.updateEntityOnWorkspace(workspaceId, edge.getVertexId(Direction.OUT), user);
        }

        webQueueRepository.broadcastPropertyChange(edge, propertyKey, propertyName, workspaceId);
        workQueueRepository.pushOnDwQueue(
                edge,
                propertyKey,
                propertyName,
                workspaceId,
                visibilitySource,
                Priority.NORMAL,
                ElementOrPropertyStatus.UPDATE,
                null
        );

        return (ClientApiEdge) ClientApiConverter.toClientApi(save, workspaceId, authorizations);
    }
}
