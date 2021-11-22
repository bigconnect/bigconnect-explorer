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
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.web.BadRequestException;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.framework.utils.StringUtils;
import com.mware.web.model.ClientApiSuccess;

@Singleton
public class ChangeProfile implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(ChangeProfile.class);
    private final UserRepository userRepository;

    @Inject
    public ChangeProfile(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            User user,
            @Required(name = "email") String email,
            @Optional(name = "displayName") String displayName,
            @Optional(name = "currentPassword") String currentPassword,
            @Optional(name = "newPassword") String newPassword,
            @Optional(name = "newPasswordConfirmation") String newPasswordConfirmation
    ) throws Exception {
        userRepository.setEmailAddress(user, email);
        userRepository.setDisplayName(user, displayName == null ? "" : displayName);

        if (!StringUtils.isEmpty(currentPassword) && !StringUtils.isEmpty(newPassword) && !StringUtils.isEmpty(newPasswordConfirmation)) {
            if (userRepository.isPasswordValid(user, currentPassword)) {
                if (newPassword.length() > 0) {
                    if (newPassword.equals(newPasswordConfirmation)) {
                        userRepository.setPassword(user, newPassword);
                        LOGGER.info("changed password for user: %s", user.getUsername());
                    } else {
                        throw new BadRequestException("newPasswordConfirmation", "new password and new password confirmation do not match");
                    }
                } else {
                    throw new BadRequestException("newPassword", "new password may not be blank");
                }
            } else {
                LOGGER.warn("failed to change password for user: %s due to incorrect current password", user.getUsername());
                throw new BadRequestException("currentPassword", "incorrect current password");
            }
        }

        return BcResponse.SUCCESS;
    }
}

