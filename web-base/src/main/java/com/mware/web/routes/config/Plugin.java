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
package com.mware.web.routes.config;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.FilenameUtils;

import javax.servlet.http.HttpServletRequest;
import java.io.File;

@Singleton
public class Plugin implements ParameterizedHandler {
    private static final String WEB_PLUGINS_PREFIX = "web.plugins.";
    private static final String DEFAULT_PLUGINS_DIR = "/jsc/configuration/plugins";
    private final com.mware.core.config.Configuration configuration;

    @Inject
    public Plugin(Configuration configuration) {
        this.configuration = configuration;
    }

    @Handle
    public void handle(
            HttpServletRequest request,
            @Required(name = "pluginName") String pluginName,
            BcResponse response
    ) throws Exception {
        final String configurationKey = WEB_PLUGINS_PREFIX + pluginName;
        String pluginPath = configuration.get(configurationKey, null);

        // Default behavior if not customized
        if (pluginPath == null) {
            pluginPath = request.getServletContext().getResource(DEFAULT_PLUGINS_DIR + "/" + pluginName).getPath();
        }

        String uri = request.getRequestURI();
        String searchString = "/" + pluginName + "/";
        String pluginResourcePath = uri.substring(uri.indexOf(searchString) + searchString.length());

        if (pluginResourcePath.endsWith(".js")) {
            response.setContentType("application/x-javascript");
        } else if (pluginResourcePath.endsWith(".ejs")) {
            response.setContentType("text/plain");
        } else if (pluginResourcePath.endsWith(".css")) {
            response.setContentType("text/css");
        } else if (pluginResourcePath.endsWith(".html")) {
            response.setContentType("text/html");
        } else {
            throw new BcResourceNotFoundException("Only js,ejs,css,html files served from plugin");
        }

        String filePath = FilenameUtils.concat(pluginPath, pluginResourcePath);
        File file = new File(filePath);

        if (!file.exists()) {
            throw new BcResourceNotFoundException("Could not find file: " + filePath);
        }

        response.setCharacterEncoding("UTF-8");
        FileUtils.copyFile(file, response.getOutputStream());
    }
}
