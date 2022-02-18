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
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.clientapi.dto.ClientApiSourceInfo;
import com.mware.core.model.clientapi.dto.ClientApiVertex;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.graph.VisibilityAndElementMutation;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.schema.SchemaConstants;
import com.mware.core.model.schema.SchemaProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.WorkspaceHelper;
import com.mware.core.security.AuditEventType;
import com.mware.core.security.AuditService;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.ClientApiConverter;
import com.mware.core.util.GeMetadataUtil;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Metadata;
import com.mware.ge.Vertex;
import com.mware.ge.mutation.ElementMutation;
import com.mware.ge.values.storable.*;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiAddElementProperties;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.parameterProviders.JustificationText;
import com.mware.web.util.VisibilityValidator;
import org.apache.commons.lang.StringUtils;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.ResourceBundle;

import static com.google.common.base.Preconditions.checkNotNull;

@Singleton
public class VertexNew implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexNew.class);

    private final Graph graph;
    private final VisibilityTranslator visibilityTranslator;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final SchemaRepository ontologyRepository;
    private final GraphRepository graphRepository;
    private final WorkspaceHelper workspaceHelper;
    private final AuditService auditService;

    @Inject
    public VertexNew(
            Graph graph,
            VisibilityTranslator visibilityTranslator,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository,
            SchemaRepository ontologyRepository,
            GraphRepository graphRepository,
            WorkspaceHelper workspaceHelper,
            AuditService auditService
    ) {
        this.graph = graph;
        this.visibilityTranslator = visibilityTranslator;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
        this.ontologyRepository = ontologyRepository;
        this.graphRepository = graphRepository;
        this.workspaceHelper = workspaceHelper;
        this.auditService = auditService;
    }

    @Handle
    public ClientApiVertex handle(
            @Optional(name = "vertexId", allowEmpty = false) String vertexId,
            @Required(name = "conceptType", allowEmpty = false) String conceptType,
            @Required(name = "visibilitySource") String visibilitySource,
            @Required(name = "title") String vertexTitle,
            @Optional(name = "lat") double latitude,
            @Optional(name = "lon") double longitude,
            @Optional(name = "properties", allowEmpty = false) String propertiesJsonString,
            @Optional(name = "publish", defaultValue = "false") boolean shouldPublish,
            @JustificationText String justificationText,
            ClientApiSourceInfo sourceInfo,
            @ActiveWorkspaceId(required = false) String workspaceId,
            ResourceBundle resourceBundle,
            User user,
            Authorizations authorizations
    ) throws Exception {
        VisibilityValidator.validate(graph, visibilityTranslator, resourceBundle, visibilitySource, user, authorizations);
        workspaceId = workspaceHelper.getWorkspaceIdOrNullIfPublish(workspaceId, shouldPublish, user);

        Vertex vertex = graphRepository.addVertex(
                vertexId,
                conceptType,
                visibilitySource,
                workspaceId,
                justificationText,
                sourceInfo,
                user,
                authorizations
        );

        if (SchemaConstants.CONCEPT_TYPE_DOCUMENT.equals(conceptType)) {
            BcSchema.MIME_TYPE.addPropertyValue(vertex,"","text",visibilityTranslator.getDefaultVisibility(), authorizations);
        }

        if (longitude != 0 && latitude != 0) {
            String geolocationIRI = ontologyRepository.getPropertyNameByIntent("geoLocation", workspaceId);
            if (geolocationIRI != null) {
                vertex.setProperty(geolocationIRI, Values.geoPointValue(latitude, longitude), visibilityTranslator.getDefaultVisibility(), authorizations);
            }
        }

        if(!StringUtils.isEmpty(vertexTitle)) {
            VisibilityAndElementMutation<Vertex> setPropertyResult =  graphRepository.setProperty(
                    vertex,
                    BcSchema.TITLE.getPropertyName(),
                    graph.getIdGenerator().nextId(),
                    Values.stringValue(vertexTitle),
                    Metadata.create(),
                    null,
                    "",
                    workspaceId,
                    null,
                    null,
                    user,
                    authorizations
            );
            setPropertyResult.elementMutation.save(authorizations);
        }

        ClientApiAddElementProperties properties = null;
        if (propertiesJsonString != null && propertiesJsonString.length() > 0) {
            properties = ClientApiConverter.toClientApi(propertiesJsonString, ClientApiAddElementProperties.class);
            for (ClientApiAddElementProperties.Property property : properties.properties) {

                SchemaProperty ontologyProperty = ontologyRepository.getPropertyByName(property.propertyName, workspaceId);
                checkNotNull(ontologyProperty, "Could not find ontology property '" + property.propertyName + "'");
                Value value = ontologyProperty.convertString(property.value);

                if (BcSchema.TEXT.getPropertyName().equals(property.propertyName)) {
                    Metadata propertyMetadata = Metadata.create();
                    ElementMutation<Vertex> vm = vertex.prepareMutation();
                    BcSchema.MIME_TYPE.addPropertyValue(vm, "", "text/plain", propertyMetadata, visibilityTranslator.getDefaultVisibility());
                    BcSchema.MIME_TYPE_METADATA.setMetadata(propertyMetadata, "text/plain", visibilityTranslator.getDefaultVisibility());
                    BcSchema.TEXT_DESCRIPTION_METADATA.setMetadata(propertyMetadata, "Text", visibilityTranslator.getDefaultVisibility());
                    StreamingPropertyValue propertyValue = new DefaultStreamingPropertyValue(new ByteArrayInputStream(value.toString().getBytes(StandardCharsets.UTF_8)), StringValue.class);
                    vm.addPropertyValue("", BcSchema.TEXT.getPropertyName(), propertyValue, propertyMetadata, visibilityTranslator.getDefaultVisibility());
                    vm.save(authorizations);
                } else if (BcSchema.RAW.getPropertyName().equals(property.propertyName)) {
                    StreamingPropertyValue spv = DefaultStreamingPropertyValue.create(property.value);
                    ElementMutation<Vertex> vm = vertex.prepareMutation();
                    BcSchema.RAW.setProperty(vm, spv, visibilityTranslator.getDefaultVisibility());
                    vm.save(authorizations);
                } else {
                    Metadata metadata = GeMetadataUtil.metadataStringToMap(
                            property.metadataString,
                            this.visibilityTranslator.getDefaultVisibility()
                    );
                    VisibilityAndElementMutation<Vertex> setPropertyResult = graphRepository.setProperty(
                            vertex,
                            property.propertyName,
                            property.propertyKey,
                            value,
                            metadata,
                            null,
                            property.visibilitySource,
                            workspaceId,
                            justificationText,
                            sourceInfo,
                            user,
                            authorizations
                    );
                    setPropertyResult.elementMutation.save(authorizations);
                }
            }
        }
        this.graph.flush();

        LOGGER.debug("Created new empty vertex with id: %s", vertex.getId());
        auditService.auditGenericEvent(user, workspaceId, AuditEventType.CREATE_VERTEX, "id", vertex.getId());

        webQueueRepository.broadcastPropertyChange(vertex, null, null, workspaceId);
        workQueueRepository.pushOnDwQueue(
                vertex,
                null,
                null,
                workspaceId,
                visibilitySource,
                Priority.HIGH,
                ElementOrPropertyStatus.UPDATE,
                null
        );

        if (workspaceId != null) {
            workspaceHelper.updateEntitiesOnWorkspace(
                    workspaceId,
                    Collections.singletonList(vertex.getId()),
                    user
            );
        }

        if (properties != null) {
            for (ClientApiAddElementProperties.Property property : properties.properties) {
                if(webQueueRepository.shouldBroadcastGraphPropertyChange(property.propertyName, Priority.HIGH)) {
                    webQueueRepository.broadcastPropertyChange(vertex, property.propertyKey, property.propertyName, workspaceId);
                }
                workQueueRepository.pushOnDwQueue(
                        vertex,
                        property.propertyKey,
                        property.propertyName,
                        workspaceId,
                        property.visibilitySource,
                        Priority.HIGH,
                        ElementOrPropertyStatus.UPDATE,
                        null
                );
            }
        }

        return (ClientApiVertex) ClientApiConverter.toClientApi(vertex, workspaceId, authorizations);
    }
}
