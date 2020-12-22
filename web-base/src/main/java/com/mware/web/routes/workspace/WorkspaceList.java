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
package com.mware.web.routes.workspace;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.clientapi.dto.ClientApiProduct;
import com.mware.core.model.clientapi.dto.ClientApiWorkspace;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.user.User;
import com.mware.ge.Authorizations;
import com.mware.ge.SecurityGeException;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.model.ClientApiWorkspaces;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.workspace.WebWorkspaceRepository;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static com.mware.ge.util.IterableUtils.toList;

@Singleton
public class WorkspaceList implements ParameterizedHandler {
    private final WorkspaceRepository workspaceRepository;
    private final WebWorkspaceRepository webWorkspaceRepository;
    private final AuthorizationRepository authorizationRepository;

    @Inject
    public WorkspaceList(
            WorkspaceRepository workspaceRepository,
            WebWorkspaceRepository webWorkspaceRepository,
            AuthorizationRepository authorizationRepository
    ) {
        this.workspaceRepository = workspaceRepository;
        this.webWorkspaceRepository = webWorkspaceRepository;
        this.authorizationRepository = authorizationRepository;
    }

    @Handle
    public ClientApiWorkspaces handle(
            @ActiveWorkspaceId(required = false) String activeWorkspaceId,
            @Optional(name = "includeProducts", defaultValue = "false") boolean includeProducts,
            User user
    ) throws Exception {
        Authorizations authorizations;

        if (hasAccess(activeWorkspaceId, user)) {
            authorizations = authorizationRepository.getGraphAuthorizations(user, activeWorkspaceId);
        } else {
            authorizations = authorizationRepository.getGraphAuthorizations(user);
        }

        List<Workspace> workspaces = toList(workspaceRepository.findAllForUser(user));

        Map<String, String> lastActiveProductIdsByWorkspaceId = null;
        if (includeProducts) {
            lastActiveProductIdsByWorkspaceId = webWorkspaceRepository.getLastActiveProductIdsByWorkspaceId(
                    workspaces.stream().map(Workspace::getWorkspaceId).collect(Collectors.toList()),
                    user
            );
        }

        ClientApiWorkspaces results = new ClientApiWorkspaces();
        for (Workspace workspace : workspaces) {
            ClientApiWorkspace workspaceClientApi = workspaceRepository.toClientApi(
                    workspace,
                    user,
                    authorizations
            );
            if (workspaceClientApi != null) {
               workspaceClientApi.setActive(workspace.getWorkspaceId().equals(user.getCurrentWorkspaceId()));
                results.addWorkspace(workspaceClientApi);
                if (includeProducts) {
                    String lastActiveProductId = lastActiveProductIdsByWorkspaceId.get(workspace.getWorkspaceId());
                    Collection<ClientApiProduct> products = webWorkspaceRepository.findAllProductsForWorkspace(workspace.getWorkspaceId(), user).stream()
                            .map(com.mware.workspace.ClientApiConverter::toClientApiProduct)
                            .peek(product -> product.active = product.id.equals(lastActiveProductId))
                            .collect(Collectors.toList());
                    workspaceClientApi.setProducts(products);
                }
            }
        }
        return results;
    }

    private boolean hasAccess(String workspaceId, User user) {
        try {
            return workspaceId != null && workspaceRepository.hasReadPermissions(workspaceId, user);
        } catch (SecurityGeException e) {
            return false;
        }
    }
}
