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
import com.mware.core.model.clientapi.dto.ClientApiUsers;
import com.mware.core.model.user.UserRepository;
import com.mware.core.model.user.UserSessionCounterRepository;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.model.workspace.WorkspaceUser;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.util.ConvertingIterable;
import com.mware.ge.util.FilterIterable;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.google.common.base.Preconditions.checkArgument;
import static com.mware.ge.util.IterableUtils.toList;

@Singleton
public class UserList implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(UserList.class);

    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final UserSessionCounterRepository userSessionCounterRepository;

    @Inject
    public UserList(
            final UserRepository userRepository,
            final WorkspaceRepository workspaceRepository,
            UserSessionCounterRepository userSessionCounterRepository
    ) {
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
        this.userSessionCounterRepository = userSessionCounterRepository;
    }

    @Handle
    public ClientApiUsers handle(
            User user,
            @Optional(name = "q") String query,
            @Optional(name = "workspaceId") String workspaceId,
            @Optional(name = "userIds[]") String[] userIds,
            @Optional(name = "online") Boolean online,
            @Optional(name = "skip", defaultValue = "0") int skip,
            @Optional(name = "limit", defaultValue = "100") int limit
    ) throws Exception {
        List<User> users;
        if (userIds != null) {
            checkArgument(query == null, "Cannot use userIds[] and q at the same time");
            checkArgument(workspaceId == null, "Cannot use userIds[] and workspaceId at the same time");
            users = new ArrayList<>();
            for (String userId : userIds) {
                User u = userRepository.findById(userId);
                if (u == null) {
                    LOGGER.error("User " + userId + " not found");
                    continue;
                }
                users.add(u);
            }
        } else if (online != null && online) {
            users = toList(userRepository.find(skip, limit));
            users.removeIf(u -> userSessionCounterRepository.getSessionCount(u.getUserId()) < 1);
        } else {
            users = toList(userRepository.find(query));

            if (workspaceId != null) {
                users = toList(getUsersWithWorkspaceAccess(workspaceId, users, user));
            }
        }

        Iterable<String> workspaceIds = getCurrentWorkspaceIds(users);
        Map<String, String> workspaceNames = getWorkspaceNames(workspaceIds, user);

        return userRepository.toClientApi(users, workspaceNames);
    }

    private Map<String, String> getWorkspaceNames(Iterable<String> workspaceIds, User user) {
        Map<String, String> result = new HashMap<>();
        for (Workspace workspace : workspaceRepository.findByIds(workspaceIds, user)) {
            if (workspace != null) {
                result.put(workspace.getWorkspaceId(), workspace.getDisplayTitle());
            }
        }
        return result;
    }

    private Iterable<String> getCurrentWorkspaceIds(Iterable<User> users) {
        return new ConvertingIterable<User, String>(users) {
            @Override
            protected String convert(User user) {
                return user.getCurrentWorkspaceId();
            }
        };
    }

    private Iterable<User> getUsersWithWorkspaceAccess(String workspaceId, final Iterable<User> users, User user) {
        final List<WorkspaceUser> usersWithAccess = workspaceRepository.findUsersWithAccess(workspaceId, user);
        return new FilterIterable<User>(users) {
            @Override
            protected boolean isIncluded(User u) {
                return contains(usersWithAccess, u);
            }

            private boolean contains(List<WorkspaceUser> usersWithAccess, User u) {
                for (WorkspaceUser userWithAccess : usersWithAccess) {
                    if (userWithAccess.getUserId().equals(u.getUserId())) {
                        return true;
                    }
                }
                return false;
            }
        };
    }
}
