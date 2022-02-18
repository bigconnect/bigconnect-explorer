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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.Lists;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.clientapi.dto.ClientApiSourceInfo;
import com.mware.core.model.clientapi.dto.ClientApiVertex;
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.graph.VisibilityAndElementMutation;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.RawObjectSchema;
import com.mware.core.model.schema.SchemaProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.WorkspaceHelper;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.AuditEventType;
import com.mware.core.security.AuditService;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.*;
import com.mware.ge.*;
import com.mware.ge.util.IterableUtils;
import com.mware.ge.values.storable.DefaultStreamingPropertyValue;
import com.mware.ge.values.storable.StringValue;
import com.mware.ge.values.storable.Value;
import com.mware.ge.values.storable.Values;
import com.mware.security.ACLProvider;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.parameterProviders.JustificationText;
import com.mware.web.routes.SetPropertyBase;
import com.mware.web.util.VisibilityValidator;
import org.apache.commons.lang3.StringUtils;

import javax.servlet.http.HttpServletRequest;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.ResourceBundle;

@Singleton
public class VertexSetProperty extends SetPropertyBase implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexSetProperty.class);

    private final SchemaRepository schemaRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final GraphRepository graphRepository;
    private final ACLProvider aclProvider;
    private final WorkspaceHelper workspaceHelper;
    private final boolean autoPublishComments;
    private final AuditService auditService;

    @Inject
    public VertexSetProperty(
            SchemaRepository schemaRepository,
            Graph graph,
            VisibilityTranslator visibilityTranslator,
            WorkspaceRepository workspaceRepository,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository,
            WorkspaceHelper workspaceHelper,
            GraphRepository graphRepository,
            ACLProvider aclProvider,
            Configuration configuration,
            AuditService auditService
    ) {
        super(graph, visibilityTranslator);
        this.schemaRepository = schemaRepository;
        this.workspaceRepository = workspaceRepository;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
        this.workspaceHelper  = workspaceHelper;
        this.graphRepository = graphRepository;
        this.aclProvider = aclProvider;
        this.autoPublishComments = configuration.getBoolean(
                Configuration.COMMENTS_AUTO_PUBLISH,
                Configuration.DEFAULT_COMMENTS_AUTO_PUBLISH
        );
        this.auditService = auditService;
    }

    @Handle
    public ClientApiVertex handle(
            HttpServletRequest request,
            @Required(name = "graphVertexId") String graphVertexId,
            @Optional(name = "propertyKey") String propertyKey,
            @Required(name = "propertyName") String propertyName,
            @Optional(name = "value") String valueStr,
            @Optional(name = "values") String valuesStr,
            @Required(name = "visibilitySource") String visibilitySource,
            @Optional(name = "oldVisibilitySource") String oldVisibilitySource,
            @Optional(name = "sourceInfo") String sourceInfoString,
            @Optional(name = "metadata") String metadataString,
            @JustificationText String justificationText,
            @ActiveWorkspaceId String workspaceId,
            ResourceBundle resourceBundle,
            User user,
            Authorizations authorizations
    ) throws Exception {
        if (valueStr == null && valuesStr == null) {
            throw new BcException("Parameter: 'value' or 'values' is required in the request");
        }

        VisibilityValidator.validate(graph, visibilityTranslator, resourceBundle, visibilitySource, user, authorizations);
        checkRoutePath("vertex", propertyName, request);

        boolean isComment = isCommentProperty(propertyName);

        boolean autoPublish = isComment && autoPublishComments;
        if (autoPublish) {
            workspaceId = null;
        }

        if (propertyKey == null) {
            propertyKey = createPropertyKey(propertyName, graph);
        }

        Metadata metadata = GeMetadataUtil.metadataStringToMap(metadataString, visibilityTranslator.getDefaultVisibility());
        ClientApiSourceInfo sourceInfo = ClientApiSourceInfo.fromString(sourceInfoString);
        Vertex vertex = graph.getVertex(graphVertexId, authorizations);

        aclProvider.checkCanAddOrUpdateProperty(vertex, propertyKey, propertyName, user, workspaceId);

        List<SavePropertyResults> savePropertyResults = saveProperty(
                vertex,
                propertyKey,
                propertyName,
                valueStr,
                valuesStr,
                justificationText,
                oldVisibilitySource,
                visibilitySource,
                metadata,
                sourceInfo,
                user,
                workspaceId,
                authorizations
        );
        graph.flush();

        StringBuilder auditValue = new StringBuilder();
        if (!StringUtils.isEmpty(valueStr))
            auditValue.append(valueStr);
        else
            auditValue.append(valuesStr);

        auditService.auditGenericEvent(user, workspaceId, AuditEventType.SET_PROPERTY, propertyName, auditValue.toString());

        if (!autoPublish) {
            // add the vertex to the workspace so that the changes show up in the diff panel
            workspaceRepository.updateEntityOnWorkspace(workspaceId, vertex.getId(), user);
        }

        for (SavePropertyResults savePropertyResult : savePropertyResults) {
            if (webQueueRepository.shouldBroadcastGraphPropertyChange(savePropertyResult.getPropertyName(), Priority.HIGH)) {
                webQueueRepository.broadcastPropertyChange(vertex, savePropertyResult.getPropertyKey(), savePropertyResult.getPropertyName(), workspaceId);
            }
            workQueueRepository.pushOnDwQueue(
                    vertex,
                    savePropertyResult.getPropertyKey(),
                    savePropertyResult.getPropertyName(),
                    workspaceId,
                    visibilitySource,
                    Priority.HIGH,
                    ElementOrPropertyStatus.UPDATE,
                    null
            );
        }

        if (sourceInfo != null) {
            webQueueRepository.pushTextUpdated(sourceInfo.vertexId);
        }

        return (ClientApiVertex) ClientApiConverter.toClientApi(vertex, workspaceId, authorizations);
    }

    private List<SavePropertyResults> saveProperty(
            Vertex vertex,
            String propertyKey,
            String propertyName,
            String valueStr,
            String valuesStr,
            String justificationText,
            String oldVisibilitySource,
            String visibilitySource,
            Metadata metadata,
            ClientApiSourceInfo sourceInfo,
            User user,
            String workspaceId,
            Authorizations authorizations
    ) {
        Value value;
        if (isCommentProperty(propertyName)) {
            value = Values.stringValue(valueStr);
        } else if(BcSchema.TEXT.isSameName(propertyName)) {
            value = new DefaultStreamingPropertyValue(new ByteArrayInputStream(valueStr.getBytes(StandardCharsets.UTF_8)), StringValue.class);
            BcSchema.TEXT_DESCRIPTION_METADATA.setMetadata(
                    metadata,
                    "Text" ,
                    new Visibility("")
            );
        } else {
            SchemaProperty property = schemaRepository.getRequiredPropertyByName(propertyName, workspaceId);

            if (property.hasDependentPropertyNames()) {
                return saveDependentProperties(valuesStr,
                        property,
                        oldVisibilitySource,
                        vertex,
                        propertyKey,
                        justificationText,
                        visibilitySource,
                        metadata,
                        sourceInfo,
                        workspaceId,
                        user,
                        authorizations);
            }  else {
                if (valueStr == null && valuesStr == null) {
                    throw new BcException("properties without dependent properties must have a value");
                }
                try {
                    value = (valuesStr == null ? property.convertString(valueStr) : property.convertString(valuesStr));
                } catch (Exception ex) {
                    LOGGER.warn(String.format("Validation error propertyName: %s, valueStr: %s", propertyName, valueStr), ex);
                    throw new BcException(ex.getMessage(), ex);
                }
            }
        }

        if (RawObjectSchema.RAW_LANGUAGE.isSameName(propertyName)) {
            propertyKey = valueStr;
        }

        VisibilityAndElementMutation<Vertex> setPropertyResult = graphRepository.setProperty(
                vertex,
                propertyName,
                propertyKey,
                value,
                metadata,
                oldVisibilitySource,
                visibilitySource,
                workspaceId,
                justificationText,
                sourceInfo,
                user,
                authorizations
        );
        Vertex save = setPropertyResult.elementMutation.save(authorizations);
        return Lists.newArrayList(new SavePropertyResults(save, propertyKey, propertyName));
    }

    private List<SavePropertyResults> saveDependentProperties(String valuesStr,
                                                              SchemaProperty property,
                                                              String oldVisibilitySource,
                                                              Vertex vertex,
                                                              String propertyKey,
                                                              String justificationText,
                                                              String visibilitySource,
                                                              Metadata metadata,
                                                              ClientApiSourceInfo sourceInfo,
                                                              String workspaceId,
                                                              User user,
                                                              Authorizations authorizations) {
        if (valuesStr == null || valuesStr.length() == 0) {
            throw new BcException("ValuesStr must contain at least one property value for saving dependent properties");
        }
        Map<String, String> values;
        try {
            ObjectMapper mapper = new ObjectMapper();
            values = mapper.readValue(valuesStr, new TypeReference<Map<String, String>>() {
            });
        } catch (IOException e) {
            throw new BcException("Unable to parse values", e);
        }

        List<SavePropertyResults> results = new ArrayList<>();
        for (String dependentPropertyIri : property.getDependentPropertyNames()) {
            if (values.get(dependentPropertyIri) == null) {
                VisibilityJson oldVisibilityJson = new VisibilityJson(oldVisibilitySource);
                oldVisibilityJson.addWorkspace(workspaceId);
                Visibility oldVisibility = visibilityTranslator.toVisibility(oldVisibilityJson).getVisibility();

                Property oldProperty = vertex.getProperty(propertyKey, dependentPropertyIri, oldVisibility);

                if (oldProperty != null) {
                    List<Property> properties = IterableUtils.toList(vertex.getProperties());
                    SandboxStatus[] sandboxStatuses = SandboxStatusUtil.getPropertySandboxStatuses(properties, workspaceId);
                    boolean isPropertyPublic = sandboxStatuses[properties.indexOf(oldProperty)] == SandboxStatus.PUBLIC;

                    workspaceHelper.deleteProperty(
                            vertex,
                            oldProperty,
                            isPropertyPublic,
                            workspaceId,
                            Priority.HIGH,
                            authorizations,
                            user
                    );
                }
            } else {
                results.addAll(saveProperty(
                        vertex,
                        propertyKey,
                        dependentPropertyIri,
                        values.get(dependentPropertyIri),
                        null,
                        justificationText,
                        oldVisibilitySource,
                        visibilitySource,
                        metadata,
                        sourceInfo,
                        user,
                        workspaceId,
                        authorizations
                ));
            }
        }
        return results;
    }

    private static class SavePropertyResults {
        private final Vertex vertex;
        private final String propertyKey;
        private final String propertyName;

        SavePropertyResults(Vertex vertex, String propertyKey, String propertyName) {
            this.vertex = vertex;
            this.propertyKey = propertyKey;
            this.propertyName = propertyName;
        }

        public Vertex getVertex() {
            return vertex;
        }

        public String getPropertyKey() {
            return propertyKey;
        }

        public String getPropertyName() {
            return propertyName;
        }
    }
}
