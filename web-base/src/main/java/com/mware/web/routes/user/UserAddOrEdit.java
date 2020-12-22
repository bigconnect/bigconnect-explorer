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
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.Privilege;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.role.Role;
import com.mware.core.model.user.PrivilegeRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.user.User;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;
import org.apache.commons.lang3.StringUtils;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Singleton
public class UserAddOrEdit implements ParameterizedHandler {
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final AuthorizationRepository authorizationRepository;
    private final PrivilegeRepository privilegeRepository;

    @Inject
    public UserAddOrEdit(
            UserRepository userRepository,
            WorkspaceRepository workspaceRepository,
            AuthorizationRepository authorizationRepository,
            PrivilegeRepository privilegeRepository
    ) {
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
        this.authorizationRepository = authorizationRepository;
        this.privilegeRepository = privilegeRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            User authUser,
            @Optional(name = "id") String userId,
            @Required(name = "userName") String userName,
            @Required(name = "displayName") String displayName,
            @Required(name = "email") String email,
            @Optional(name = "password") String password,
            @Optional(name = "privileges") String privileges,
            @Optional(name = "roles") String roles,
            @Required(name = "mode") String mode
    ) throws Exception {
        User user = null;

        if("create".equals(mode)) {
            if (userRepository.findByUsername(userName) != null) {
                throw new BcException("User " + userName + " already exists");
            }
            user = userRepository.addUser(userName, displayName, email, password);
            privilegeRepository.setPrivileges(user, Privilege.stringToPrivileges(privileges), authUser);
        } else if("edit".equals(mode)) {
            user = userRepository.findById(userId);
            if(user != null) {
                userRepository.setDisplayName(user, displayName);
                userRepository.setEmailAddress(user, email);
                if(!StringUtils.isEmpty(password)) {
                    userRepository.setPassword(user, password);
                }
                privilegeRepository.setPrivileges(user, Privilege.stringToPrivileges(privileges), authUser);
            } else
                throw new BcException("user not found");
        } else
            throw new BcException("mode not specified");

        if(!StringUtils.isEmpty(roles)) {
            String[] rolesArray = StringUtils.split(roles, ',');
            Set<Role> roleSet = Arrays.stream(rolesArray)
                    .map(roleName -> authorizationRepository.findByName(roleName))
                    .collect(Collectors.toSet());
            authorizationRepository.setRolesForUser(user, roleSet, authUser);
        } else {
            authorizationRepository.setRolesForUser(user, new HashSet<>(), authUser);
        }


        return BcResponse.SUCCESS;
    }
}
