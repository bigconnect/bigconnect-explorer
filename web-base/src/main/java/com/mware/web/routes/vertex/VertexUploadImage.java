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

import com.google.common.collect.Lists;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.bigconnect.image.ImageTransform;
import com.mware.bigconnect.image.ImageTransformExtractor;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.clientapi.dto.ClientApiVertex;
import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.RawObjectSchema;
import com.mware.core.model.schema.Concept;
import com.mware.core.model.schema.SchemaConstants;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.ClientApiConverter;
import com.mware.core.util.RowKeyHelper;
import com.mware.ge.*;
import com.mware.ge.mutation.ElementMutation;
import com.mware.ge.values.storable.*;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import org.apache.commons.io.IOUtils;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.Part;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.ZonedDateTime;
import java.util.Date;
import java.util.List;

import static com.google.common.base.Preconditions.checkNotNull;
import static com.mware.ge.util.IterableUtils.toList;

@Singleton
public class VertexUploadImage implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexUploadImage.class);
    private static final String PROCESS = VertexUploadImage.class.getName();
    private static final String MULTI_VALUE_KEY = VertexUploadImage.class.getName();

    private final Graph graph;
    private final SchemaRepository schemaRepository;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final WorkspaceRepository workspaceRepository;
    private final String clockwiseRotationIri;
    private final String yAxisFlippedIri;
    private final String conceptIri;
    private final String entityHasImageIri;

    @Inject
    public VertexUploadImage(
            final Graph graph,
            final SchemaRepository schemaRepository,
            final WorkQueueRepository workQueueRepository,
            final WebQueueRepository webQueueRepository,
            final VisibilityTranslator visibilityTranslator,
            final WorkspaceRepository workspaceRepository
    ) {
        this.graph = graph;
        this.schemaRepository = schemaRepository;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.workspaceRepository = workspaceRepository;

        this.conceptIri = schemaRepository.getRequiredConceptNameByIntent(SchemaConstants.INTENT_ENTITY_IMAGE, SchemaRepository.PUBLIC);
        this.entityHasImageIri = schemaRepository.getRequiredRelationshipNameByIntent(SchemaConstants.INTENT_ENTITY_HAS_IMAGE, SchemaRepository.PUBLIC);
        this.yAxisFlippedIri = schemaRepository.getRequiredPropertyNameByIntent(SchemaConstants.INTENT_MEDIA_Y_AXIS_FLIPPED, SchemaRepository.PUBLIC);
        this.clockwiseRotationIri = schemaRepository.getRequiredPropertyNameByIntent(SchemaConstants.INTENT_MEDIA_CLOCKWISE_ROTATION, SchemaRepository.PUBLIC);
    }

    @Handle
    public ClientApiVertex handle(
            HttpServletRequest request,
            @Required(name = "graphVertexId") String graphVertexId,
            @ActiveWorkspaceId String workspaceId,
            User user,
            Authorizations authorizations
    ) throws Exception {
        final List<Part> files = Lists.newArrayList(request.getParts());

        Concept concept = schemaRepository.getConceptByName(conceptIri, workspaceId);
        checkNotNull(concept, "Could not find image concept: " + conceptIri);

        if (files.size() != 1) {
            throw new RuntimeException("Wrong number of uploaded files. Expected 1 got " + files.size());
        }

        final Part file = files.get(0);
        Workspace workspace = this.workspaceRepository.findById(workspaceId, user);

        Vertex entityVertex = graph.getVertex(graphVertexId, authorizations);
        if (entityVertex == null) {
            throw new BcResourceNotFoundException(String.format("Could not find associated entity vertex for id: %s", graphVertexId));
        }
        ElementMutation<Vertex> entityVertexMutation = entityVertex.prepareMutation();

        VisibilityJson visibilityJson = getBcVisibility(entityVertex, workspaceId);
        Visibility visibility = visibilityTranslator.toVisibility(visibilityJson).getVisibility();

        Metadata metadata = Metadata.create();
        BcSchema.VISIBILITY_JSON_METADATA.setMetadata(metadata, visibilityJson, visibilityTranslator.getDefaultVisibility());
        BcSchema.MODIFIED_DATE_METADATA.setMetadata(metadata, ZonedDateTime.now(), visibilityTranslator.getDefaultVisibility());
        BcSchema.MODIFIED_BY_METADATA.setMetadata(metadata, user.getUserId(), visibilityTranslator.getDefaultVisibility());

        String title = imageTitle(entityVertex, workspaceId);
        ElementBuilder<Vertex> artifactVertexBuilder = convertToArtifact(file, title, visibilityJson, metadata, user, visibility);
        Vertex artifactVertex = artifactVertexBuilder.save(authorizations);
        this.graph.flush();

        entityVertexMutation.setProperty(RawObjectSchema.ENTITY_IMAGE_VERTEX_ID.getPropertyName(), Values.stringValue(artifactVertex.getId()), metadata, visibility);
        entityVertex = entityVertexMutation.save(authorizations);
        graph.flush();

        List<Edge> existingEdges = toList(entityVertex.getEdges(artifactVertex, Direction.BOTH, entityHasImageIri, authorizations));
        if (existingEdges.size() == 0) {
            EdgeBuilder edgeBuilder = graph.prepareEdge(entityVertex, artifactVertex, entityHasImageIri, visibility);
            Visibility defaultVisibility = visibilityTranslator.getDefaultVisibility();
            BcSchema.VISIBILITY_JSON.setProperty(edgeBuilder, visibilityJson, defaultVisibility);
            BcSchema.MODIFIED_DATE.setProperty(edgeBuilder, ZonedDateTime.now(), defaultVisibility);
            BcSchema.MODIFIED_BY.setProperty(edgeBuilder, user.getUserId(), defaultVisibility);
            edgeBuilder.save(authorizations);
        }

        this.workspaceRepository.updateEntityOnWorkspace(workspace, artifactVertex.getId(), user);
        this.workspaceRepository.updateEntityOnWorkspace(workspace, entityVertex.getId(), user);

        graph.flush();

        webQueueRepository.broadcastPropertyChange(artifactVertex, null, null, null);
        workQueueRepository.pushOnDwQueue(
                artifactVertex,
                null,
                null,
                null,
                null,
                Priority.HIGH,
                ElementOrPropertyStatus.UPDATE,
                null
        );
        webQueueRepository.broadcastPropertyChange(artifactVertex, null, BcSchema.RAW.getPropertyName(), workspaceId);
        workQueueRepository.pushOnDwQueue(
                artifactVertex,
                null,
                BcSchema.RAW.getPropertyName(),
                workspaceId,
                visibilityJson.getSource(),
                Priority.HIGH,
                ElementOrPropertyStatus.UPDATE,
                null
        );
        workQueueRepository.pushElementImageQueue(
                entityVertex,
                null,
                RawObjectSchema.ENTITY_IMAGE_VERTEX_ID.getPropertyName(),
                Priority.HIGH
        );
        webQueueRepository.broadcastElementImage(entityVertex);

        return (ClientApiVertex) ClientApiConverter.toClientApi(entityVertex, workspaceId, authorizations);
    }

    private String imageTitle(Vertex entityVertex, String workspaceId) {
        Property titleProperty = BcSchema.TITLE.getFirstProperty(entityVertex);
        Object title;
        if (titleProperty == null) {
            String vertexConceptType = entityVertex.getConceptType();
            Concept concept = schemaRepository.getConceptByName(vertexConceptType, workspaceId);
            title = concept.getDisplayName();
        } else {
            title = ((TextValue) titleProperty.getValue()).stringValue();
        }
        return String.format("Image of %s", title.toString());
    }

    private VisibilityJson getBcVisibility(Vertex entityVertex, String workspaceId) {
        VisibilityJson visibilityJson = BcSchema.VISIBILITY_JSON.getPropertyValue(entityVertex);
        if (visibilityJson == null) {
            visibilityJson = new VisibilityJson();
        }
        String visibilitySource = visibilityJson.getSource();
        if (visibilitySource == null) {
            visibilitySource = "";
        }
        return VisibilityJson.updateVisibilitySourceAndAddWorkspaceId(visibilityJson, visibilitySource, workspaceId);
    }

    protected ElementBuilder<Vertex> convertToArtifact(
            final Part file,
            String title,
            VisibilityJson visibilityJson,
            Metadata metadata,
            User user,
            Visibility visibility
    ) throws IOException {
        Visibility defaultVisibility = visibilityTranslator.getDefaultVisibility();
        final InputStream fileInputStream = file.getInputStream();
        final byte[] rawContent = IOUtils.toByteArray(fileInputStream);
        LOGGER.debug("Uploaded file raw content byte length: %d", rawContent.length);

        final String fileName = file.getName();

        final String fileRowKey = RowKeyHelper.buildSHA256KeyString(rawContent);
        LOGGER.debug("Generated row key: %s", fileRowKey);

        StreamingPropertyValue rawValue = new DefaultStreamingPropertyValue(new ByteArrayInputStream(rawContent), ByteArray.class);
        rawValue.searchIndex(false);

        ElementBuilder<Vertex> vertexBuilder = graph.prepareVertex(visibility, conceptIri);
        // Note that BcSchema.MIME_TYPE is expected to be set by a DataWorker.
        BcSchema.VISIBILITY_JSON.setProperty(vertexBuilder, visibilityJson, defaultVisibility);
        BcSchema.MODIFIED_BY.setProperty(vertexBuilder, user.getUserId(), defaultVisibility);
        BcSchema.MODIFIED_DATE.setProperty(vertexBuilder, ZonedDateTime.now(), defaultVisibility);
        BcSchema.TITLE.addPropertyValue(vertexBuilder, MULTI_VALUE_KEY, title, metadata, visibility);
        BcSchema.FILE_NAME.addPropertyValue(vertexBuilder, MULTI_VALUE_KEY, fileName, metadata, visibility);
        BcSchema.RAW.setProperty(vertexBuilder, rawValue, metadata, visibility);
        RawObjectSchema.PROCESS.addPropertyValue(vertexBuilder, MULTI_VALUE_KEY, PROCESS, metadata, visibility);

        ImageTransform imageTransform = ImageTransformExtractor.getImageTransform(rawContent);
        vertexBuilder.setProperty(yAxisFlippedIri, Values.booleanValue(imageTransform.isYAxisFlipNeeded()), metadata, visibility);
        vertexBuilder.setProperty(clockwiseRotationIri, Values.intValue(imageTransform.getCWRotationNeeded()), metadata, visibility);

        return vertexBuilder;
    }
}
