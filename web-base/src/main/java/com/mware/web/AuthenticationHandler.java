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
package com.mware.web;

import com.google.inject.Inject;
import com.mware.core.model.user.AuthorizationContext;
import com.mware.core.model.user.UserNameAuthorizationContext;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.web.framework.HandlerChain;
import com.mware.web.framework.RequestResponseHandler;
import com.mware.web.util.RemoteAddressUtil;
import org.keycloak.KeycloakSecurityContext;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public class AuthenticationHandler implements RequestResponseHandler {
    public static final String LOGIN_PATH = "/login";
    private UserRepository userRepository;

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, HandlerChain chain) throws Exception {
        User currentUser = CurrentUser.get(request);

        // Keycloak SSO
        if (currentUser == null) {
            KeycloakSecurityContext sc =
                    ((KeycloakSecurityContext)request.getAttribute(KeycloakSecurityContext.class.getName()));
            if (sc != null) {
                String username = sc.getIdToken().getPreferredUsername();

                // User was authenticated in Keycloak
                if (username != null) {
                    // Register user automatically
                    User user = userRepository.findByUsername(username);
                    if (user == null) {
                        String randomPassword = UserRepository.createRandomPassword();
                        user = userRepository.findOrAddUser(
                                username,
                                username,
                                null,
                                randomPassword
                        );
                    }

                    // Authenticate user
                    AuthorizationContext authorizationContext = new UserNameAuthorizationContext(
                            username,
                            RemoteAddressUtil.getClientIpAddr(request)
                    );
                    userRepository.updateUser(user, authorizationContext);
                    CurrentUser.set(request, user);
                    currentUser = CurrentUser.get(request);
                }
            }
        }

        if (currentUser != null) {
            chain.next(request, response);
        } else {
            response.sendError(HttpServletResponse.SC_FORBIDDEN);
        }
    }

    @Inject
    public void setUserRepository(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * @Deprecated
     *
     * Use RemoteAddressUtil.getClientIpAddr for future calls to get client IP addresses.
     */
    @Deprecated
    public static String getRemoteAddr(HttpServletRequest request) {
        return RemoteAddressUtil.getClientIpAddr(request);
    }
}
