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
package com.mware.web.auth.usernamepassword.routes;

import com.google.common.collect.ImmutableSet;
import com.google.inject.Inject;
import com.mware.core.exception.BcAccessDeniedException;
import com.mware.core.model.clientapi.dto.Privilege;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.role.Role;
import com.mware.core.model.user.UserNameAuthorizationContext;
import com.mware.core.model.user.UserPropertyPrivilegeRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.security.AuditService;
import com.mware.core.user.SystemUser;
import com.mware.core.user.User;
import com.mware.security.ldap.LDAPAuthenticator;
import com.mware.web.CurrentUser;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.util.RemoteAddressUtil;
import org.json.JSONObject;

import javax.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.Set;

public class Login implements ParameterizedHandler {
    private final UserRepository userRepository;
    private final AuditService auditService;
    private LDAPAuthenticator ldapAuthenticator;
    private AuthorizationRepository authorizationRepository;
    private final UserPropertyPrivilegeRepository privilegeRepository;

    @Inject
    public Login(UserRepository userRepository, AuditService auditService, LDAPAuthenticator ldapAuthenticator, AuthorizationRepository authorizationRepository, UserPropertyPrivilegeRepository privilegeRepository) {
        this.userRepository = userRepository;
        this.auditService = auditService;
        this.ldapAuthenticator = ldapAuthenticator;
        this.authorizationRepository = authorizationRepository;
        this.privilegeRepository = privilegeRepository;
    }

    @Handle
    public JSONObject handle(
            HttpServletRequest request,
            @Required(name = "username") String username,
            @Required(name = "password") String password
    ) {
        username = username.trim();
        password = password.trim();

        User user = userRepository.findByUsername(username);

        if(ldapAuthenticator.isLdapEnabled()) {
            if(ldapAuthenticator.isPasswordValid(username, password)) {
                if(user == null) {
                    user = userRepository.findOrAddUser(
                            username,
                            username,
                            null,
                            password
                    );
                }
                addRolesFromLdapGroups(user, ldapAuthenticator.getGroupMemberships(username));
                if (ldapAuthenticator.hasAdminFlag(username)) {
                    String[] adminPrivileges = new String[] {
                            Privilege.READ, Privilege.COMMENT, Privilege.EDIT, Privilege.PUBLISH, Privilege.SEARCH_SAVE_GLOBAL, Privilege.HISTORY_READ,
                            Privilege.ADMIN, Privilege.ONTOLOGY_ADD, Privilege.ONTOLOGY_PUBLISH
                    };
                    privilegeRepository.setPrivileges(user, ImmutableSet.copyOf(adminPrivileges), new SystemUser());
                }
                return loginUser(user, username, request);
            } else {
                throw new BcAccessDeniedException("", user, null);
            }
        } else {
            if (user != null && userRepository.isPasswordValid(user, password)) {
                return loginUser(user, username, request);
            } else {
                throw new BcAccessDeniedException("", user, null);
            }
        }
    }

    private void addRolesFromLdapGroups(User user, Set<String> groupMemberships) {
        Set<String> existingRoles = authorizationRepository.getRoleNames(user);
        for(String group : groupMemberships) {
            if(!existingRoles.contains(group)) {
                authorizationRepository.addRoleToUser(user, group, new SystemUser());
            }
        }
    }

    private JSONObject loginUser(User user, String username, HttpServletRequest request) {
        UserNameAuthorizationContext authorizationContext = new UserNameAuthorizationContext(
                username,
                RemoteAddressUtil.getClientIpAddr(request)
        );
        userRepository.updateUser(user, authorizationContext);
        CurrentUser.set(request, user);
        auditService.auditLogin(user);
        JSONObject json = new JSONObject();
        json.put("status", "OK");
        return json;
    }
}
