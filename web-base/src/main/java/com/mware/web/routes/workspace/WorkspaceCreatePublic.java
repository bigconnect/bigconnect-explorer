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
import com.mware.core.model.clientapi.dto.ClientApiWorkspace;
import com.mware.core.model.lock.LockRepository;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.user.AuthorizationContext;
import com.mware.core.model.user.UserNameAuthorizationContext;
import com.mware.core.model.user.UserRepository;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.StreamUtil;
import com.mware.ge.Authorizations;
import com.mware.web.CurrentUser;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.util.RemoteAddressUtil;

import javax.servlet.http.HttpServletRequest;

@Singleton
public class WorkspaceCreatePublic implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(WorkspaceCreatePublic.class);

    private final WorkspaceRepository workspaceRepository;
    private final WebQueueRepository webQueueRepository;
    private final AuthorizationRepository authorizationRepository;
    private final LockRepository lockRepository;
    private final UserRepository userRepository;

    @Inject
    public WorkspaceCreatePublic(
            final WorkspaceRepository workspaceRepository,
            final WebQueueRepository webQueueRepository,
            AuthorizationRepository authorizationRepository,
            LockRepository lockRepository,
            UserRepository userRepository) {
        this.workspaceRepository = workspaceRepository;
        this.webQueueRepository = webQueueRepository;
        this.authorizationRepository = authorizationRepository;
        this.lockRepository = lockRepository;
        this.userRepository = userRepository;
    }

    @Handle
    public ClientApiWorkspace handle(
            @Optional(name = "title") String title,
            @Optional(name = "userName") String userName,
            HttpServletRequest request,
            User userBase
    ) throws Exception {
        final User user = userRepository.findOrAddUser(
                userName,
                userName,
                null,
                userName
        );

        // Authenticate user
        AuthorizationContext authorizationContext = new UserNameAuthorizationContext(
                userName,
                RemoteAddressUtil.getClientIpAddr(request)
        );
        userRepository.updateUser(user, authorizationContext);
        CurrentUser.set(request, user);

        String workspaceTitle = title == null ? workspaceRepository.getDefaultWorkspaceName(user) : title;
        String lockName = user.getUserId() + "|" + workspaceTitle;

        // We need to lock because whenever the last workspace is deleted all connected clients will try to 
        // create a new workspace, and locking here is easier than coordinating client side.
        return lockRepository.lock(lockName, () -> {
            Iterable<Workspace> workspaces = workspaceRepository.findAllForUser(user);
            java.util.Optional<Workspace> found = StreamUtil.stream(workspaces).filter(w -> {
                if (w.getDisplayTitle().equals(workspaceTitle)) {
                    String creatorUserId = workspaceRepository.getCreatorUserId(w.getWorkspaceId(), user);
                    if (user.getUserId().equals(creatorUserId)) {
                        return true;
                    }
                }
                return false;
            }).findFirst();

            Workspace foundOrCreated = null;
            boolean created = false;

            if (found.isPresent()) {
                foundOrCreated = found.get();
            } else {
                created = true;
                foundOrCreated = workspaceRepository.add(workspaceTitle, user);
                LOGGER.info("Created workspace: %s, title: %s", foundOrCreated.getWorkspaceId(), foundOrCreated.getDisplayTitle());
            }

            Authorizations authorizations = authorizationRepository.getGraphAuthorizations(user);
            ClientApiWorkspace clientApi = workspaceRepository.toClientApi(foundOrCreated, user, authorizations);

            if (created) {
                webQueueRepository.broadcastWorkspace(clientApi, clientApi.getUsers(), user.getUserId(), null);
            }

            return clientApi;
        });
    }
}
