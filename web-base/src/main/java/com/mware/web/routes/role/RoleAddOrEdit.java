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
package com.mware.web.routes.role;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.Privilege;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.role.Role;
import com.mware.core.model.user.PrivilegeRepository;
import com.mware.core.user.User;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;

import java.util.Set;
import java.util.stream.Collectors;

@Singleton
public class RoleAddOrEdit implements ParameterizedHandler {
    private final AuthorizationRepository authorizationRepository;
    private final PrivilegeRepository privilegeRepository;

    @Inject
    public RoleAddOrEdit(
            AuthorizationRepository authorizationRepository,
            PrivilegeRepository privilegeRepository
    ) {
        this.authorizationRepository = authorizationRepository;
        this.privilegeRepository = privilegeRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            User authUser,
            @Optional(name = "id") String roleId,
            @Required(name = "roleName") String roleName,
            @Required(name = "description") String description,
            @Required(name = "global") String global,
            @Optional(name = "privileges") String privileges,
            @Required(name = "mode") String mode
    ) throws Exception {
        Set<Privilege> privs = Privilege.stringToPrivileges(privileges).stream()
                .map(name -> new Privilege(name))
                .collect(Collectors.toSet());

        if("create".equals(mode)) {
            if (authorizationRepository.findByName(roleName) != null) {
                throw new BcException("Role " + roleName + " already exists");
            }

            authorizationRepository.addRole(roleName, description, Boolean.valueOf(global), privs);
        } else if("edit".equals(mode)) {
            Role role = authorizationRepository.findById(roleId);
            if(role != null) {
                authorizationRepository.setRoleName(role, roleName);
                authorizationRepository.setGlobal(role, Boolean.valueOf(global));
                authorizationRepository.setPrivileges(role, privs);
            } else
                throw new BcException("Role with id="+roleId+" was not found");

        } else
            throw new BcException("The provided mode is not valid");

        return BcResponse.SUCCESS;
    }
}
