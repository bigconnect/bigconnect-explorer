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
package com.mware.web.routes;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import com.github.jknack.handlebars.io.ServletContextTemplateLoader;
import com.github.jknack.handlebars.io.TemplateLoader;
import com.google.common.base.Charsets;
import com.google.common.collect.ImmutableMap;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.web.ContentSecurityPolicy;
import com.mware.web.WebApp;
import com.mware.web.WebConfiguration;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.util.Base64Utils;
import org.apache.commons.io.IOUtils;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.ResourceBundle;

import static com.google.common.base.Preconditions.checkNotNull;

@Singleton
public class Index implements ParameterizedHandler {
    private static final String HEADER_CONTENT_SECURITY_POLICY = "Content-Security-Policy";
    private static final String PLUGIN_JS_RESOURCES_BEFORE_AUTH_PARAM = "pluginJsResourcesBeforeAuth";
    private static final String PLUGIN_JS_RESOURCES_WEB_WORKER_PARAM = "pluginJsResourcesWebWorker";
    private static final String PLUGIN_JS_RESOURCES_AFTER_AUTH_PARAM = "pluginJsResourcesAfterAuth";
    private static final String PLUGIN_CSS_RESOURCES_PARAM = "pluginCssResources";
    private static final String LOGO_IMAGE_DATA_URI = "logoDataUri";
    private static final String SHOW_VERSION_COMMENTS = "showVersionComments";
    private static final String DEV_MODE = "devMode";
    private static final String LOGO_PATH_BUNDLE_KEY = "bc.loading-logo.path";
    private static final String CONTEXT_PATH = "contextPath";
    private static final Map<String, String> MESSAGE_BUNDLE_PARAMS = ImmutableMap.of(
            "title", "bc.title",
            "description", "bc.description"
    );

    private final ContentSecurityPolicy contentSecurityPolicy;
    private String indexHtml;
    private boolean showVersionComments;

    @Inject
    public Index(Configuration configuration, ContentSecurityPolicy contentSecurityPolicy) {
        showVersionComments = configuration.getBoolean(WebConfiguration.SHOW_VERSION_COMMENTS, true);
        this.contentSecurityPolicy = contentSecurityPolicy;
    }

    @Handle
    public void handle(
            WebApp webApp,
            ResourceBundle resourceBundle,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws Exception {
        response.setContentType("text/html");
        response.setCharacterEncoding(Charsets.UTF_8.name());
//        if (!response.containsHeader(HEADER_CONTENT_SECURITY_POLICY)) {
//            response.addHeader(HEADER_CONTENT_SECURITY_POLICY, contentSecurityPolicy.generatePolicy(request));
//        }
        response.getWriter().write(getIndexHtml(request, webApp, resourceBundle));
    }

    private String getIndexHtml(HttpServletRequest request, WebApp app, ResourceBundle resourceBundle) throws IOException {
        boolean devMode = app.isDevModeEnabled();
        if (indexHtml == null || devMode) {
            Map<String, Object> context = new HashMap<>();
            context.put(CONTEXT_PATH, request.getContextPath());
            context.put(PLUGIN_JS_RESOURCES_BEFORE_AUTH_PARAM, app.getPluginsJsResourcesBeforeAuth());
            context.put(PLUGIN_JS_RESOURCES_WEB_WORKER_PARAM, app.getPluginsJsResourcesWebWorker());
            context.put(PLUGIN_JS_RESOURCES_AFTER_AUTH_PARAM, app.getPluginsJsResourcesAfterAuth());
            context.put(PLUGIN_CSS_RESOURCES_PARAM, app.getPluginsCssResources());
            context.put(LOGO_IMAGE_DATA_URI, getLogoImageDataUri(request, resourceBundle));
            context.put(SHOW_VERSION_COMMENTS, showVersionComments);
            context.put(DEV_MODE, devMode);
            for (Map.Entry<String, String> param : MESSAGE_BUNDLE_PARAMS.entrySet()) {
                context.put(param.getKey(), resourceBundle.getString(param.getValue()));
            }
            TemplateLoader templateLoader = new ServletContextTemplateLoader(request.getServletContext(), "/", ".hbs");
            Handlebars handlebars = new Handlebars(templateLoader);
            Template template = handlebars.compile("index");
            indexHtml = template.apply(context);
        }
        return indexHtml;
    }

    private String getLogoImageDataUri(HttpServletRequest request, ResourceBundle resourceBundle) throws IOException {
        String logoPathBundleKey = resourceBundle.getString(LOGO_PATH_BUNDLE_KEY);
        checkNotNull(logoPathBundleKey, LOGO_PATH_BUNDLE_KEY + " configuration not found");
        try (InputStream in = getResourceAsStream(request, logoPathBundleKey)) {
            checkNotNull(in, "Could not find resource: " + logoPathBundleKey);
            byte[] bytes = IOUtils.toByteArray(in);
            return "data:image/png;base64," + Base64Utils.printBase64Binary(bytes);
        }
    }

    private InputStream getResourceAsStream(HttpServletRequest request, String path) {
        InputStream is = request.getServletContext().getResourceAsStream(path);
        if (is == null) {
            is = getClass().getResourceAsStream(path);
        }
        return is;
    }
}
