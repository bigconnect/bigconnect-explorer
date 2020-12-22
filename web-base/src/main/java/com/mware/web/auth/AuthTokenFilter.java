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

import com.mware.core.bootstrap.InjectHelper;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.model.user.GeUser;
import com.mware.core.model.user.UserRepository;
import com.mware.core.security.AuthToken;
import com.mware.core.security.AuthTokenException;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.values.storable.Values;
import com.mware.web.CurrentUser;
import org.apache.commons.lang.StringUtils;

import javax.crypto.SecretKey;
import javax.servlet.*;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

import static com.google.common.base.Preconditions.checkNotNull;
import static com.mware.core.config.Configuration.*;

public class AuthTokenFilter implements Filter {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(AuthTokenFilter.class);
    private static final int MIN_AUTH_TOKEN_EXPIRATION_MINS = 1;
    public static final String TOKEN_COOKIE_NAME = "JWT";
    public static final String TOKEN_HEADER_NAME = "BC-AuthToken";

    private SecretKey tokenSigningKey;
    private long tokenValidityDurationInMinutes;
    private int tokenExpirationToleranceInSeconds;
    private UserRepository userRepository;

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        tokenValidityDurationInMinutes = Long.parseLong(
                getRequiredInitParameter(filterConfig, AUTH_TOKEN_EXPIRATION_IN_MINS)
        );

        if (tokenValidityDurationInMinutes < MIN_AUTH_TOKEN_EXPIRATION_MINS) {
            throw new BcException("Configuration: " + "'" +  AUTH_TOKEN_EXPIRATION_IN_MINS + "' " +
                "must be at least " + MIN_AUTH_TOKEN_EXPIRATION_MINS + " minute(s)"
            );
        }

        tokenExpirationToleranceInSeconds = Integer.parseInt(
                getRequiredInitParameter(filterConfig, Configuration.AUTH_TOKEN_EXPIRATION_TOLERANCE_IN_SECS)
        );

        String keyPassword = getRequiredInitParameter(filterConfig, AUTH_TOKEN_PASSWORD);
        String keySalt = getRequiredInitParameter(filterConfig, AUTH_TOKEN_SALT);
        userRepository = InjectHelper.getInstance(UserRepository.class);

        try {
            tokenSigningKey = AuthToken.generateKey(keyPassword, keySalt);
        } catch (Exception e) {
            throw new ServletException(e);
        }
    }

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain) throws IOException {
        doFilter((HttpServletRequest) servletRequest, (HttpServletResponse) servletResponse, filterChain);
    }

    public void doFilter(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws IOException {
        try {
            AuthToken token = getAuthToken(request);
            AuthTokenHttpResponse authTokenResponse = new AuthTokenHttpResponse(token, request, response, tokenSigningKey, tokenValidityDurationInMinutes);

            if (token != null) {
                if (token.isExpired(tokenExpirationToleranceInSeconds)) {
                    authTokenResponse.invalidateAuthentication();
                } else {
                    User user = userRepository.findById(token.getUserId());
                    if (user != null) {
                        if (user instanceof GeUser) {
                            ((GeUser) user).setProperty("jwt", Values.stringValue(token.serialize()));
                        }
                        CurrentUser.set(request, user);
                    } else {
                        authTokenResponse.invalidateAuthentication();
                    }
                }
            }

            chain.doFilter(request, authTokenResponse);
        } catch (Exception ex) {
            LOGGER.warn("Auth token signature verification failed", ex);
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
        }
    }

    @Override
    public void destroy() {

    }

    private AuthToken getAuthToken(HttpServletRequest request) throws AuthTokenException {
        if(request.getHeader(TOKEN_HEADER_NAME) != null) {
            String token = request.getHeader(TOKEN_HEADER_NAME);
            return AuthToken.parse(token, tokenSigningKey);
        } else {
            Cookie tokenCookie = getTokenCookie(request);
            return tokenCookie != null ? AuthToken.parse(tokenCookie.getValue(), tokenSigningKey) : null;
        }
    }

    private Cookie getTokenCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();

        if (cookies == null) {
            return null;
        }

        Cookie found = null;

        for (Cookie cookie : cookies) {
            if (cookie.getName().equals(AuthTokenFilter.TOKEN_COOKIE_NAME)) {
                if (StringUtils.isEmpty(cookie.getValue())) {
                    return null;
                } else {
                    found = cookie;
                }
            }
        }

        return found;
    }

    private String getRequiredInitParameter(FilterConfig filterConfig, String parameterName) {
        String parameter = filterConfig.getInitParameter(parameterName);
        checkNotNull(parameter, "FilterConfig init parameter '" + parameterName + "' was not set.");
        return parameter;
    }
}
