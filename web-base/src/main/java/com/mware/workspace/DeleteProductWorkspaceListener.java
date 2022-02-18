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
import com.mware.core.model.lock.LockRepository;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.model.workspace.*;
import com.mware.core.security.BcVisibility;
import com.mware.core.user.User;
import com.mware.ge.*;

public class DeleteProductWorkspaceListener extends DefaultWorkspaceListener {
    private final WorkspaceRepository workspaceRepository;
    private final WebWorkspaceRepository webWorkspaceRepository;
    private final LockRepository lockRepository;
    private final Graph graph;
    private final AuthorizationRepository authorizationRepository;

    @Inject
    public DeleteProductWorkspaceListener(
            WorkspaceRepository workspaceRepository,
            WebWorkspaceRepository webWorkspaceRepository,
            LockRepository lockRepository,
            Graph graph,
            AuthorizationRepository authorizationRepository
    ) {
        this.workspaceRepository = workspaceRepository;
        this.webWorkspaceRepository = webWorkspaceRepository;
        this.lockRepository = lockRepository;
        this.graph = graph;
        this.authorizationRepository = authorizationRepository;
    }


    @Override
    public void workspaceBeforeDelete(Workspace workspace, User user) {
        lockRepository.lock("WORKSPACE_" + workspace.getWorkspaceId(), () -> {
            Authorizations authorizations = authorizationRepository.getGraphAuthorizations(
                    user,
                    UserRepository.VISIBILITY_STRING,
                    BcVisibility.SUPER_USER_VISIBILITY_STRING,
                    workspace.getWorkspaceId()
            );

            Vertex workspaceVertex = getVertexFromWorkspace(workspace, true, authorizations);
            workspaceVertex.getVertexIds(
                    Direction.OUT,
                    WebWorkspaceSchema.WORKSPACE_TO_PRODUCT_RELATIONSHIP_NAME,
                    authorizations
            ).forEach(productId -> webWorkspaceRepository.deleteProduct(workspaceVertex.getId(), productId, user));
        });
    }

    private Vertex getVertexFromWorkspace(Workspace workspace, boolean includeHidden, Authorizations authorizations) {
        if (workspace instanceof GeWorkspace) {
            return ((GeWorkspace) workspace).getVertex(graph, includeHidden, authorizations);
        }
        return graph.getVertex(
                workspace.getWorkspaceId(),
                includeHidden ? FetchHints.ALL_INCLUDING_HIDDEN : FetchHints.ALL,
                authorizations
        );
    }
}
