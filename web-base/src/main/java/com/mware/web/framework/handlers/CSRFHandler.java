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
package com.mware.web.framework.handlers;

import com.mware.web.framework.HandlerChain;
import com.mware.web.framework.RequestResponseHandler;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.math.BigInteger;
import java.security.SecureRandom;

public class CSRFHandler implements RequestResponseHandler {
    public static final String CSRF_COOKIE_NAME = "CSRF";

    private final String tokenRequestParameterName;
    private final String tokenRequestHeaderName;

    public static String getSavedToken(HttpServletRequest request, HttpServletResponse response) {
        return getSavedToken(request, response, false);
    }

    public static String getSavedToken(HttpServletRequest request, HttpServletResponse response, boolean createTokenIfMissing) {
        String token = null;
        Cookie tokenCookie = getTokenCookie(request);

        if (tokenCookie != null) {
            token = tokenCookie.getValue();
        } else if (tokenCookie == null && createTokenIfMissing) {
            token = resetSavedToken(request, response);
        }

        return token;
    }

    private static Cookie getTokenCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();

        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (cookie.getName().equals(CSRFHandler.CSRF_COOKIE_NAME)) {
                return cookie;
            }
        }

        return null;
    }

    private static String resetSavedToken(HttpServletRequest request, HttpServletResponse response) {
        String token = new BigInteger(120, new SecureRandom()).toString(32);
        Cookie tokenCookie = new Cookie(CSRF_COOKIE_NAME, token);
        tokenCookie.setPath("/");
        tokenCookie.setMaxAge(-1);
        tokenCookie.setSecure(false); // set to true for HTTPs-only
        tokenCookie.setHttpOnly(true);
        response.addCookie(tokenCookie);
        return token;
    }

    private static void clearSavedToken(HttpServletRequest request, HttpServletResponse response) {
        Cookie cookie = getTokenCookie(request);
        if (cookie != null) {
            cookie.setMaxAge(0);
            response.addCookie(cookie);
        }
    }

    public CSRFHandler(String tokenRequestParameterName) {
        this.tokenRequestParameterName = tokenRequestParameterName;
        this.tokenRequestHeaderName = null;
    }

    public CSRFHandler(String tokenRequestParameterName, String tokenRequestHeaderName) {
        this.tokenRequestParameterName = tokenRequestParameterName;
        this.tokenRequestHeaderName = tokenRequestHeaderName;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, HandlerChain chain) throws Exception {
        if (request.getMethod().equals("GET")) {
            verifyTokenAbsence(request, response);
        } else {
            verifyToken(request, response);
        }
        chain.next(request, response);
    }

    private void verifyToken(HttpServletRequest request, HttpServletResponse response) throws TokenException {
        String tokenFromRequest = getTokenFromRequest(request);
        String storedToken = CSRFHandler.getSavedToken(request, response);
        if (tokenFromRequest == null) {
            throw new TokenException("CSRF token not found in request parameter " + this.tokenRequestParameterName);
        }
        if (storedToken == null) {
            throw new TokenException("CSRF token cookie not found");
        }
        if (!tokenFromRequest.equals(storedToken)) {
            throw new TokenException("CSRF token from request parameter " + this.tokenRequestParameterName
                    + " does not match the one from the user's CSRF cookie");
        }
    }

    private void verifyTokenAbsence(HttpServletRequest request, HttpServletResponse response) throws TokenException {
        String tokenFromRequest = getTokenFromRequest(request);
        if (tokenFromRequest != null) {
            CSRFHandler.resetSavedToken(request, response);
            throw new TokenException("CSRF token found in a " + request.getMethod() + " request. Token has been reset");
        }
    }

    private String getTokenFromRequest(HttpServletRequest request) {
        String token = null;

        if (this.tokenRequestParameterName != null) {
            token = request.getParameter(this.tokenRequestParameterName);
        }

        if (token == null && this.tokenRequestHeaderName != null) {
            token = request.getHeader(this.tokenRequestHeaderName);
        }

        return token;
    }

    public class TokenException extends Exception {
        public TokenException(String msg) {
            super(msg);
        }
    }
}
