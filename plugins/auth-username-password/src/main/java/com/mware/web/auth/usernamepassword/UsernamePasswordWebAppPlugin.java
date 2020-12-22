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

import com.google.inject.Inject;
import com.mware.core.config.Configuration;
import com.mware.core.model.Description;
import com.mware.core.model.Name;
import com.mware.web.auth.usernamepassword.routes.ChangePassword;
import com.mware.web.auth.usernamepassword.routes.Login;
import com.mware.web.auth.usernamepassword.routes.LookupToken;
import com.mware.web.auth.usernamepassword.routes.RequestToken;
import com.mware.web.framework.Handler;
import com.mware.core.bootstrap.InjectHelper;
import com.mware.web.WebApp;
import com.mware.web.WebAppPlugin;
import com.mware.web.WebConfiguration;
import com.mware.web.AuthenticationHandler;

import javax.servlet.ServletContext;

@Name("Username/Password Authentication")
@Description("Allows authenticating using a username and password")
public class UsernamePasswordWebAppPlugin implements WebAppPlugin {
    public static final String LOOKUP_TOKEN_ROUTE = "/forgotPassword";
    public static final String CHANGE_PASSWORD_ROUTE = "/forgotPassword/changePassword";
    private Configuration configuration;

    @Override
    public void init(WebApp app, ServletContext servletContext, Handler authenticationHandler) {
        app.registerBeforeAuthenticationJavaScript("/com/mware/web/auth/usernamepassword/plugin.js");
        app.registerJavaScriptTemplate("/com/mware/web/auth/usernamepassword/templates/login.hbs");
        app.registerJavaScript("/com/mware/web/auth/usernamepassword/authentication.js", false);

        app.registerLess("/com/mware/web/auth/usernamepassword/less/login.less");

        app.post(AuthenticationHandler.LOGIN_PATH, InjectHelper.getInstance(Login.class));

        ForgotPasswordConfiguration forgotPasswordConfiguration = new ForgotPasswordConfiguration();
        configuration.setConfigurables(forgotPasswordConfiguration, ForgotPasswordConfiguration.CONFIGURATION_PREFIX);
        configuration.set(WebConfiguration.PREFIX + ForgotPasswordConfiguration.CONFIGURATION_PREFIX + ".enabled", forgotPasswordConfiguration.isEnabled());
        if (forgotPasswordConfiguration.isEnabled()) {
            app.post("/forgotPassword/requestToken", RequestToken.class);
            app.get(LOOKUP_TOKEN_ROUTE, LookupToken.class);
            app.post(CHANGE_PASSWORD_ROUTE, ChangePassword.class);
        }
    }

    @Inject
    public void setConfiguration(Configuration configuration) {
        this.configuration = configuration;
    }
}
