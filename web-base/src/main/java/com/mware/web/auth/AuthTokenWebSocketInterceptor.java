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
import com.mware.core.config.options.CoreOptions;
import com.mware.core.exception.BcException;
import com.mware.core.model.user.UserRepository;
import com.mware.core.security.AuthToken;
import com.mware.core.security.AuthTokenException;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.web.CurrentUser;
import org.apache.commons.lang.StringUtils;
import org.atmosphere.cpr.*;

import javax.crypto.SecretKey;
import javax.servlet.http.HttpServletRequest;

import static com.google.common.base.Preconditions.checkNotNull;

public class AuthTokenWebSocketInterceptor implements AtmosphereInterceptor {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(AuthTokenWebSocketInterceptor.class);

    private SecretKey tokenSigningKey;
    private int tokenExpirationToleranceInSeconds;
    private UserRepository userRepository;

    @Override
    public void configure(AtmosphereConfig config) {
        String keyPassword = config.getInitParameter(CoreOptions.AUTH_TOKEN_PASSWORD.name());
        checkNotNull(keyPassword, "AtmosphereConfig init parameter '" + CoreOptions.AUTH_TOKEN_PASSWORD.name() + "' was not set.");
        String keySalt = config.getInitParameter(CoreOptions.AUTH_TOKEN_SALT.name());
        checkNotNull(keySalt, "AtmosphereConfig init parameter '" + CoreOptions.AUTH_TOKEN_SALT.name() + "' was not set.");
        tokenExpirationToleranceInSeconds = config.getInitParameter(CoreOptions.AUTH_TOKEN_EXPIRATION_TOLERANCE_IN_SECS.name(), 0);
        userRepository = InjectHelper.getInstance(UserRepository.class);

        try {
            tokenSigningKey = AuthToken.generateKey(keyPassword, keySalt);
        } catch (Exception e) {
            throw new BcException("Key generation failed", e);
        }
    }

    @Override
    public Action inspect(AtmosphereResource resource) {
        try {
            AtmosphereRequest request = resource.getRequest();
            AuthToken token = getAuthToken(request);

            if (token != null && !token.isExpired(tokenExpirationToleranceInSeconds)) {
                setCurrentUser(request, token);
            }
        } catch (AuthTokenException e) {
            LOGGER.warn("Auth token signature verification failed", e);
            return Action.CANCELLED;
        }

        return Action.CONTINUE;
    }

    @Override
    public void postInspect(AtmosphereResource resource) {
        // noop
    }

    @Override
    public void destroy() {
        // noop
    }

    private AuthToken getAuthToken(AtmosphereRequest request) throws AuthTokenException {
        String cookieString = request.getHeader("cookie");

        if (cookieString != null) {
            int tokenCookieIndex = cookieString.indexOf(AuthTokenFilter.TOKEN_COOKIE_NAME);
            if (tokenCookieIndex > -1) {
                int equalsSeperatorIndex = cookieString.indexOf("=", tokenCookieIndex);
                int cookieSeparatorIndex = cookieString.indexOf(";", equalsSeperatorIndex);
                if (cookieSeparatorIndex < 0) {
                    cookieSeparatorIndex = cookieString.length();
                }
                String tokenString = cookieString.substring(equalsSeperatorIndex + 1, cookieSeparatorIndex).trim();
                if (!StringUtils.isEmpty(tokenString)) {
                    return AuthToken.parse(tokenString, tokenSigningKey);
                }
            }
        }

        return null;
    }

    private void setCurrentUser(HttpServletRequest request, AuthToken token) {
        checkNotNull(token.getUserId(), "Auth token did not contain the userId");
        User user = userRepository.findById(token.getUserId());
        CurrentUser.set(request, user);
    }
}
