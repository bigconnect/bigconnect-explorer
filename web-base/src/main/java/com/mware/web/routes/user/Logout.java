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
import com.mware.core.security.AuditService;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.web.BcResponse;
import com.mware.web.CurrentUser;
import com.mware.web.auth.AuthTokenHttpResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.model.ClientApiSuccess;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@Singleton
public class Logout implements ParameterizedHandler {
    private BcLogger LOGGER = BcLoggerFactory.getLogger(Logout.class);

    private final AuditService auditService;

    @Inject
    public Logout(AuditService auditService) {

        this.auditService = auditService;
    }

    @Handle
    public ClientApiSuccess handle(HttpServletRequest request, HttpServletResponse response) throws Exception {
        User user = CurrentUser.get(request);
        if (user != null) {
            auditService.auditLogout(user.getUserId());
            CurrentUser.set(request, null);
            request.logout();
            if (response instanceof AuthTokenHttpResponse) {
                AuthTokenHttpResponse authResponse = (AuthTokenHttpResponse) response;
                authResponse.invalidateAuthentication();
            } else {
                LOGGER.error("Logout called but response is not an instance of %s. User may not actually be logged out.", AuthTokenHttpResponse.class.getName());
            }
        }

        return BcResponse.SUCCESS;
    }
}
