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
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Property;
import com.mware.ge.Vertex;
import com.mware.ge.query.Compare;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import org.apache.commons.lang.StringUtils;

public class MultiVertexRequeue implements ParameterizedHandler {
    private final Graph graph;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;

    @Inject
    public MultiVertexRequeue(
            Graph graph,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository
    ) {
        this.graph = graph;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            @Optional(name = "concept") String conceptType,
            @Optional(name = "property") String propertyName,
            @Optional(name = "priority", defaultValue = "LOW") String requeuePriority,
            Authorizations authorizations,
            @ActiveWorkspaceId String workspaceId
    ) throws Exception {
        Iterable<Vertex> vertices;

        if (!StringUtils.isEmpty(conceptType)) {
            vertices = graph.query(authorizations).hasConceptType(conceptType).vertices();
        } else {
            vertices = graph.getVertices(authorizations);
        }

        Priority priority = Priority.safeParse(requeuePriority);

        vertices.forEach(v -> {
            if (StringUtils.isEmpty(propertyName)) {
                webQueueRepository.broadcastPropertyChange(v, null, null, workspaceId);
                workQueueRepository.pushOnDwQueue(
                        v,
                        null,
                        null,
                        workspaceId,
                        null,
                        priority,
                        ElementOrPropertyStatus.UPDATE,
                        null
                );
            } else {
                Iterable<Property> properties = v.getProperties(propertyName);
                for (Property property : properties) {
                    webQueueRepository.broadcastPropertyChange(v, property.getKey(), property.getName(), workspaceId);
                    workQueueRepository.pushOnDwQueue(
                            v,
                            property.getKey(),
                            property.getName(),
                            workspaceId,
                            null,
                            priority,
                            ElementOrPropertyStatus.UPDATE,
                            null
                    );
                }
            }
        });

        return BcResponse.SUCCESS;
    }
}
