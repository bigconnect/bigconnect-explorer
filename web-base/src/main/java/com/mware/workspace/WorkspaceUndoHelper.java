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
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.SandboxStatusUtil;
import com.mware.ge.*;
import com.mware.ge.util.IterableUtils;
import com.mware.web.model.*;
import org.json.JSONArray;

import java.util.List;

import static com.google.common.base.Preconditions.checkNotNull;

@Singleton
public class WorkspaceUndoHelper {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(WorkspaceUndoHelper.class);

    private final Graph graph;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final WorkspaceHelper workspaceHelper;

    @Inject
    public WorkspaceUndoHelper(
            Graph graph,
            WorkspaceHelper workspaceHelper,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository
    ) {
        this.graph = graph;
        this.workspaceHelper = workspaceHelper;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
    }

    public void undo(Iterable<ClientApiUndoItem> undoItems, ClientApiWorkspaceUndoResponse workspaceUndoResponse,
                     String workspaceId, User user, Authorizations authorizations) {
        undoVertices(undoItems, workspaceUndoResponse, workspaceId, user, authorizations);
        undoEdges(undoItems, workspaceUndoResponse, workspaceId, user, authorizations);
        undoProperties(undoItems, workspaceUndoResponse, workspaceId, authorizations, user);
    }

    private void undoVertices(Iterable<ClientApiUndoItem> undoItems, ClientApiWorkspaceUndoResponse workspaceUndoResponse,
                              String workspaceId, User user, Authorizations authorizations) {
        LOGGER.debug("BEGIN undoVertices");
        JSONArray verticesDeleted = new JSONArray();
        for (ClientApiUndoItem undoItem : undoItems) {
            try {
                if (!(undoItem instanceof ClientApiVertexUndoItem)) {
                    continue;
                }
                ClientApiVertexUndoItem vertexUndoItem = (ClientApiVertexUndoItem) undoItem;
                String vertexId = vertexUndoItem.getVertexId();
                checkNotNull(vertexId);
                Vertex vertex = graph.getVertex(vertexId, FetchHints.ALL_INCLUDING_HIDDEN, authorizations);
                checkNotNull(vertex);
                if (WorkspaceDiffHelper.isPublicDelete(vertex, authorizations)) {
                    LOGGER.debug("un-hiding vertex: %s (workspaceId: %s)", vertex.getId(), workspaceId);
                    // TODO see WorkspaceHelper.deleteVertex for all the other things we need to bring back
                    graph.markVertexVisible(vertex, new Visibility(workspaceId), authorizations);

                    for (Property property : vertex.getProperties()) {
                        undoProperties(
                                property.getKey(), property.getName(), property.getVisibility().getVisibilityString(),
                                vertex, workspaceId, authorizations, user);
                    }

                    graph.flush();
                    webQueueRepository.broadcastUndoVertexDelete(vertex);
                    webQueueRepository.broadcastPropertyChange(vertex, null, null, null);
                    workQueueRepository.pushOnDwQueue(vertex, null, null, null, null, Priority.HIGH, ElementOrPropertyStatus.UNHIDDEN, null);

                } else if (SandboxStatusUtil.getSandboxStatus(vertex, workspaceId) == SandboxStatus.PUBLIC) {
                    LOGGER.warn("Cannot undo a public vertex");
                } else {
                    workspaceHelper.deleteVertex(vertex, workspaceId, false, Priority.HIGH, authorizations, user);
                    verticesDeleted.put(vertexId);
                    graph.flush();
                    webQueueRepository.broadcastUndoVertex(vertex);
                }
            } catch (Exception ex) {
                LOGGER.error("Error undoing %s", undoItem.toString(), ex);
                undoItem.setErrorMessage(ex.getMessage());
                workspaceUndoResponse.addFailure(undoItem);
            }
        }
        LOGGER.debug("END undoVertices");
        if (verticesDeleted.length() > 0) {
            webQueueRepository.broadcastVerticesDeletion(verticesDeleted);
        }
        graph.flush();
    }

    private void undoEdges(Iterable<ClientApiUndoItem> undoItems, ClientApiWorkspaceUndoResponse workspaceUndoResponse,
                           String workspaceId, User user, Authorizations authorizations) {
        LOGGER.debug("BEGIN undoEdges");
        for (ClientApiUndoItem undoItem : undoItems) {
            try {
                if (!(undoItem instanceof ClientApiRelationshipUndoItem)) {
                    continue;
                }

                ClientApiRelationshipUndoItem relationshipUndoItem = (ClientApiRelationshipUndoItem) undoItem;
                Edge edge = graph.getEdge(relationshipUndoItem.getEdgeId(), FetchHints.ALL_INCLUDING_HIDDEN, authorizations);
                if (edge == null) {
                    continue;
                }
                Vertex outVertex = edge.getVertex(Direction.OUT, authorizations);
                Vertex inVertex = edge.getVertex(Direction.IN, authorizations);
                if (outVertex == null || inVertex == null) {
                    continue;
                }

                checkNotNull(edge);

                if (WorkspaceDiffHelper.isPublicDelete(edge, authorizations)) {
                    LOGGER.debug("un-hiding edge: %s (workspaceId: %s)", edge.getId(), workspaceId);
                    // TODO see workspaceHelper.deleteEdge for all the other things we need to bring back
                    graph.markEdgeVisible(edge, new Visibility(workspaceId), authorizations);
                    graph.flush();
                    webQueueRepository.broadcastUndoEdgeDelete(edge);
                    webQueueRepository.broadcastPropertyChange(edge, null, null, null);
                    workQueueRepository.pushOnDwQueue(edge, null, null, null, null, Priority.HIGH, ElementOrPropertyStatus.UNHIDDEN, null);

                } else if (SandboxStatusUtil.getSandboxStatus(edge, workspaceId) == SandboxStatus.PUBLIC) {
                    LOGGER.warn("Cannot undo a public edge");
                } else {
                    workspaceHelper.deleteEdge(workspaceId, edge, outVertex, inVertex, false, Priority.HIGH, authorizations, user);
                    graph.flush();
                    webQueueRepository.broadcastUndoEdge(edge);
                }
            } catch (Exception ex) {
                LOGGER.error("Error publishing %s", undoItem.toString(), ex);
                undoItem.setErrorMessage(ex.getMessage());
                workspaceUndoResponse.addFailure(undoItem);
            }
        }
        LOGGER.debug("END undoEdges");
        graph.flush();
    }

    private void undoProperties(
            Iterable<ClientApiUndoItem> undoItems, ClientApiWorkspaceUndoResponse workspaceUndoResponse,
            String workspaceId, Authorizations authorizations, User user) {
        LOGGER.debug("BEGIN undoProperties");
        for (ClientApiUndoItem undoItem : undoItems) {
            try {
                if (!(undoItem instanceof ClientApiPropertyUndoItem)) {
                    continue;
                }
                ClientApiPropertyUndoItem propertyUndoItem = (ClientApiPropertyUndoItem) undoItem;
                Element element;
                if (propertyUndoItem.getEdgeId() != null) {
                    element = graph.getEdge(propertyUndoItem.getEdgeId(), FetchHints.ALL_INCLUDING_HIDDEN, authorizations);
                } else {
                    element = graph.getVertex(propertyUndoItem.getVertexId(), FetchHints.ALL_INCLUDING_HIDDEN, authorizations);
                }
                if (element == null) {
                    continue;
                }
                undoProperties(
                        propertyUndoItem.getKey(), propertyUndoItem.getName(), propertyUndoItem.getVisibilityString(),
                        element, workspaceId, authorizations, user);
            } catch (Exception ex) {
                LOGGER.error("Error publishing %s", undoItem.toString(), ex);
                undoItem.setErrorMessage(ex.getMessage());
                workspaceUndoResponse.addFailure(undoItem);
            }
        }
        LOGGER.debug("End undoProperties");
        graph.flush();
    }

    private void undoProperties(
            String propertyKey,
            String propertyName,
            String propertyVisibilityString,
            Element element,
            String workspaceId,
            Authorizations authorizations,
            User user
    ) {
        List<Property> properties = IterableUtils.toList(element.getProperties(propertyKey, propertyName));
        SandboxStatus[] sandboxStatuses = SandboxStatusUtil.getPropertySandboxStatuses(properties, workspaceId);
        Property publicProperty = null;

        for (Property property : properties) {
            if (WorkspaceDiffHelper.isPublicDelete(property, authorizations) &&
                    WorkspaceDiffHelper.isPublicPropertyEdited(properties, sandboxStatuses, property)) {
                publicProperty = property;
                break;
            }
        }

        for (int propertyIndex = 0; propertyIndex < properties.size(); propertyIndex++) {
            Property property = properties.get(propertyIndex);
            if (propertyVisibilityString != null &&
                    !property.getVisibility().getVisibilityString().equals(propertyVisibilityString)) {
                continue;
            }
            SandboxStatus propertySandboxStatus = sandboxStatuses[propertyIndex];

            if (WorkspaceDiffHelper.isPublicDelete(property, authorizations)) {
                if (publicProperty == null) {
                    LOGGER.debug("un-hiding property: %s (workspaceId: %s)", property, workspaceId);
                    element.markPropertyVisible(property, new Visibility(workspaceId), authorizations);
                    graph.flush();

                    webQueueRepository.broadcastUndoPropertyDelete(element, propertyKey, propertyName);
                    if(webQueueRepository.shouldBroadcastGraphPropertyChange(propertyName, Priority.HIGH)) {
                        webQueueRepository.broadcastPropertyChange(element, propertyKey, propertyName, null);
                    }
                    workQueueRepository.pushOnDwQueue(
                            element,
                            propertyKey,
                            propertyName,
                            null,
                            null,
                            Priority.HIGH,
                            ElementOrPropertyStatus.UNHIDDEN,
                            null
                    );
                }
            } else if (propertySandboxStatus == SandboxStatus.PUBLIC) {
                LOGGER.warn("Cannot undo a public property");
            } else if (propertySandboxStatus == SandboxStatus.PUBLIC_CHANGED) {
                long beforeActionTimestamp = System.currentTimeMillis() - 1;
                element.softDeleteProperty(propertyKey, propertyName, property.getVisibility(), authorizations);
                if (publicProperty != null) {
                    element.markPropertyVisible(publicProperty, new Visibility(workspaceId), authorizations);
                    graph.flush();

                    webQueueRepository.broadcastUndoPropertyDelete(element, propertyKey, propertyName);
                    if(webQueueRepository.shouldBroadcastGraphPropertyChange(propertyName, Priority.HIGH)) {
                        webQueueRepository.broadcastPropertyChange(element, propertyKey, propertyName, null);
                    }
                    workQueueRepository.pushOnDwQueue(element, propertyKey, propertyName, null, null, Priority.HIGH, ElementOrPropertyStatus.UNHIDDEN, null);

                } else {
                    graph.flush();

                    webQueueRepository.broadcastUndoPropertyDelete(element, propertyKey, propertyName);
                    if(webQueueRepository.shouldBroadcastGraphPropertyChange(propertyName, Priority.HIGH)) {
                        webQueueRepository.broadcastPropertyChange(element, propertyKey, propertyName, null);
                    }
                    workQueueRepository.pushOnDwQueue(element, propertyKey, propertyName, null, null, Priority.HIGH, ElementOrPropertyStatus.DELETION, beforeActionTimestamp);
                }
            } else {
                workspaceHelper.deleteProperty(element, property, false, workspaceId, Priority.HIGH, authorizations, user);
                graph.flush();
                webQueueRepository.broadcastUndoProperty(element, propertyKey, propertyName);
            }
        }
    }
}
