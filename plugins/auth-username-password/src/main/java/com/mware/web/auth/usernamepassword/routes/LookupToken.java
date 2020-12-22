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

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import com.github.jknack.handlebars.io.ClassPathTemplateLoader;
import com.github.jknack.handlebars.io.TemplateLoader;
import com.google.inject.Inject;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.ContentType;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcAccessDeniedException;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.web.auth.usernamepassword.ForgotPasswordConfiguration;
import com.mware.web.auth.usernamepassword.UsernamePasswordWebAppPlugin;
import com.mware.web.parameterProviders.BaseUrl;

import java.io.IOException;
import java.time.ZonedDateTime;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

public class LookupToken implements ParameterizedHandler {
    public static final String TOKEN_PARAMETER_NAME = "token";
    private static final String TEMPLATE_PATH = "/com/mware/web/auth/usernamepassword/templates";
    private static final String TEMPLATE_NAME = "changePasswordWithToken";
    private final UserRepository userRepository;
    private ForgotPasswordConfiguration forgotPasswordConfiguration;

    @Inject
    public LookupToken(UserRepository userRepository, Configuration configuration) {
        this.userRepository = userRepository;
        forgotPasswordConfiguration = new ForgotPasswordConfiguration();
        configuration.setConfigurables(forgotPasswordConfiguration, ForgotPasswordConfiguration.CONFIGURATION_PREFIX);
    }

    @Handle
    @ContentType("text/html")
    public String handle(
            @BaseUrl String baseUrl,
            @Required(name = TOKEN_PARAMETER_NAME) String token
    ) throws Exception {
        User user = userRepository.findByPasswordResetToken(token);
        if (user == null) {
            throw new BcAccessDeniedException("invalid token", null, null);
        }

        if (!user.getPasswordResetTokenExpirationDate().isAfter(ZonedDateTime.now())) {
            throw new BcAccessDeniedException("expired token", user, null);
        }

        return getHtml(baseUrl, token);
    }

    private String getHtml(String baseUrl, String token) throws IOException {
        Map<String, String> context = new HashMap<>();
        context.put("formAction", baseUrl + UsernamePasswordWebAppPlugin.CHANGE_PASSWORD_ROUTE);
        context.put("tokenParameterName", ChangePassword.TOKEN_PARAMETER_NAME);
        context.put("token", token);
        context.put("newPasswordLabel", forgotPasswordConfiguration.getNewPasswordLabel());
        context.put("newPasswordParameterName", ChangePassword.NEW_PASSWORD_PARAMETER_NAME);
        context.put("newPasswordConfirmationLabel", forgotPasswordConfiguration.getNewPasswordConfirmationLabel());
        context.put("newPasswordConfirmationParameterName", ChangePassword.NEW_PASSWORD_CONFIRMATION_PARAMETER_NAME);
        TemplateLoader templateLoader = new ClassPathTemplateLoader(TEMPLATE_PATH);
        Handlebars handlebars = new Handlebars(templateLoader);
        Template template = handlebars.compile(TEMPLATE_NAME);
        return template.apply(context);
    }
}
