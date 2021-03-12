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
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.termMention.TermMentionRepository;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.SandboxStatusUtil;
import com.mware.ge.*;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.workspace.WorkspaceHelper;

import static com.mware.ge.util.IterableUtils.singleOrDefault;

@Singleton
public class UnresolveTermEntity implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(UnresolveTermEntity.class);
    private final TermMentionRepository termMentionRepository;
    private final Graph graph;
    private final WorkspaceHelper workspaceHelper;

    @Inject
    public UnresolveTermEntity(
            final TermMentionRepository termMentionRepository,
            final Graph graph,
            final WorkspaceHelper workspaceHelper
    ) {
        this.termMentionRepository = termMentionRepository;
        this.graph = graph;
        this.workspaceHelper = workspaceHelper;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "termMentionId") String termMentionId,
            @ActiveWorkspaceId String workspaceId,
            Authorizations authorizations
    ) throws Exception {
        LOGGER.debug("UnresolveTermEntity (termMentionId: %s)", termMentionId);

        Vertex termMention = termMentionRepository.findById(termMentionId, authorizations);
        if (termMention == null) {
            throw new BcResourceNotFoundException("Could not find term mention with id: " + termMentionId);
        }

        Authorizations authorizationsWithTermMention = termMentionRepository.getAuthorizations(authorizations);
        Vertex resolvedVertex = singleOrDefault(termMention.getVertices(Direction.OUT, BcSchema.TERM_MENTION_LABEL_RESOLVED_TO, authorizationsWithTermMention), null);
        if (resolvedVertex == null) {
            throw new BcResourceNotFoundException("Could not find resolved vertex from term mention: " + termMentionId);
        }

        String edgeId = BcSchema.TERM_MENTION_RESOLVED_EDGE_ID.getPropertyValue(termMention);
        Edge edge = graph.getEdge(edgeId, authorizations);
        if (edge == null) {
            throw new BcResourceNotFoundException("Could not find edge " + edgeId + " from term mention: " + termMentionId);
        }

        SandboxStatus vertexSandboxStatus = SandboxStatusUtil.getSandboxStatus(resolvedVertex, workspaceId);

        VisibilityJson visibilityJson;
        if (vertexSandboxStatus == SandboxStatus.PUBLIC) {
            visibilityJson = BcSchema.VISIBILITY_JSON.getPropertyValue(edge);
            VisibilityJson.removeFromWorkspace(visibilityJson, workspaceId);
        } else {
            visibilityJson = BcSchema.VISIBILITY_JSON.getPropertyValue(resolvedVertex);
            VisibilityJson.removeFromWorkspace(visibilityJson, workspaceId);
        }

        workspaceHelper.unresolveTerm(termMention, authorizations);
        return BcResponse.SUCCESS;
    }
}
