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

import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.clientapi.dto.ClientApiObject;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.graph.GraphUpdateContext;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.termMention.TermMentionRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.security.AuditEventType;
import com.mware.core.security.AuditService;
import com.mware.core.user.User;
import com.mware.ge.*;
import com.mware.ge.values.storable.DefaultStreamingPropertyValue;
import com.mware.ge.values.storable.StreamingPropertyValue;
import com.mware.ge.values.storable.Value;
import com.mware.security.ACLProvider;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;

import javax.inject.Inject;
import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

@Singleton
public class EditTextEntity implements ParameterizedHandler {
    private final Graph graph;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final TermMentionRepository termMentionRepository;
    private final GraphRepository graphRepository;
    private final ACLProvider aclProvider;
    private final AuditService auditService;

    @Inject
    public EditTextEntity(
            Graph graph,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository,
            TermMentionRepository termMentionRepository,
            GraphRepository graphRepository,
            ACLProvider aclProvider,
            AuditService auditService
    ) {
        this.graph = graph;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
        this.termMentionRepository = termMentionRepository;
        this.graphRepository = graphRepository;
        this.aclProvider = aclProvider;
        this.auditService = auditService;
    }

    @Handle
    public ClientApiObject handle(
            @Required(name = "graphVertexId") String graphVertexId,
            @Required(name = "propertyKey") String propertyKey,
            @Required(name = "propertyName") String propertyName,
            @Required(name = "value") String valueStr,
            @ActiveWorkspaceId(required = false) String workspaceId,
            Authorizations authorizations,
            User user
    ) {
        Vertex vertex = graph.getVertex(graphVertexId, authorizations);
        aclProvider.checkCanAddOrUpdateProperty(vertex, propertyKey, propertyName, user, workspaceId);

        StreamingPropertyValue finalText = StreamingPropertyValue.create(valueStr);

        Property rawProperty = BcSchema.RAW.getProperty(vertex);
        if (rawProperty != null) {
            StreamingPropertyValue raw = (StreamingPropertyValue) rawProperty.getValue();
            if (raw != null) {
                ByteArrayInputStream bis = new ByteArrayInputStream(valueStr.getBytes());
                StreamingPropertyValue newRaw = new DefaultStreamingPropertyValue(bis, raw.getValueType());
                BcSchema.RAW.setProperty(vertex, newRaw, rawProperty.getMetadata(), rawProperty.getVisibility(), authorizations);
            }
        }

        Property textProperty = BcSchema.TEXT.getProperty(vertex, propertyKey);
        BcSchema.TEXT.addPropertyValue(
                vertex,
                propertyKey,
                finalText,
                Metadata.create(textProperty.getMetadata()),
                textProperty.getVisibility(),
                authorizations
        );

        Iterable<Vertex> termMentions = termMentionRepository.findByOutVertex(vertex.getId(), authorizations);
        Iterator<Vertex> termMentionsIterator = termMentions.iterator();

        List<Vertex> termMentionsList = new ArrayList<>();
        while (termMentionsIterator.hasNext()) {
            termMentionsList.add(termMentionsIterator.next());
        }

        for (Vertex termMention : termMentionsList) {
            termMentionRepository.delete(termMention, authorizations);
        }

        graph.flush();
        auditService.auditGenericEvent(user, workspaceId, AuditEventType.SET_PROPERTY, BcSchema.TEXT.getPropertyName(), "");

        webQueueRepository.pushTextUpdated(graphVertexId, Priority.HIGH);
        workQueueRepository.pushGraphPropertyQueue(
                vertex,
                propertyKey,
                propertyName,
                workspaceId,
                null,
                Priority.HIGH,
                ElementOrPropertyStatus.UPDATE,
                null
        );

        return new ClientApiSuccess();
    }
}
