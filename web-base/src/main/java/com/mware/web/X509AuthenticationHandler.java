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

import com.mware.core.exception.BcException;
import com.mware.core.model.user.UserNameAuthorizationContext;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.Graph;
import com.mware.web.framework.HandlerChain;

import javax.naming.InvalidNameException;
import javax.naming.ldap.LdapName;
import javax.naming.ldap.Rdn;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.security.cert.CertificateExpiredException;
import java.security.cert.CertificateNotYetValidException;
import java.security.cert.X509Certificate;
import java.util.List;

public class X509AuthenticationHandler extends AuthenticationHandler {
    public static final String CERTIFICATE_REQUEST_ATTRIBUTE = "javax.servlet.request.X509Certificate";

    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(X509AuthenticationHandler.class);
    private final UserRepository userRepository;
    private final Graph graph;

    protected X509AuthenticationHandler(UserRepository userRepository, final Graph graph) {
        this.userRepository = userRepository;
        this.graph = graph;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, HandlerChain chain) throws Exception {
        String userId = CurrentUser.get(request).getUserId();
        if (userId == null) {
            X509Certificate cert = extractCertificate(request);
            if (isInvalid(cert)) {
                respondWithAuthenticationFailure(response);
                return;
            }

            User user = getUser(request, cert);
            if (user == null) {
                respondWithAuthenticationFailure(response);
                return;
            }

            userRepository.updateUser(user, new UserNameAuthorizationContext(
                    user.getUsername(),
                    getRemoteAddr(request)
            ));
            CurrentUser.set(request, user);
        }
        chain.next(request, response);
    }

    protected User getUser(HttpServletRequest request, X509Certificate cert) {
        String username = getUsername(cert);
        if (username == null || username.trim().equals("")) {
            return null;
        }
        String displayName = getDisplayName(cert);
        if (displayName == null || displayName.trim().equals("")) {
            return null;
        }
        String randomPassword = UserRepository.createRandomPassword();
        return userRepository.findOrAddUser(username, displayName, null, randomPassword);
    }

    protected boolean isInvalid(X509Certificate cert) {
        if (cert == null) {
            return true;
        }

        try {
            cert.checkValidity();
            return false;
        } catch (CertificateExpiredException e) {
            LOGGER.warn("Authentication attempt with expired certificate: %s", cert.getSubjectDN());
        } catch (CertificateNotYetValidException e) {
            LOGGER.warn("Authentication attempt with certificate that's not yet valid: %s", cert.getSubjectDN());
        }

        return true;
    }

    protected X509Certificate extractCertificate(HttpServletRequest request) {
        X509Certificate[] certs = (X509Certificate[]) request.getAttribute(CERTIFICATE_REQUEST_ATTRIBUTE);
        if (null != certs && certs.length > 0) {
            return certs[0];
        }
        return null;
    }

    protected String getUsername(X509Certificate cert) {
        String dn = getDn(cert);
        if (dn != null) {
            return dn;
        } else {
            throw new BcException("failed to get DN from cert for username");
        }
    }

    protected String getDisplayName(X509Certificate cert) {
        String cn = getCn(cert);
        if (cn != null) {
            return cn;
        } else {
            throw new BcException("failed to get CN from cert for displayName");
        }
    }

    private String getDn(X509Certificate cert) {
        String dn = cert.getSubjectX500Principal().getName();
        LOGGER.debug("certificate DN is [%s]", dn);
        return dn;
    }

    private String getCn(X509Certificate cert) {
        String dn = getDn(cert);
        try {
            List<Rdn> rdns = new LdapName(dn).getRdns();
            for (int i = rdns.size() - 1; i >= 0; i--) {
                Rdn rdn = rdns.get(i);
                if (rdn.getType().equalsIgnoreCase("CN")) {
                    String cn = rdn.getValue().toString();
                    LOGGER.debug("certificate CN is [%s]", cn);
                    return cn;
                }
            }
        } catch (InvalidNameException ine) {
            return null;
        }
        return null;
    }

    protected void respondWithAuthenticationFailure(HttpServletResponse response) throws IOException {
        response.sendError(HttpServletResponse.SC_FORBIDDEN);
    }

    protected UserRepository getUserRepository() {
        return userRepository;
    }

    protected Graph getGraph() {
        return graph;
    }
}
