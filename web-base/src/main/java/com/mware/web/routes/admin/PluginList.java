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
package com.mware.web.routes.admin;

import com.google.inject.Inject;
import com.mware.core.config.Configuration;
import com.mware.core.ingest.FileImportSupportingFileHandler;
import com.mware.core.ingest.dataworker.DataWorker;
import com.mware.core.ingest.dataworker.PostMimeTypeWorker;
import com.mware.core.ingest.dataworker.TermMentionFilter;
import com.mware.core.model.Description;
import com.mware.core.model.Name;
import com.mware.core.model.user.UserListener;
import com.mware.core.status.StatusServer;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.ServiceLoaderUtil;
import com.mware.web.WebAppPlugin;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.net.URL;
import java.util.jar.Attributes;
import java.util.jar.Manifest;

public class PluginList implements ParameterizedHandler {
    private static BcLogger LOGGER = BcLoggerFactory.getLogger(PluginList.class);

    private final Configuration configuration;

    @Inject
    public PluginList(Configuration configuration) {
        this.configuration = configuration;
    }

    @Handle
    public JSONObject handle() throws Exception {
        JSONObject json = new JSONObject();

        json.put("dataWorkers", getDataWorkersJson());
        json.put("postMimeTypeWorkers", getPostMimeTypeWorkersJson());
        json.put("userListeners", getUserListenersJson());
        json.put("fileImportSupportingFileHandlers", getFileImportSupportingFileHandlersJson());
        json.put("termMentionFilters", getTermMentionFiltersJson());
        json.put("webAppPlugins", getWebAppPluginsJson());

        return json;
    }

    private JSONArray getUserListenersJson() {
        JSONArray json = new JSONArray();
        for (Class<? extends UserListener> userListenerClass : ServiceLoaderUtil.loadClasses(UserListener.class, configuration)) {
            json.put(getUserListenerJson(userListenerClass));
        }
        return json;
    }

    private JSONObject getUserListenerJson(Class<? extends UserListener> userListenerClass) {
        JSONObject json = new JSONObject();
        StatusServer.getGeneralInfo(json, userListenerClass);
        return json;
    }

    private JSONArray getDataWorkersJson() {
        JSONArray json = new JSONArray();
        for (Class<? extends DataWorker> dataWorkerClass : ServiceLoaderUtil.loadClasses(DataWorker.class, configuration)) {
            json.put(getDataWorkerJson(dataWorkerClass));
        }
        return json;
    }

    private JSONObject getDataWorkerJson(Class<? extends DataWorker> dataWorkerClass) {
        JSONObject json = new JSONObject();
        StatusServer.getGeneralInfo(json, dataWorkerClass);
        return json;
    }

    private JSONArray getPostMimeTypeWorkersJson() {
        JSONArray json = new JSONArray();
        for (Class<? extends PostMimeTypeWorker> postMimeTypeWorkerClass : ServiceLoaderUtil.loadClasses(PostMimeTypeWorker.class, configuration)) {
            json.put(getPostMimeTypeWorkerJson(postMimeTypeWorkerClass));
        }
        return json;
    }

    private JSONObject getPostMimeTypeWorkerJson(Class<? extends PostMimeTypeWorker> postMimeTypeWorkerClass) {
        JSONObject json = new JSONObject();
        StatusServer.getGeneralInfo(json, postMimeTypeWorkerClass);
        return json;
    }

    private JSONObject getLoadedLibFileJson(File loadedLibFile) {
        JSONObject json = new JSONObject();
        json.put("fileName", loadedLibFile.getAbsolutePath());
        return json;
    }

    private JSONArray getFileImportSupportingFileHandlersJson() {
        JSONArray json = new JSONArray();
        for (Class<? extends FileImportSupportingFileHandler> fileImportSupportingFileHandlerClass : ServiceLoaderUtil.loadClasses(FileImportSupportingFileHandler.class, configuration)) {
            json.put(getFileImportSupportingFileHandlerJson(fileImportSupportingFileHandlerClass));
        }
        return json;
    }

    private JSONObject getFileImportSupportingFileHandlerJson(Class<? extends FileImportSupportingFileHandler> fileImportSupportingFileHandlerClass) {
        JSONObject json = new JSONObject();
        StatusServer.getGeneralInfo(json, fileImportSupportingFileHandlerClass);
        return json;
    }

    private JSONArray getTermMentionFiltersJson() {
        JSONArray json = new JSONArray();
        for (Class<? extends TermMentionFilter> termMentionFilterClass : ServiceLoaderUtil.loadClasses(TermMentionFilter.class, configuration)) {
            json.put(getTermMentionFilterJson(termMentionFilterClass));
        }
        return json;
    }

    private JSONObject getTermMentionFilterJson(Class<? extends TermMentionFilter> termMentionFilterClass) {
        JSONObject json = new JSONObject();
        StatusServer.getGeneralInfo(json, termMentionFilterClass);
        return json;
    }

    private JSONArray getWebAppPluginsJson() {
        JSONArray json = new JSONArray();
        for (Class<? extends WebAppPlugin> webAppPluginClass : ServiceLoaderUtil.loadClasses(WebAppPlugin.class, configuration)) {
            json.put(getWebAppPluginJson(webAppPluginClass));
        }
        return json;
    }

    private JSONObject getWebAppPluginJson(Class<? extends WebAppPlugin> webAppPluginClass) {
        JSONObject json = new JSONObject();
        StatusServer.getGeneralInfo(json, webAppPluginClass);
        return json;
    }

    private static void getGeneralInfo(JSONObject json, Class clazz) {
        json.put("className", clazz.getName());

        Name nameAnnotation = (Name) clazz.getAnnotation(Name.class);
        if (nameAnnotation != null) {
            json.put("name", nameAnnotation.value());
        }

        Description descriptionAnnotation = (Description) clazz.getAnnotation(Description.class);
        if (descriptionAnnotation != null) {
            json.put("description", descriptionAnnotation.value());
        }

        Manifest manifest = getManifest(clazz);
        if (manifest != null) {
            Attributes mainAttributes = manifest.getMainAttributes();
            json.put("projectVersion", mainAttributes.getValue("Project-Version"));
            json.put("gitRevision", mainAttributes.getValue("Git-Revision"));
            json.put("builtBy", mainAttributes.getValue("Built-By"));
            String value = mainAttributes.getValue("Built-On-Unix");
            if (value != null) {
                json.put("builtOn", Long.parseLong(value));
            }
        }
    }

    private static Manifest getManifest(Class clazz) {
        try {
            String className = clazz.getSimpleName() + ".class";
            URL resource = clazz.getResource(className);
            if (resource == null) {
                LOGGER.error("Could not get class manifest: " + clazz.getName() + ", could not find resource: " + className);
                return null;
            }
            String classPath = resource.toString();
            if (!classPath.startsWith("jar")) {
                return null; // Class not from JAR
            }
            String manifestPath = classPath.substring(0, classPath.lastIndexOf("!") + 1) + "/META-INF/MANIFEST.MF";
            return new Manifest(new URL(manifestPath).openStream());
        } catch (Exception ex) {
            LOGGER.error("Could not get class manifest: " + clazz.getName(), ex);
            return null;
        }
    }
}
