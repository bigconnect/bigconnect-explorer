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
package com.mware.web.routes.ping;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.longRunningProcess.LongRunningProcessRepository;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.ping.PingUtil;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Vertex;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.ContentType;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.parameterProviders.RemoteAddr;

@Singleton
public class Ping implements ParameterizedHandler {
    private final Graph graph;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final LongRunningProcessRepository longRunningProcessRepository;
    private final Authorizations authorizations;
    private final PingUtil pingUtil;

    @Inject
    public Ping(
            UserRepository userRepository,
            Graph graph,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository,
            LongRunningProcessRepository longRunningProcessRepository,
            PingUtil pingUtil,
            AuthorizationRepository authorizationRepository
    ) {
        this.graph = graph;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
        this.longRunningProcessRepository = longRunningProcessRepository;
        this.pingUtil = pingUtil;
        this.authorizations = authorizationRepository.getGraphAuthorizations(userRepository.getSystemUser());
    }

    @Handle
    @ContentType("text/plain")
    public PingResponse ping(@RemoteAddr String remoteAddr) {
        // test search
        long startTime = System.currentTimeMillis();
        String vertexId = pingUtil.search(graph, authorizations);
        long searchTime = System.currentTimeMillis() - startTime;

        // test retrieval
        startTime = System.currentTimeMillis();
        pingUtil.retrieve(vertexId, graph, authorizations);
        long retrievalTime = System.currentTimeMillis() - startTime;

        // test save
        startTime = System.currentTimeMillis();
        Vertex pingVertex = pingUtil.createVertex(remoteAddr, searchTime, retrievalTime, graph, authorizations);
        long saveTime = System.currentTimeMillis() - startTime;

        // test queues (and asynchronously test GPW and LRP)
        startTime = System.currentTimeMillis();
        pingUtil.enqueueToWorkQueue(pingVertex, workQueueRepository, webQueueRepository, Priority.HIGH);
        pingUtil.enqueueToLongRunningProcess(pingVertex, longRunningProcessRepository, authorizations);
        long enqueueTime = System.currentTimeMillis() - startTime;

        return new PingResponse(searchTime, retrievalTime, saveTime, enqueueTime);
    }
}
