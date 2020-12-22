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
package com.mware.web.routes.user;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.clientapi.dto.ClientApiUser;
import com.mware.core.model.user.UserRepository;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.handlers.CSRFHandler;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Singleton
public class MeGet implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(MeGet.class);
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;

    @Inject
    public MeGet(
            final UserRepository userRepository,
            final WorkspaceRepository workspaceRepository
    ) {
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
    }

    @Handle
    public ClientApiUser handle(
            HttpServletRequest request,
            HttpServletResponse response,
            User user
    ) throws Exception {
        ClientApiUser userMe = userRepository.toClientApiPrivate(user);
        userMe.setCsrfToken(CSRFHandler.getSavedToken(request, response, true));

        try {
            if (userMe.getCurrentWorkspaceId() != null && userMe.getCurrentWorkspaceId().length() > 0) {
                if (!workspaceRepository.hasReadPermissions(userMe.getCurrentWorkspaceId(), user)) {
                    userMe.setCurrentWorkspaceId(null);
                }
            }
        } catch (Exception ex) {
            LOGGER.error("Failed to read user's current workspace %s", user.getCurrentWorkspaceId(), ex);
            userMe.setCurrentWorkspaceId(null);
        }

        if (userMe.getCurrentWorkspaceId() == null) {
            Iterable<Workspace> allWorkspaces = workspaceRepository.findAllForUser(user);
            Workspace workspace = null;
            if (allWorkspaces != null) {
                Map<Boolean, List<Workspace>> userWorkspaces = StreamSupport.stream(allWorkspaces.spliterator(), false)
                        .sorted(Comparator.comparing(w -> w.getDisplayTitle().toLowerCase()))
                        .collect(Collectors.partitioningBy(userWorkspace ->
                                workspaceRepository.getCreatorUserId(userWorkspace.getWorkspaceId(), user).equals(user.getUserId())));

                List<Workspace> workspaces = userWorkspaces.get(true).isEmpty() ? userWorkspaces.get(false) : userWorkspaces.get(true);
                if (!workspaces.isEmpty()) {
                    workspace = workspaces.get(0);
                }
            }

            if (workspace == null) {
                workspace = workspaceRepository.add(user);
            }

            userRepository.setCurrentWorkspace(user.getUserId(), workspace.getWorkspaceId());
            userMe.setCurrentWorkspaceId(workspace.getWorkspaceId());
            userMe.setCurrentWorkspaceName(workspace.getDisplayTitle());
        }

        return userMe;
    }
}
