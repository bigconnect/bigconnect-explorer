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

import com.google.inject.Inject;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.web.BadRequestException;
import com.mware.web.BcResponse;
import com.mware.web.model.ClientApiSuccess;

import java.time.ZonedDateTime;
import java.util.Date;

public class ChangePassword implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(ChangePassword.class);
    public static final String TOKEN_PARAMETER_NAME = "token";
    public static final String NEW_PASSWORD_PARAMETER_NAME = "newPassword";
    public static final String NEW_PASSWORD_CONFIRMATION_PARAMETER_NAME = "newPasswordConfirmation";
    private final UserRepository userRepository;

    @Inject
    public ChangePassword(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = TOKEN_PARAMETER_NAME) String token,
            @Required(name = NEW_PASSWORD_PARAMETER_NAME) String newPassword,
            @Required(name = NEW_PASSWORD_CONFIRMATION_PARAMETER_NAME) String newPasswordConfirmation
    ) throws Exception {
        User user = userRepository.findByPasswordResetToken(token);
        if (user == null) {
            throw new BadRequestException("invalid token");
        }

        if (!user.getPasswordResetTokenExpirationDate().isAfter(ZonedDateTime.now())) {
            throw new BadRequestException("expired token");
        }

        if (newPassword.length() <= 0) {
            throw new BadRequestException(NEW_PASSWORD_PARAMETER_NAME, "new password may not be blank");
        }

        if (!newPassword.equals(newPasswordConfirmation)) {
            throw new BadRequestException(NEW_PASSWORD_CONFIRMATION_PARAMETER_NAME, "new password and new password confirmation do not match");
        }

        userRepository.setPassword(user, newPassword);
        userRepository.clearPasswordResetTokenAndExpirationDate(user);
        LOGGER.info("changed password for user: %s", user.getUsername());

        return BcResponse.SUCCESS;
    }
}
