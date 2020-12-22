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
package com.mware.web.auth;

import com.mware.core.model.user.GeUser;
import com.mware.core.security.AuthToken;
import com.mware.core.security.AuthTokenException;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.values.storable.Values;
import com.mware.web.CurrentUser;

import javax.crypto.SecretKey;
import javax.servlet.ServletOutputStream;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpServletResponseWrapper;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Date;

public class AuthTokenHttpResponse extends HttpServletResponseWrapper {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(AuthTokenHttpResponse.class);
    private static final String EXPIRATION_HEADER_NAME = "BC-Auth-Token-Expiration";

    private final SecretKey macKey;
    private final HttpServletRequest request;
    private final long tokenValidityDurationInMinutes;
    private final AuthToken token;
    private boolean tokenCookieWritten = false;
    private boolean tokenHeaderWritten = false;

    public AuthTokenHttpResponse(AuthToken token, HttpServletRequest request, HttpServletResponse response, SecretKey macKey, long tokenValidityDurationInMinutes) {
        super(response);
        this.token = token;
        this.request = request;
        this.macKey = macKey;
        this.tokenValidityDurationInMinutes = tokenValidityDurationInMinutes;
    }

    @Override
    public ServletOutputStream getOutputStream() throws IOException {
        updateAuthToken();
        updateExpirationHeader();
        return super.getOutputStream();
    }

    @Override
    public PrintWriter getWriter() throws IOException {
        updateAuthToken();
        updateExpirationHeader();
        return super.getWriter();
    }

    @Override
    public void sendRedirect(String location) throws IOException {
        updateAuthToken();
        super.sendRedirect(location);
    }

    public void invalidateAuthentication() {
        if (isCommitted()) {
            throw new IllegalStateException("Unable to clear auth token. The response is already committed.");
        }
        writeAuthTokenCookie(null, 0);
    }

    private void updateExpirationHeader() {
        updateExpirationHeader(token);
    }

    private void updateExpirationHeader(AuthToken token) {
        if (!tokenHeaderWritten && token != null) {
            // Avoid client/server time differences by just sending seconds to expiration
            Long expiration = token.getExpiration().getTime() - System.currentTimeMillis();
            setHeader(EXPIRATION_HEADER_NAME, expiration.toString());
            tokenHeaderWritten = true;
        }
    }

    private void updateAuthToken() throws IOException {
        if (tokenCookieWritten ||
                (token != null && !isTokenNearingExpiration(token))) {
            return;
        }

        User currentUser = CurrentUser.get(request);

        if (currentUser != null) {
            Date tokenExpiration = calculateTokenExpiration();
            AuthToken token = new AuthToken(currentUser.getUserId(), macKey, tokenExpiration);

            try {
                String jwt = token.serialize();
                if (currentUser instanceof GeUser) {
                    ((GeUser) currentUser).setProperty("jwt", Values.stringValue(token.serialize()));
                }
                writeAuthTokenCookie(jwt, tokenValidityDurationInMinutes);
            } catch (AuthTokenException e) {
                LOGGER.error("Auth token serialization failed.", e);
                sendError(SC_INTERNAL_SERVER_ERROR);
            }
        }
    }

    private void writeAuthTokenCookie(String cookieValue, long cookieValidityInMinutes) {
        if (isCommitted()) {
            throw new IllegalStateException("Response committed before auth token cookie written.");
        }

        Cookie tokenCookie = new Cookie(AuthTokenFilter.TOKEN_COOKIE_NAME, cookieValue);
        tokenCookie.setMaxAge((int) cookieValidityInMinutes * 60);
        tokenCookie.setSecure(false); //set this to true for HTTPS-only
        tokenCookie.setHttpOnly(true);
        tokenCookie.setPath("/");
        addCookie(tokenCookie);
        tokenCookieWritten = true;
    }

    private Date calculateTokenExpiration() {
        return new Date(System.currentTimeMillis() + (tokenValidityDurationInMinutes * 60 * 1000));
    }

    private boolean isTokenNearingExpiration(AuthToken token) {
        // nearing expiration if remaining time is less than half the token validity duration
        return (token.getExpiration().getTime() - System.currentTimeMillis()) < (tokenValidityDurationInMinutes * 60 * 1000 / 2);
    }
}
