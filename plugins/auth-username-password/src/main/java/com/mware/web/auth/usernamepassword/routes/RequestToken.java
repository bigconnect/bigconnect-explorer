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
import com.mware.core.email.EmailRepository;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.web.BadRequestException;
import com.mware.web.BcResponse;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.auth.usernamepassword.ForgotPasswordConfiguration;
import com.mware.web.auth.usernamepassword.UsernamePasswordWebAppPlugin;
import com.mware.web.parameterProviders.BaseUrl;

import javax.mail.*;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;
import java.io.IOException;
import java.math.BigInteger;
import java.security.SecureRandom;
import java.time.ZonedDateTime;
import java.util.*;

public class RequestToken implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(RequestToken.class);
    private static final String USERNAME_PARAMETER_NAME = "username";
    private static final String TEMPLATE_PATH = "/com/mware/web/auth/usernamepassword/templates";
    private static final String TEMPLATE_NAME = "forgotPasswordEmail";
    private static final String CHARSET = "UTF-8";
    private final UserRepository userRepository;
    private ForgotPasswordConfiguration forgotPasswordConfiguration;
    private final EmailRepository emailRepository;

    @Inject
    public RequestToken(UserRepository userRepository, Configuration configuration, EmailRepository emailRepository) {
        this.userRepository = userRepository;
        this.emailRepository = emailRepository;
        forgotPasswordConfiguration = new ForgotPasswordConfiguration();
        configuration.setConfigurables(forgotPasswordConfiguration, ForgotPasswordConfiguration.CONFIGURATION_PREFIX);
    }

    @Handle
    public ClientApiSuccess handle(
            @BaseUrl String baseUrl,
            @Optional(name = USERNAME_PARAMETER_NAME) String username
    ) throws Exception {
        if (username == null) {
            throw new BadRequestException(USERNAME_PARAMETER_NAME, "username required");
        }

        User user = userRepository.findByUsername(username);
        if (user == null) {
            throw new BadRequestException(USERNAME_PARAMETER_NAME, "username not found");
        }

        if (user.getEmailAddress() == null) {
            throw new BadRequestException(USERNAME_PARAMETER_NAME, "no e-mail address available for user");
        }

        createTokenAndSendEmail(baseUrl, user);
        return BcResponse.SUCCESS;
    }

    private void createTokenAndSendEmail(String baseUrl, User user) throws IOException {
        String token = createToken(user);
        String displayNameOrUsername = user.getDisplayName() != null ? user.getDisplayName() : user.getUsername();
        String url = baseUrl + UsernamePasswordWebAppPlugin.LOOKUP_TOKEN_ROUTE + "?" + LookupToken.TOKEN_PARAMETER_NAME + "=" + token;
        String body = getEmailBody(displayNameOrUsername, url);
        sendEmail(user.getEmailAddress(), body);
        LOGGER.info("sent password reset e-mail to: %s", user.getEmailAddress());
    }

    private String createToken(User user) {
        String token = new BigInteger(240, new SecureRandom()).toString(32);
        ZonedDateTime cal = ZonedDateTime.now();
        cal.plusMinutes(forgotPasswordConfiguration.getTokenLifetimeMinutes());
        userRepository.setPasswordResetTokenAndExpirationDate(user, token, cal);
        return token;
    }

    private String getEmailBody(String displayNameOrUsername, String url) throws IOException {
        Map<String, String> context = new HashMap<>();
        context.put("displayNameOrUsername", displayNameOrUsername);
        context.put("url", url);
        TemplateLoader templateLoader = new ClassPathTemplateLoader(TEMPLATE_PATH);
        Handlebars handlebars = new Handlebars(templateLoader);
        Template template = handlebars.compile(TEMPLATE_NAME);
        return template.apply(context);
    }

    private void sendEmail(String to, String body) {
        try {
            MimeMessage mimeMessage = new MimeMessage(emailRepository.getSession());
            //mimeMessage.setHeader("Content-Type", "text/html; charset=" + CHARSET);
            //mimeMessage.setHeader("Content-Transfer-Encoding", "8bit");
            mimeMessage.setFrom(InternetAddress.parse(forgotPasswordConfiguration.getEmailFrom())[0]);
            mimeMessage.setReplyTo(InternetAddress.parse(forgotPasswordConfiguration.getEmailReplyTo()));
            mimeMessage.setSubject(forgotPasswordConfiguration.getEmailSubject(), CHARSET);
            mimeMessage.setText(body, CHARSET);
            mimeMessage.setSentDate(new Date());
            mimeMessage.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to));
            Transport.send(mimeMessage);
        } catch (MessagingException e) {
            throw new BcException("exception while sending e-mail", e);
        }
    }
}
