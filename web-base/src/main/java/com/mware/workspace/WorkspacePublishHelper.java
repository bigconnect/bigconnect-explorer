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

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.ingest.video.VideoFrameInfo;
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.RawObjectSchema;
import com.mware.core.model.schema.*;
import com.mware.core.model.termMention.TermMentionRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.BcVisibility;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.SandboxStatusUtil;
import com.mware.ge.*;
import com.mware.ge.mutation.ElementMutation;
import com.mware.ge.mutation.ExistingElementMutation;
import com.mware.ge.util.CloseableUtils;
import com.mware.ge.util.IterableUtils;
import com.mware.ge.util.StreamUtils;
import com.mware.ge.values.storable.Values;
import com.mware.web.model.*;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static com.google.common.base.Preconditions.checkNotNull;

@Singleton
public class WorkspacePublishHelper {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(WorkspacePublishHelper.class);
    private final SchemaRepository schemaRepository;
    private final Graph graph;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final TermMentionRepository termMentionRepository;

    private String entityHasImageRelName;


    @Inject
    public WorkspacePublishHelper(
            SchemaRepository schemaRepository,
            Graph graph,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository,
            VisibilityTranslator visibilityTranslator,
            TermMentionRepository termMentionRepository
    ) {
        this.schemaRepository = schemaRepository;
        this.graph = graph;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.termMentionRepository = termMentionRepository;

        this.entityHasImageRelName = schemaRepository.getRelationshipNameByIntent(SchemaConstants.INTENT_ENTITY_HAS_IMAGE, SchemaRepository.PUBLIC);
        if (this.entityHasImageRelName == null) {
            LOGGER.warn("'entityHasImage' intent has not been defined. Please update your ontology.");
        }
    }

    public ClientApiWorkspacePublishResponse publish(
            ClientApiPublishItem[] publishData,
            User user,
            String workspaceId,
            Authorizations authorizations
    ) {
        if (this.entityHasImageRelName == null) {
            this.entityHasImageRelName = schemaRepository.getRequiredRelationshipNameByIntent("entityHasImage", workspaceId);
        }

        Map<ClientApiPublishItem.Action, List<ClientApiPublishItem>> publishDataByAction = Arrays.stream(publishData)
                .filter(ClientApiPublishItem::validate)
                .collect(Collectors.groupingBy(ClientApiPublishItem::getAction));

        List<ClientApiPublishItem> addUpdateData = publishDataByAction.get(ClientApiPublishItem.Action.ADD_OR_UPDATE);
        if (addUpdateData != null && !addUpdateData.isEmpty()) {
            publishRequiredConcepts(addUpdateData, user, workspaceId, authorizations);
            publishRequiredRelationships(addUpdateData, user, workspaceId, authorizations);
            publishRequiredPropertyTypes(addUpdateData, user, workspaceId);

            // Don't publish any data for which we couldn't also publish the required ontology
            addUpdateData = addUpdateData.stream().filter(data -> data.getErrorMessage() == null).collect(Collectors.toList());
            publishVertices(addUpdateData, workspaceId, authorizations);
            publishEdges(addUpdateData, workspaceId, authorizations);
        }

        publishProperties(publishData, workspaceId, authorizations);

        List<ClientApiPublishItem> deletionData = publishDataByAction.get(ClientApiPublishItem.Action.DELETE);
        if (deletionData != null && !deletionData.isEmpty()) {
            publishEdges(deletionData, workspaceId, authorizations);
            publishVertices(deletionData, workspaceId, authorizations);
        }

        ClientApiWorkspacePublishResponse workspacePublishResponse = new ClientApiWorkspacePublishResponse();
        for (ClientApiPublishItem data : publishData) {
            if (data.getErrorMessage() != null) {
                workspacePublishResponse.addFailure(data);
            }
        }

        return workspacePublishResponse;
    }

    private void publishVertices(List<ClientApiPublishItem> publishData, String workspaceId, Authorizations authorizations) {
        LOGGER.debug("BEGIN publishVertices");

        Map<String, ClientApiVertexPublishItem> vertexIdToPublishData = publishData.stream()
                .filter(data -> data instanceof ClientApiVertexPublishItem)
                .map(data -> ((ClientApiVertexPublishItem) data))
                .collect(Collectors.toMap(ClientApiVertexPublishItem::getVertexId, Function.identity()));

        // Need to elevate with videoFrame auth to be able to load and publish VideoFrame properties
        Authorizations authWithVideoFrame = graph.createAuthorizations(
                authorizations,
                VideoFrameInfo.VISIBILITY_STRING
        );
        Iterable<Vertex> verticesToPublish = graph.getVertices(
                vertexIdToPublishData.keySet(),
                FetchHints.ALL_INCLUDING_HIDDEN,
                authWithVideoFrame
        );

        for (Vertex vertex : verticesToPublish) {
            String vertexId = vertex.getId();
            ClientApiPublishItem data = vertexIdToPublishData.get(vertexId);
            vertexIdToPublishData.remove(vertexId); // remove to indicate that it's been handled

            try {
                if (SandboxStatusUtil.getSandboxStatus(vertex, workspaceId) == SandboxStatus.PUBLIC
                        && !WorkspaceDiffHelper.isPublicDelete(vertex, authorizations)) {
                    String msg;
                    if (data.getAction() == ClientApiPublishItem.Action.DELETE) {
                        msg = "Cannot delete public vertex " + vertexId;
                    } else {
                        msg = "Vertex " + vertexId + " is already public";
                    }
                    data.setErrorMessage(msg);
                    continue;
                }
                publishVertex(vertex, data.getAction(), authWithVideoFrame, workspaceId);
            } catch (Exception ex) {
                data.setErrorMessage(ex.getMessage());
            }
        }

        CloseableUtils.closeQuietly(verticesToPublish);

        vertexIdToPublishData.forEach((vertexId, data) ->
                data.setErrorMessage("Unable to load vertex with id " + vertexId));

        LOGGER.debug("END publishVertices");
        graph.flush();
    }

    private void publishRequiredConcepts(
            List<ClientApiPublishItem> publishData,
            User user,
            String workspaceId,
            Authorizations authorizations
    ) {
        Map<String, ClientApiVertexPublishItem> publishDataByVertexId = publishData.stream()
                .filter(data -> data instanceof ClientApiVertexPublishItem)
                .map(data -> ((ClientApiVertexPublishItem) data))
                .collect(Collectors.toMap(ClientApiVertexPublishItem::getVertexId, Function.identity()));

        Iterable<Vertex> verticesToPublish = graph.getVertices(
                publishDataByVertexId.keySet(),
                FetchHints.PROPERTIES,
                authorizations);

        Map<String, List<String>> vertexIdsByConcept = StreamUtils.stream(verticesToPublish)
                .collect(Collectors.groupingBy(Vertex::getConceptType, Collectors.mapping(Vertex::getId, Collectors.toList())));

        List<String> publishedConceptIds = vertexIdsByConcept.keySet().stream()
                .map(iri -> {
                    Concept concept = schemaRepository.getConceptByName(iri, workspaceId);
                    if (concept == null) {
                        vertexIdsByConcept.get(iri).forEach(vertexId -> {
                            ClientApiVertexPublishItem data = publishDataByVertexId.get(vertexId);
                            data.setErrorMessage("Unable to locate concept with IRI " + iri);
                        });
                    }
                    return concept;
                })
                .filter(concept -> concept != null && concept.getSandboxStatus() != SandboxStatus.PUBLIC )
                .flatMap(concept -> {
                    try {
                        return schemaRepository.getConceptAndAncestors(concept, workspaceId).stream()
                                .filter(conceptOrAncestor -> conceptOrAncestor.getSandboxStatus() != SandboxStatus.PUBLIC)
                                .map(conceptOrAncestor -> {
                                    try {
                                        schemaRepository.publishConcept(conceptOrAncestor, user, workspaceId);
                                    } catch (Exception ex) {
                                        LOGGER.error("Error publishing concept %s", concept.getName(), ex);
                                        vertexIdsByConcept.get(concept.getName()).forEach(vertexId -> {
                                            ClientApiVertexPublishItem data = publishDataByVertexId.get(vertexId);
                                            data.setErrorMessage("Unable to publish concept " + concept.getDisplayName());
                                        });
                                    }
                                    return conceptOrAncestor.getId();
                                });
                    } catch (Exception ex) {
                        LOGGER.error("Error publishing concept %s", concept.getName(), ex);
                        vertexIdsByConcept.get(concept.getName()).forEach(vertexId -> {
                            ClientApiVertexPublishItem data = publishDataByVertexId.get(vertexId);
                            data.setErrorMessage("Unable to publish concept " + concept.getDisplayName());
                        });
                    }
                    return Stream.empty();
                }).collect(Collectors.toList());

        if (!publishedConceptIds.isEmpty()) {
            schemaRepository.clearCache();
            webQueueRepository.pushOntologyConceptsChange(null, publishedConceptIds);
        }

        CloseableUtils.closeQuietly(verticesToPublish);
    }

    private void publishRequiredRelationships(
            List<ClientApiPublishItem> publishData,
            User user,
            String workspaceId,
            Authorizations authorizations
    ) {
        Map<String, ClientApiRelationshipPublishItem> publishDataByEdgeId = publishData.stream()
                .filter(data -> data instanceof ClientApiRelationshipPublishItem)
                .map(data -> ((ClientApiRelationshipPublishItem) data))
                .collect(Collectors.toMap(ClientApiRelationshipPublishItem::getEdgeId, Function.identity()));

        Iterable<Edge> edgesToPublish = graph.getEdges(
                publishDataByEdgeId.keySet(),
                FetchHints.PROPERTIES,
                authorizations);

        Map<String, List<String>> edgeIdsByLabel = StreamUtils.stream(edgesToPublish)
                .collect(Collectors.groupingBy(Edge::getLabel, Collectors.mapping(Edge::getId, Collectors.toList())));

        List<String> publishedRelationshipIds = edgeIdsByLabel.keySet().stream()
                .map(iri -> {
                    Relationship relationship = schemaRepository.getRelationshipByName(iri, workspaceId);
                    if (relationship == null) {
                        edgeIdsByLabel.get(iri).forEach(edgeId -> {
                            ClientApiRelationshipPublishItem data = publishDataByEdgeId.get(edgeId);
                            data.setErrorMessage("Unable to locate relationship with IRI " + iri);
                        });
                    }
                    return relationship;
                })
                .filter(relationship -> relationship != null && relationship.getSandboxStatus() != SandboxStatus.PUBLIC )
                .flatMap(relationship -> {
                    try {
                        return schemaRepository.getRelationshipAndAncestors(relationship, workspaceId).stream()
                                .filter(relationshipOrAncestor -> relationshipOrAncestor.getSandboxStatus() != SandboxStatus.PUBLIC)
                                .map(relationshipOrAncestor -> {
                                    try {
                                        schemaRepository.publishRelationship(relationshipOrAncestor, user, workspaceId);
                                    } catch (Exception ex) {
                                        LOGGER.error("Error publishing relationship %s", relationship.getName(), ex);
                                        edgeIdsByLabel.get(relationship.getName()).forEach(edgeId -> {
                                            ClientApiRelationshipPublishItem data = publishDataByEdgeId.get(edgeId);
                                            data.setErrorMessage("Unable to publish relationship " + relationship.getDisplayName());
                                        });
                                    }
                                    return relationshipOrAncestor.getId();
                                });
                    } catch (Exception ex) {
                        LOGGER.error("Error publishing relationship %s", relationship.getName(), ex);
                        edgeIdsByLabel.get(relationship.getName()).forEach(edgeId -> {
                            ClientApiRelationshipPublishItem data = publishDataByEdgeId.get(edgeId);
                            data.setErrorMessage("Unable to publish relationship " + relationship.getDisplayName());
                        });
                    }
                    return Stream.empty();
                }).collect(Collectors.toList());

        if (!publishedRelationshipIds.isEmpty()) {
            schemaRepository.clearCache();
            webQueueRepository.pushOntologyRelationshipsChange(null, publishedRelationshipIds);
        }

        CloseableUtils.closeQuietly(edgesToPublish);
    }

    private void publishRequiredPropertyTypes(
            List<ClientApiPublishItem> publishData,
            User user,
            String workspaceId
    ) {
        Map<String, List<ClientApiPropertyPublishItem>> publishDataByPropertyName = publishData.stream()
                .filter(data -> data instanceof ClientApiPropertyPublishItem)
                .map(data -> ((ClientApiPropertyPublishItem) data))
                .filter(data -> data.getAction() == ClientApiPublishItem.Action.ADD_OR_UPDATE)
                .collect(Collectors.groupingBy(ClientApiPropertyPublishItem::getName, Collectors.toList()));

        List<String> publishedPropertyIds = publishDataByPropertyName.keySet().stream()
                .map(propertyName -> {
                    SchemaProperty property = schemaRepository.getPropertyByName(propertyName, workspaceId);
                    if (property == null) {
                        publishDataByPropertyName.get(propertyName).forEach(data ->
                                data.setErrorMessage("Unable to locate property with IRI " + propertyName)
                        );
                    }
                    return property;
                })
                .filter(property -> property != null && property.getSandboxStatus() != SandboxStatus.PUBLIC)
                .map(property -> {
                    try {
                        schemaRepository.publishProperty(property, user, workspaceId);
                        return null;
                    } catch (Exception ex) {
                        LOGGER.error("Error publishing property %s", property.getName(), ex);
                        publishDataByPropertyName.get(property.getName()).forEach(data ->
                                data.setErrorMessage("Unable to publish relationship " + property.getDisplayName())
                        );
                    }
                    return property.getId();
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        if (!publishedPropertyIds.isEmpty()) {
            schemaRepository.clearCache();
            webQueueRepository.pushOntologyPropertiesChange(null, publishedPropertyIds);
        }
    }

    private void publishEdges(
            List<ClientApiPublishItem> publishData,
            String workspaceId,
            Authorizations authorizations
    ) {
        LOGGER.debug("BEGIN publishEdges");
        for (ClientApiPublishItem data : publishData) {
            try {
                if (!(data instanceof ClientApiRelationshipPublishItem)) {
                    continue;
                }
                ClientApiRelationshipPublishItem relationshipPublishItem = (ClientApiRelationshipPublishItem) data;
                Edge edge = graph.getEdge(
                        relationshipPublishItem.getEdgeId(),
                        FetchHints.ALL_INCLUDING_HIDDEN,
                        authorizations
                );
                Vertex outVertex = edge.getVertex(Direction.OUT, authorizations);
                Vertex inVertex = edge.getVertex(Direction.IN, authorizations);
                if (SandboxStatusUtil.getSandboxStatus(edge, workspaceId) == SandboxStatus.PUBLIC
                        && !WorkspaceDiffHelper.isPublicDelete(edge, authorizations)) {
                    String error_msg;
                    if (data.getAction() == ClientApiPublishItem.Action.DELETE) {
                        error_msg = "Cannot delete a public edge";
                    } else {
                        error_msg = "Edge is already public";
                    }
                    data.setErrorMessage(error_msg);
                    continue;
                }

                if (outVertex != null && inVertex != null
                        && SandboxStatusUtil.getSandboxStatus(outVertex, workspaceId) != SandboxStatus.PUBLIC
                        && SandboxStatusUtil.getSandboxStatus(inVertex, workspaceId) != SandboxStatus.PUBLIC) {
                    data.setErrorMessage("Cannot publish edge, " + edge.getId() + ", because either source and/or dest vertex are not public");
                    continue;
                }
                publishEdge(edge, outVertex, inVertex, data.getAction(), workspaceId, authorizations);
            } catch (Exception ex) {
                data.setErrorMessage(ex.getMessage());
            }
        }
        LOGGER.debug("END publishEdges");
        graph.flush();
    }

    private void publishProperties(
            ClientApiPublishItem[] publishData,
            String workspaceId,
            Authorizations authorizations
    ) {
        LOGGER.debug("BEGIN publishProperties");
        for (ClientApiPublishItem data : publishData) {
            try {
                if (!(data instanceof ClientApiPropertyPublishItem) || data.getErrorMessage() != null) {
                    continue;
                }
                ClientApiPropertyPublishItem propertyPublishItem = (ClientApiPropertyPublishItem) data;
                Element element = getPropertyElement(propertyPublishItem, authorizations);

                String propertyKey = propertyPublishItem.getKey();
                String propertyName = propertyPublishItem.getName();

                SchemaProperty ontologyProperty = schemaRepository.getPropertyByName(propertyName, workspaceId);
                checkNotNull(ontologyProperty, "Could not find ontology property: " + propertyName);

                //Here we skip properties that are not user visible, with some exceptions
                //TODO - If more exceptions appear we should make a nice method
                if ((!ontologyProperty.getUserVisible() && !propertyName.equals(BcSchema.COMMENT.getPropertyName()))
                        || propertyName.equals(RawObjectSchema.ENTITY_IMAGE_VERTEX_ID.getPropertyName())) {
                    data.setErrorMessage("Cannot publish a modification of a property which is not user visible: " + element.getId());
                    continue;
                }

                if (SandboxStatusUtil.getSandboxStatus(element, workspaceId) != SandboxStatus.PUBLIC) {
                    data.setErrorMessage("Cannot publish a modification of a property on a private element: " + element.getId());
                    continue;
                }

                publishProperty(element, data.getAction(), propertyKey, propertyName, workspaceId, authorizations);
            } catch (Exception ex) {
                data.setErrorMessage(ex.getMessage());
            }
        }
        LOGGER.debug("END publishProperties");
        graph.flush();
    }

    private void publishVertex(
            Vertex vertex,
            ClientApiPublishItem.Action action,
            Authorizations authorizations,
            String workspaceId
    ) {
        if (action == ClientApiPublishItem.Action.DELETE || WorkspaceDiffHelper.isPublicDelete(vertex, authorizations)) {
            long beforeDeletionTimestamp = System.currentTimeMillis() - 1;
            graph.deleteVertex(vertex, authorizations);
            graph.flush();

            webQueueRepository.broadcastPublishVertexDelete(vertex);
            webQueueRepository.broadcastPropertyChange(vertex, null, null, null);
            workQueueRepository.pushOnDwQueue(
                    vertex,
                    null,
                    null,
                    null,
                    null,
                    Priority.HIGH,
                    ElementOrPropertyStatus.DELETION,
                    beforeDeletionTimestamp
            );

            return;
        }

        LOGGER.debug("publishing vertex %s(%s)", vertex.getId(), vertex.getVisibility().toString());
        VisibilityJson visibilityJson = BcSchema.VISIBILITY_JSON.getPropertyValue(vertex);

        if (visibilityJson == null || !visibilityJson.getWorkspaces().contains(workspaceId)) {
            throw new BcException(String.format(
                    "vertex with id '%s' is not local to workspace '%s'",
                    vertex.getId(),
                    workspaceId
            ));
        }

        visibilityJson = VisibilityJson.removeFromAllWorkspace(visibilityJson);
        BcVisibility bcVisibility = visibilityTranslator.toVisibility(visibilityJson);

        ExistingElementMutation<Vertex> vertexElementMutation = vertex.prepareMutation();
        vertexElementMutation.alterElementVisibility(bcVisibility.getVisibility());

        for (Property property : vertex.getProperties()) {
            SchemaProperty ontologyProperty = schemaRepository.getPropertyByName(property.getName(), workspaceId);
            checkNotNull(ontologyProperty, "Could not find ontology property " + property.getName());
            boolean userVisible = ontologyProperty.getUserVisible();
            if (shouldAutoPublishElementProperty(property, userVisible)) {
                publishNewProperty(vertexElementMutation, property, workspaceId);
            }
        }

        BcSchema.VISIBILITY_JSON.setProperty(
                vertexElementMutation,
                visibilityJson,
                visibilityTranslator.getDefaultVisibility()
        );
        vertex = vertexElementMutation.save(authorizations);
        graph.flush();

        for (Vertex termMention : termMentionRepository.findByVertexId(vertex.getId(), authorizations)) {
            termMentionRepository.updateVisibility(termMention, bcVisibility.getVisibility(), authorizations);
        }

        graph.flush();

        webQueueRepository.broadcastPublishVertex(vertex);
    }

    private void publishProperty(
            Element element,
            ClientApiPublishItem.Action action,
            String key,
            String name,
            String workspaceId,
            Authorizations authorizations
    ) {
        long beforeActionTimestamp = System.currentTimeMillis() - 1;
        if (action == ClientApiPublishItem.Action.DELETE) {
            element.softDeleteProperty(key, name, authorizations);
            graph.flush();

            webQueueRepository.broadcastPublishPropertyDelete(element, key, name);
            if(webQueueRepository.shouldBroadcastGraphPropertyChange(name, Priority.HIGH)) {
                webQueueRepository.broadcastPropertyChange(element, key, name, null);
            }
            workQueueRepository.pushOnDwQueue(element, key, name, null, null, Priority.HIGH, ElementOrPropertyStatus.DELETION, beforeActionTimestamp);

            return;
        }
        ExistingElementMutation elementMutation = element.prepareMutation();
        List<Property> properties = IterableUtils.toList(element.getProperties(key, name));
        SandboxStatus[] sandboxStatuses = SandboxStatusUtil.getPropertySandboxStatuses(properties, workspaceId);
        boolean foundProperty = false;
        Property publicProperty = null;

        for (Property property : properties) {
            if (WorkspaceDiffHelper.isPublicDelete(property, authorizations) &&
                    WorkspaceDiffHelper.isPublicPropertyEdited(properties, sandboxStatuses, property)) {
                publicProperty = property;
                break;
            }
        }

        for (int i = 0; i < properties.size(); i++) {
            Property property = properties.get(i);
            Visibility propertyVisibility = property.getVisibility();
            SandboxStatus sandboxStatus = sandboxStatuses[i];

            if (WorkspaceDiffHelper.isPublicDelete(property, authorizations)) {
                if (publicProperty == null) {
                    element.softDeleteProperty(key, name, new Visibility(workspaceId), authorizations);
                    graph.flush();

                    webQueueRepository.broadcastPublishPropertyDelete(element, key, name);
                    if(webQueueRepository.shouldBroadcastGraphPropertyChange(name, Priority.HIGH)) {
                        webQueueRepository.broadcastPropertyChange(element, key, name, null);
                    }
                    workQueueRepository.pushOnDwQueue(element, key, name, null, null, Priority.HIGH, ElementOrPropertyStatus.DELETION, beforeActionTimestamp);

                    foundProperty = true;
                }
            } else if (sandboxStatus == SandboxStatus.PUBLIC_CHANGED) {
                element.softDeleteProperty(key, name, propertyVisibility, authorizations);

                webQueueRepository.broadcastPublishPropertyDelete(element, key, name);
                if(webQueueRepository.shouldBroadcastGraphPropertyChange(name, Priority.HIGH)) {
                    webQueueRepository.broadcastPropertyChange(element, key, name, null);
                }
                workQueueRepository.pushOnDwQueue(element, key, name, null, null, Priority.HIGH, ElementOrPropertyStatus.DELETION, beforeActionTimestamp);

                if (publicProperty != null) {
                    element.markPropertyVisible(publicProperty, new Visibility(workspaceId), authorizations);

                    Visibility publicVisibility = publicProperty.getVisibility();

                    Metadata metadata = property.getMetadata();
                    VisibilityJson visibilityJson = BcSchema.VISIBILITY_JSON_METADATA.getMetadataValue(metadata);
                    VisibilityJson.removeFromWorkspace(visibilityJson, workspaceId);
                    BcSchema.VISIBILITY_JSON_METADATA.setMetadata(
                            metadata,
                            visibilityJson,
                            visibilityTranslator.getDefaultVisibility()
                    );
                    Visibility newVisibility = visibilityTranslator.toVisibility(visibilityJson).getVisibility();

                    if (!publicVisibility.equals(newVisibility)) {
                        element.softDeleteProperty(key, name, publicVisibility, authorizations);
                    } else {
                        newVisibility = publicVisibility;
                    }
                    element.addPropertyValue(key, name, property.getValue(), metadata, newVisibility, authorizations);
                    if(webQueueRepository.shouldBroadcastGraphPropertyChange(name, Priority.HIGH)) {
                        webQueueRepository.broadcastPropertyChange(element, key, name, null);
                    }
                    workQueueRepository.pushOnDwQueue(
                            element,
                            key,
                            name,
                            null,
                            null,
                            Priority.HIGH,
                            ElementOrPropertyStatus.UNHIDDEN,
                            beforeActionTimestamp
                    );
                }
                graph.flush();
                webQueueRepository.broadcastPublishProperty(element, key, name);
                foundProperty = true;
            } else if (publishNewProperty(elementMutation, property, workspaceId)) {
                elementMutation.save(authorizations);
                graph.flush();
                webQueueRepository.broadcastPublishProperty(element, key, name);
                foundProperty = true;
            }

            if (foundProperty) {
                Iterable<Vertex> termMentions;
                if (element instanceof Vertex) {
                    termMentions = termMentionRepository.findByVertexIdAndProperty(
                            element.getId(),
                            property.getKey(),
                            property.getName(),
                            propertyVisibility,
                            authorizations
                    );
                } else {
                    termMentions = Collections.emptyList();
                }

                for (Vertex termMention : termMentions) {
                    termMentionRepository.updateVisibility(termMention, property.getVisibility(), authorizations);
                }
            }
        }
        if (!foundProperty) {
            throw new BcException(String.format(
                    "no property with key '%s' and name '%s' found on workspace '%s'",
                    key,
                    name,
                    workspaceId
            ));
        }
    }

    private boolean publishNewProperty(ExistingElementMutation elementMutation, Property property, String workspaceId) {
        VisibilityJson visibilityJson = BcSchema.VISIBILITY_JSON_METADATA.getMetadataValue(property.getMetadata());
        if (visibilityJson == null) {
            LOGGER.warn("skipping property %s. no visibility json property", property.toString());
            return false;
        }
        if (!visibilityJson.getWorkspaces().contains(workspaceId)) {
            LOGGER.warn(
                    "skipping property %s. doesn't have workspace in json or is not hidden from this workspace.",
                    property.toString()
            );
            return false;
        }

        LOGGER.debug(
                "publishing property %s:%s(%s)",
                property.getKey(),
                property.getName(),
                property.getVisibility().toString()
        );
        visibilityJson = VisibilityJson.removeFromAllWorkspace(visibilityJson);
        BcVisibility bcVisibility = visibilityTranslator.toVisibility(visibilityJson);

        elementMutation
                .alterPropertyVisibility(property, bcVisibility.getVisibility())
                .setPropertyMetadata(
                        property,
                        BcSchema.VISIBILITY_JSON.getPropertyName(),
                        Values.stringValue(visibilityJson.toString()),
                        visibilityTranslator.getDefaultVisibility()
                );

        return true;
    }

    private void publishEdge(
            Edge edge,
            @SuppressWarnings("UnusedParameters") Vertex outVertex,
            Vertex inVertex,
            ClientApiPublishItem.Action action,
            String workspaceId,
            Authorizations authorizations
    ) {
        if (action == ClientApiPublishItem.Action.DELETE || WorkspaceDiffHelper.isPublicDelete(edge, authorizations)) {
            long beforeDeletionTimestamp = System.currentTimeMillis() - 1;
            graph.softDeleteEdge(edge, authorizations);
            graph.flush();

            webQueueRepository.broadcastPublishEdgeDelete(edge);
            webQueueRepository.broadcastPropertyChange(edge, null, null, null);
            workQueueRepository.pushOnDwQueue(
                    edge,
                    null,
                    null,
                    null,
                    null,
                    Priority.HIGH,
                    ElementOrPropertyStatus.DELETION,
                    beforeDeletionTimestamp
            );
            return;
        }

        LOGGER.debug("publishing edge %s(%s)", edge.getId(), edge.getVisibility().toString());
        VisibilityJson visibilityJson = BcSchema.VISIBILITY_JSON.getPropertyValue(edge);
        if (visibilityJson == null || !visibilityJson.getWorkspaces().contains(workspaceId)) {
            throw new BcException(String.format(
                    "edge with id '%s' is not local to workspace '%s'",
                    edge.getId(),
                    workspaceId
            ));
        }

        if (edge.getLabel().equals(entityHasImageRelName)) {
            publishGlyphIconProperties(edge, workspaceId, authorizations);
        }

        edge.softDeleteProperty(
                ElementMutation.DEFAULT_KEY,
                BcSchema.VISIBILITY_JSON.getPropertyName(),
                authorizations
        );
        visibilityJson = VisibilityJson.removeFromAllWorkspace(visibilityJson);
        BcVisibility bcVisibility = visibilityTranslator.toVisibility(visibilityJson);
        ExistingElementMutation<Edge> edgeExistingElementMutation = edge.prepareMutation();
        edgeExistingElementMutation.alterElementVisibility(bcVisibility.getVisibility());

        for (Property property : edge.getProperties()) {
            boolean userVisible;
            if (BcSchema.JUSTIFICATION.getPropertyName().equals(property.getName())) {
                userVisible = false;
            } else {
                SchemaProperty schemaProperty = schemaRepository.getPropertyByName(property.getName(), SchemaRepository.PUBLIC);
                checkNotNull(
                        schemaProperty,
                        "Could not find ontology property " + property.getName() + " on property " + property
                );
                userVisible = schemaProperty.getUserVisible();
            }
            if (shouldAutoPublishElementProperty(property, userVisible)) {
                publishNewProperty(edgeExistingElementMutation, property, workspaceId);
            }
        }

        Metadata metadata = Metadata.create();
        BcSchema.VISIBILITY_JSON_METADATA.setMetadata(
                metadata,
                visibilityJson,
                visibilityTranslator.getDefaultVisibility()
        );
        BcSchema.VISIBILITY_JSON.setProperty(
                edgeExistingElementMutation,
                visibilityJson,
                visibilityTranslator.getDefaultVisibility()
        );
        edge = edgeExistingElementMutation.save(authorizations);
        graph.flush();

        for (Vertex termMention : termMentionRepository.findResolvedTo(inVertex.getId(), authorizations)) {
            termMentionRepository.updateVisibility(termMention, bcVisibility.getVisibility(), authorizations);
        }

        for (Vertex termMention : termMentionRepository.findByEdgeForEdge(edge, authorizations)) {
            termMentionRepository.updateVisibility(termMention, bcVisibility.getVisibility(), authorizations);
        }

        graph.flush();
        webQueueRepository.broadcastPublishEdge(edge);
    }

    private boolean shouldAutoPublishElementProperty(Property property, boolean userVisible) {
        if (userVisible) {
            return false;
        }

        String propertyName = property.getName();
        if (propertyName.equals(RawObjectSchema.ENTITY_IMAGE_VERTEX_ID.getPropertyName())) {
            return false;
        }

        if (propertyName.equals(BcSchema.MODIFIED_BY.getPropertyName())
                || propertyName.equals(BcSchema.MODIFIED_DATE.getPropertyName())
                || propertyName.equals(BcSchema.VISIBILITY_JSON.getPropertyName())) {
            VisibilityJson visibilityJson = BcSchema.VISIBILITY_JSON_METADATA.getMetadataValue(property.getMetadata());
            if (visibilityJson != null) {
                LOGGER.warn("Property %s should not have visibility JSON metadata set", property.toString());
                return true;
            }

            if (!property.getVisibility().equals(visibilityTranslator.getDefaultVisibility())) {
                LOGGER.warn("Property %s should have default visibility", property.toString());
                return true;
            }

            return false;
        }

        return true;
    }

    private void publishGlyphIconProperties(Edge hasImageEdge, String workspaceId, Authorizations authorizations) {
        Vertex entityVertex = hasImageEdge.getVertex(Direction.OUT, FetchHints.ALL, authorizations);
        checkNotNull(entityVertex, "Could not find has image source vertex " + hasImageEdge.getVertexId(Direction.OUT));
        ExistingElementMutation elementMutation = entityVertex.prepareMutation();
        Iterable<Property> glyphIconProperties = entityVertex.getProperties(RawObjectSchema.ENTITY_IMAGE_VERTEX_ID.getPropertyName());
        for (Property glyphIconProperty : glyphIconProperties) {
            if (publishNewProperty(elementMutation, glyphIconProperty, workspaceId)) {
                elementMutation.save(authorizations);
                return;
            }
        }
        LOGGER.warn("new has image edge without a glyph icon property being set on vertex %s", entityVertex.getId());
    }

    private Element getPropertyElement(ClientApiPropertyPublishItem data, Authorizations authorizations) {
        Element element = null;

        String elementId = data.getEdgeId();
        if (elementId != null) {
            element = graph.getEdge(elementId, FetchHints.ALL_INCLUDING_HIDDEN, authorizations);
        }

        if (element == null) {
            elementId = data.getVertexId();
            if (elementId != null) {
                element = graph.getVertex(elementId, FetchHints.ALL_INCLUDING_HIDDEN, authorizations);
            }
        }

        if (element == null) {
            elementId = data.getElementId();
            checkNotNull(elementId, "elementId, vertexId, or edgeId is required to publish a property");
            element = graph.getVertex(elementId, FetchHints.ALL_INCLUDING_HIDDEN, authorizations);
            if (element == null) {
                element = graph.getEdge(elementId, FetchHints.ALL_INCLUDING_HIDDEN, authorizations);
            }
        }

        checkNotNull(element, "Could not find edge/vertex with id: " + elementId);
        return element;
    }
}
