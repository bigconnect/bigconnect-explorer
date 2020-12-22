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
package com.mware.web.auth.usernamepassword;

import com.mware.core.config.Configurable;
import com.mware.core.config.PostConfigurationValidator;

public class ForgotPasswordConfiguration {
    public static final String CONFIGURATION_PREFIX = "forgotPassword";

    private boolean enabled;
    private int tokenLifetimeMinutes;
    private String emailFrom;
    private String emailReplyTo;
    private String emailSubject;
    private String newPasswordLabel;
    private String newPasswordConfirmationLabel;

    @Configurable(name = "enabled", defaultValue = "false")
    public void setEnabled(String enabled) {
        this.enabled = Boolean.valueOf(enabled);
    }

    @Configurable(name = "tokenLifetimeMinutes", defaultValue = "60")
    public void setTokenLifetimeMinutes(int tokenLifetimeMinutes) {
        this.tokenLifetimeMinutes = tokenLifetimeMinutes;
    }

    @Configurable(name = "emailFrom", required = false)
    public void setEmailFrom(String emailFrom) {
        this.emailFrom = emailFrom;
    }

    @Configurable(name = "emailReplyTo", required = false)
    public void setEmailReplyTo(String emailReplyTo) {
        this.emailReplyTo = emailReplyTo;
    }

    @Configurable(name = "emailSubject", defaultValue = "Forgotten BigConnect Password")
    public void setEmailSubject(String emailSubject) {
        this.emailSubject = emailSubject;
    }

    @Configurable(name = "newPasswordLabel", defaultValue = "New Password")
    public void setNewPasswordLabel(String newPasswordLabel) {
        this.newPasswordLabel = newPasswordLabel;
    }

    @Configurable(name = "newPasswordConfirmationLabel", defaultValue = "New Password (again)")
    public void setNewPasswordConfirmationLabel(String newPasswordConfirmationLabel) {
        this.newPasswordConfirmationLabel = newPasswordConfirmationLabel;
    }

    @PostConfigurationValidator(description = "mail from address settings are required if the forgot password feature is enabled")
    public boolean validateMailServerSettings() {
        return !enabled || isNotNullOrBlank(emailFrom);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public int getTokenLifetimeMinutes() {
        return tokenLifetimeMinutes;
    }

    public String getEmailFrom() {
        return emailFrom;
    }

    public String getEmailReplyTo() {
        return emailReplyTo;
    }

    public String getEmailSubject() {
        return emailSubject;
    }

    public String getNewPasswordLabel() {
        return newPasswordLabel;
    }

    public String getNewPasswordConfirmationLabel() {
        return newPasswordConfirmationLabel;
    }

    private boolean isNotNullOrBlank(String s) {
        return s != null && s.trim().length() > 0;
    }

    public enum MailServerAuthentication {
        NONE,
        TLS,
        SSL
    }
}
