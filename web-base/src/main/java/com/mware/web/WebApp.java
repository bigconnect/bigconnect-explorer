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
package com.mware.web;

import com.google.inject.Injector;
import com.mware.config.BcResourceBundleManager;
import com.mware.config.WebOptions;
import com.mware.core.bootstrap.InjectHelper;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.ClientApiObject;
import com.mware.core.model.notification.SystemNotificationSeverity;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.ElementType;
import com.mware.web.framework.App;
import com.mware.web.framework.Handler;
import com.mware.web.framework.handlers.CLStaticHttpHandler;
import com.mware.web.framework.handlers.StaticResourceHandler;
import com.mware.web.framework.resultWriters.ResultWriterFactory;
import com.mware.web.parameterProviders.*;
import com.mware.web.parameterValueConverters.ElementTypeParameterValueConverter;
import com.mware.web.parameterValueConverters.JSONObjectParameterValueConverter;
import com.mware.web.routes.notification.SystemNotificationSeverityValueConverter;
import com.mware.web.util.js.SourceMapType;
import org.json.JSONObject;

import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.ResourceBundle;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.google.common.base.Preconditions.checkNotNull;
import static com.mware.ge.util.CloseableUtils.closeQuietly;

public class WebApp extends App {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(WebApp.class);
    private final Injector injector;
    private final boolean devMode;

    private final List<String> pluginsJsResourcesWebWorker = new ArrayList<>();
    private final List<String> pluginsJsResourcesBeforeAuth = new ArrayList<>();
    private final List<String> pluginsJsResourcesAfterAuth = new ArrayList<>();

    private final StyleAppendableHandler pluginsCssResourceHandler = new StyleAppendableHandler();
    private final List<String> pluginsCssResources = new ArrayList<>();
    private BcResourceBundleManager bcResourceBundleManager = new BcResourceBundleManager();
    private BcDefaultResultWriterFactory defaultResultWriterFactory;

    public WebApp(final ServletContext servletContext, final Injector injector) {
        super(servletContext);
        this.injector = injector;

        App.registeredParameterProviderFactory(injector.getInstance(ActiveWorkspaceIdParameterProviderFactory.class));
        App.registeredParameterProviderFactory(injector.getInstance(JustificationTextParameterProviderFactory.class));
        App.registeredParameterProviderFactory(injector.getInstance(BaseUrlParameterProviderFactory.class));
        App.registeredParameterProviderFactory(injector.getInstance(AuthorizationsParameterProviderFactory.class));
        App.registeredParameterProviderFactory(injector.getInstance(TimeZoneParameterProviderFactory.class));
        App.registeredParameterProviderFactory(injector.getInstance(SourceGuidParameterProviderFactory.class));
        App.registeredParameterProviderFactory(injector.getInstance(LocaleParameterProviderFactory.class));
        App.registeredParameterProviderFactory(injector.getInstance(BcResponseParameterProviderFactory.class));
        App.registeredParameterProviderFactory(injector.getInstance(UserParameterProviderFactory.class));
        App.registeredParameterProviderFactory(injector.getInstance(FormulaEvaluatorUserContextParameterProviderFactory.class));
        App.registeredParameterProviderFactory(injector.getInstance(ResourceBundleParameterProviderFactory.class));
        App.registeredParameterProviderFactory(injector.getInstance(ClientApiSourceInfoParameterProviderFactory.class));
        App.registeredParameterProviderFactory(injector.getInstance(WebAppParameterProviderFactory.class));
        App.registeredParameterProviderFactory(injector.getInstance(RemoteAddrParameterProviderFactory.class));

        App.registerParameterValueConverter(ClientApiObject.class, new ClientApiObjectParameterValueConverter());
        App.registerParameterValueConverter(ClientApiObject[].class, new ClientApiObjectArrayParameterValueConverter());
        App.registerParameterValueConverter(SystemNotificationSeverity.class, new SystemNotificationSeverityValueConverter());

        App.registerParameterValueConverter(JSONObject.class, new JSONObjectParameterValueConverter());
        App.registerParameterValueConverter(ElementType.class, new ElementTypeParameterValueConverter());
        this.defaultResultWriterFactory = InjectHelper.getInstance(BcDefaultResultWriterFactory.class);

        Configuration config = injector.getInstance(Configuration.class);
        this.devMode = config.get(WebOptions.DEV_MODE);

        if (!isDevModeEnabled()) {
            String pluginsCssRoute = "plugins.css";
            this.get("/" + pluginsCssRoute, pluginsCssResourceHandler);
            pluginsCssResources.add(pluginsCssRoute);
        }
    }

    @Override
    protected ResultWriterFactory getResultWriterFactory(Method handleMethod) {
        return defaultResultWriterFactory;
    }

    @Override
    protected Handler[] instantiateHandlers(Class<? extends Handler>[] handlerClasses) throws Exception {
        Handler[] handlers = new Handler[handlerClasses.length];
        for (int i = 0; i < handlerClasses.length; i++) {
            handlers[i] = injector.getInstance(handlerClasses[i]);
        }
        return handlers;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response) throws Exception {
        if (request.getRequestURI().endsWith("ejs")) {
            response.setContentType("text/plain");
        }
        response.setCharacterEncoding("UTF-8");
        super.handle(request, response);
    }

    private void register(String name, String type, String pathPrefix, Boolean includeInPage, String closureExternResourcePath) {
        register(name, type, pathPrefix, includeInPage, closureExternResourcePath, pluginsJsResourcesAfterAuth, false);
    }

    private void register(
            String name,
            String type,
            String pathPrefix,
            boolean includeInPage,
            String closureExternResourcePath,
            List<String> resourceList,
            boolean skipCompile
    ) {
        String resourcePath = "/" + (pathPrefix + name).replaceAll("^/", "");
        if (type.equals("application/javascript") && !skipCompile) {
            boolean enableSourceMaps = isDevModeEnabled();
            JavascriptResourceHandler handler = new JavascriptResourceHandler(name, resourcePath, enableSourceMaps, closureExternResourcePath);
            get(resourcePath, handler);
            if (enableSourceMaps) {
                get(resourcePath + ".map", handler);
                get(resourcePath + ".src", handler);
            }
        } else {
            get(resourcePath, new StaticResourceHandler(this.getClass(), name, type));
        }

        if (includeInPage) {
            resourceList.add(resourcePath);
        }
    }

    /**
     * Register JavaScript file to be available for the application.
     * <p>
     * Include an optional resource path to closure compiler extern js file.
     */
    public void registerJavaScript(String scriptResourceName, Boolean includeInPage, String closureExternResourcePath) {
        register(scriptResourceName, "application/javascript", "jsc", includeInPage, closureExternResourcePath);
    }


    /**
     * Register JavaScript file to be available for the application.
     * <p>
     * If includeInPage is false the file is still available for requiring before
     * authentication.
     *
     * @param scriptResourceName Classpath to JavaScript file
     * @param includeInPage      Set to true to load automatically after authentication
     */
    public void registerJavaScript(String scriptResourceName, Boolean includeInPage) {
        register(scriptResourceName, "application/javascript", "jsc", includeInPage, null);
    }

    /**
     * Register JavaScript file to be automatically loaded after authentication.
     */
    public void registerJavaScript(JavaScriptResource javaScriptResource) {
        register(
                javaScriptResource.getResourcePath(),
                "application/javascript",
                "jsc",
                javaScriptResource.isIncludeInPage(),
                null,
                pluginsJsResourcesAfterAuth,
                javaScriptResource.isSkipCompile()
        );
    }

    /**
     * Register JavaScript file to be automatically loaded after authentication.
     * <p>
     * Loaded using requirejs, so use `define` to stop further plugin
     * loading until all dependencies are met, or `require` to continue
     * asynchronously.
     *
     * @param scriptResourceName Classpath to JavaScript file
     */
    public void registerJavaScript(String scriptResourceName) {
        registerJavaScript(scriptResourceName, true);
    }

    /**
     * Add a file that is not loaded on page load and is already compiled by some plugin process.
     *
     * @param scriptResourceName
     */
    public void registerCompiledJavaScript(String scriptResourceName) {
        registerCompiledJavaScript(scriptResourceName, false, true);
    }

    public void registerCompiledJavaScript(String scriptResourceName, boolean includeInPage) {
        registerCompiledJavaScript(scriptResourceName, includeInPage, true);
    }

    /**
     * Add a file that is already compiled, (don't have closure compile).
     *
     * @param scriptResourceName
     * @param includeInPage
     * @param hasSourceMap
     */
    public void registerCompiledJavaScript(String scriptResourceName, boolean includeInPage, boolean hasSourceMap) {
        registerJavaScript(new WebApp.JavaScriptResource(scriptResourceName)
                .includeInPage(includeInPage)
                .skipCompile(true));

        String map = scriptResourceName + ".map";
        if (hasSourceMap && getClass().getResource(map) != null) {
            registerJavaScript(new WebApp.JavaScriptResource(scriptResourceName + ".map")
                    .includeInPage(false)
                    .skipCompile(true));
        }
    }

    /**
     * Register a JSX react component.
     *
     * Converts .jsx files to .js files using babel.
     *
     * Source maps are always created and externally linked
     *
     * @param scriptResourceName
     */
    public void registerJavaScriptComponent(String scriptResourceName) {
        if (scriptResourceName.endsWith("jsx")) {
            String resourcePath = "/" + ("jsc" + scriptResourceName).replaceAll("^/", "");
            String toResourcePath = resourcePath.replaceAll("jsx$", "js");
            SourceMapType map = SourceMapType.EXTERNAL;
            JsxResourceHandler handler = new JsxResourceHandler(scriptResourceName, resourcePath, toResourcePath, map);
            get(toResourcePath, handler);
            if (map == SourceMapType.EXTERNAL) {
                get(toResourcePath + ".map", handler);
                get(toResourcePath + ".src", handler);
            }
        } else {
            throw new BcException("JavaScript components must be .jsx");
        }
    }

    /**
     * Register a JavaScript file to be loaded in web-worker thread.
     * <p>
     * Passes along an "externs" resource path to validate closure compilation.
     * <p>
     * Loaded using requirejs, so use `define` to stop further plugin
     * loading until all dependencies are met, or `require` to continue
     * asynchronously.
     * <p>
     * Use caution about loading BigConnect Explorer dependencies as they will be copies
     * in the worker.
     *
     * @param scriptResourceName
     * @param closureExternResourcePath
     */
    public void registerWebWorkerJavaScript(String scriptResourceName, String closureExternResourcePath) {
        register(scriptResourceName, "application/javascript", "jsc", true, closureExternResourcePath, pluginsJsResourcesWebWorker, false);
    }

    /**
     * Register a JavaScript file to be loaded in web-worker thread.
     * <p>
     * Loaded using requirejs, so use `define` to stop further plugin
     * loading until all dependencies are met, or `require` to continue
     * asynchronously.
     * <p>
     * Use caution about loading BigConnect Explorer dependencies as they will be copies
     * in the worker.
     *
     * @param scriptResourceName Classpath to JavaScript file
     */
    public void registerWebWorkerJavaScript(String scriptResourceName) {
        registerWebWorkerJavaScript(scriptResourceName, null);
    }

    public void registerCompiledWebWorkerJavaScript(String scriptResourceName) {
        register(
                scriptResourceName,
                "application/javascript",
                "jsc",
                true,
                null,
                pluginsJsResourcesWebWorker,
                true
        );

        registerJavaScript(new WebApp.JavaScriptResource(scriptResourceName + ".map")
                .includeInPage(false)
                .skipCompile(true));
    }

    /**
     * Register a JavaScript file to be loaded if user is not authenticated.
     * Primarily used for implementing the login authentication component.
     * <p>
     * Loaded using requirejs, so use `define` to stop further plugin
     * loading until all dependencies are met, or `require` to continue
     * asynchronously.
     *
     * @param scriptResourceName Classpath to JavaScript file
     */
    public void registerBeforeAuthenticationJavaScript(String scriptResourceName) {
        register(scriptResourceName, "application/javascript", "jsc", true, null, pluginsJsResourcesBeforeAuth, false);
    }

    /**
     * Register a new JavaScript template. Can be required at scriptResourceName
     *
     * @param scriptResourceName Classpath to JavaScript template (ejs, hbs, etc)
     */
    public void registerJavaScriptTemplate(String scriptResourceName) {
        if (scriptResourceName.endsWith(".hbs")) {
            get("/jsc" + scriptResourceName + ".js", new HandlebarsPrecompiledResourceHandler(scriptResourceName, isDevModeEnabled()));
        } else {
            LOGGER.warn("Non-Handlebars templates are considered deprecated, as they can cause performance issues" +
                    "\n(please use '.hbs' extension if this is handlebar formatted template)"
            );
        }
        register(scriptResourceName, "text/plain", "jsc", false, null);
    }

    /**
     * Register a new generic file.
     *
     * @param resourceName Classpath to file
     * @param mimeType     Type to serve file as
     */
    public void registerFile(String resourceName, String mimeType) {
        register(resourceName, mimeType, "", false, null);
    }

    /**
     * Register new css file. Will be concatenated into plugin.css
     * when not running in devMode=true
     *
     * @param cssResourceName Classpath to css file
     */
    public void registerCss(String cssResourceName) {
        String resourcePath = "css" + cssResourceName;
        if (isDevModeEnabled()) {
            get("/" + resourcePath, new StaticResourceHandler(this.getClass(), cssResourceName, "text/css"));
            pluginsCssResources.add(resourcePath);
        } else {
            pluginsCssResourceHandler.appendCssResource(cssResourceName);
        }
    }

    /**
     * Register new less file to be compiled into css for browser.
     * Will be concatenated with plain css files into plugin.css
     * when not running in devMode=true
     *
     * @param lessResourceName Classpath to less file
     */
    public void registerLess(final String lessResourceName) {
        String resourcePath = "css" + lessResourceName + ".css";
        if (isDevModeEnabled()) {
            get("/" + resourcePath, new LessResourceHandler(lessResourceName, isDevModeEnabled()));
            pluginsCssResources.add(resourcePath);
        } else {
            pluginsCssResourceHandler.appendLessResource(lessResourceName);
        }
    }

    public static Locale getLocal(String language, String country, String variant) {
        if (language != null) {
            if (country != null) {
                if (variant != null) {
                    return new Locale(language, country, variant);
                }
                return new Locale(language, country);
            }
            return new Locale(language);
        }
        return Locale.getDefault();
    }

    public void registerResourceBundle(String resourceBundleResourceName) {
        InputStream in = WebApp.class.getResourceAsStream(resourceBundleResourceName);
        checkNotNull(in, "Could not find resource: " + resourceBundleResourceName);
        try {
            Pattern pattern = Pattern.compile(".*_([a-z]{2})(?:_([A-Z]{2}))?(?:_(.+))?\\.properties");
            Matcher matcher = pattern.matcher(resourceBundleResourceName);
            if (matcher.matches()) {
                String language = matcher.group(1);
                String country = matcher.group(2);
                String variant = matcher.group(3);
                Locale locale = getLocal(language, country, variant);
                LOGGER.info("registering ResourceBundle plugin file: %s with locale: %s", resourceBundleResourceName, locale);
                bcResourceBundleManager.register(in, locale);
            } else {
                LOGGER.info("registering ResourceBundle plugin file: %s", resourceBundleResourceName);
                bcResourceBundleManager.register(in);
            }
        } catch (IOException e) {
            throw new BcException("Could not read resource bundle resource: " + resourceBundleResourceName);
        } finally {
            closeQuietly(in);
        }
    }

    public ResourceBundle getBundle(Locale locale) {
        return bcResourceBundleManager.getBundle(locale);
    }

    public List<String> getPluginsJsResourcesBeforeAuth() {
        return pluginsJsResourcesBeforeAuth;
    }

    public List<String> getPluginsJsResourcesWebWorker() {
        return pluginsJsResourcesWebWorker;
    }

    public List<String> getPluginsJsResourcesAfterAuth() {
        return pluginsJsResourcesAfterAuth;
    }

    public List<String> getPluginsCssResources() {
        return pluginsCssResources;
    }

    public boolean isDevModeEnabled() {
        return devMode;
    }

    public static class JavaScriptResource {
        private final String resourcePath;
        private boolean includeInPage = true;
        private boolean skipCompile = false;

        public JavaScriptResource(String resourcePath) {
            this.resourcePath = resourcePath;
        }

        public JavaScriptResource includeInPage(boolean includeInPage) {
            this.includeInPage = includeInPage;
            return this;
        }

        public String getResourcePath() {
            return resourcePath;
        }

        public boolean isIncludeInPage() {
            return includeInPage;
        }

        public boolean isSkipCompile() {
            return skipCompile;
        }

        public JavaScriptResource skipCompile(boolean skipCompile) {
            this.skipCompile = skipCompile;
            return this;
        }
    }
}
