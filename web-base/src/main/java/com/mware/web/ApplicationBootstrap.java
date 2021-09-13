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
import com.mware.config.WebOptions;
import com.mware.core.bootstrap.BcBootstrap;
import com.mware.core.bootstrap.InjectHelper;
import com.mware.core.config.Configuration;
import com.mware.core.config.ConfigurationLoader;
import com.mware.core.config.options.CoreOptions;
import com.mware.core.exception.BcException;
import com.mware.core.ingest.video.VideoFrameInfo;
import com.mware.core.lifecycle.LifeSupportService;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.longRunningProcess.LongRunningProcessRepository;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.termMention.TermMentionRepository;
import com.mware.core.model.user.GraphAuthorizationRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.process.DataWorkerRunnerProcess;
import com.mware.core.process.ExternalResourceRunnerProcess;
import com.mware.core.process.LongRunningProcessRunnerProcess;
import com.mware.core.process.SystemNotificationProcess;
import com.mware.core.security.BcVisibility;
import com.mware.core.trace.TraceRepository;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ontology.WebSchemaCreator;
import com.mware.web.auth.AuthTokenFilter;
import com.mware.web.auth.AuthTokenWebSocketInterceptor;
import org.apache.commons.lang.ClassUtils;
import org.apache.commons.lang.StringUtils;
import org.atmosphere.cache.UUIDBroadcasterCache;
import org.atmosphere.cpr.ApplicationConfig;
import org.atmosphere.cpr.AtmosphereHandler;
import org.atmosphere.cpr.AtmosphereInterceptor;
import org.atmosphere.cpr.AtmosphereServlet;
import org.atmosphere.interceptor.HeartbeatInterceptor;

import javax.servlet.*;
import javax.servlet.annotation.ServletSecurity;
import java.util.EnumSet;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

import static com.mware.core.config.FileConfigurationLoader.ENV_BC_DIR;

public class ApplicationBootstrap implements ServletContextListener {
    private static BcLogger LOGGER;

    public static final String APP_CONFIG_LOADER = "application.config.loader";
    public static final String BC_SERVLET_NAME = "bc";
    public static final String ATMOSPHERE_SERVLET_NAME = "atmosphere";
    public static final String AUTH_TOKEN_FILTER_NAME = "auth.token";
    public static final String SESSION_PROHIBITION_FILTER_NAME = "session.prohibition";
    public static final String DEBUG_FILTER_NAME = "debug";
    public static final String CACHE_FILTER_NAME = "cache";
    private volatile boolean isStopped = false;

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        try {
            final ServletContext context = sce.getServletContext();

            if (context == null) {
                throw new RuntimeException("Failed to initialize context. BigConnect is not running.");
            }
            BcLoggerFactory.setProcessType("web");

            if(StringUtils.isEmpty(System.getenv(ENV_BC_DIR)))
                throw new RuntimeException("The environment variable "+ENV_BC_DIR+" is not set. Aborting.");

            Map<String, String> initParameters = new HashMap<>(getInitParametersAsMap(context));
            Configuration config = ConfigurationLoader.load(context.getInitParameter(APP_CONFIG_LOADER), initParameters);
            LOGGER = BcLoggerFactory.getLogger(ApplicationBootstrap.class);
            LOGGER.info("Running application with configuration:\n%s", config);

            setupInjector(context, config);
            setupGraphAuthorizations();
            setupOntology();
            startBcProcesses(config);

            setupWebApp(context, config);

            Runtime.getRuntime().addShutdownHook(new Thread(() -> contextDestroyed(null)));

            System.out.println("BigConnect started");
        } catch (Throwable ex) {
            if (LOGGER != null) {
                LOGGER.error("Could not startup context", ex);
            }
            throw new BcException("Could not startup context", ex);
        }
    }

    private void setupOntology() {
        WebSchemaCreator schemaCreator = InjectHelper.getInstance(WebSchemaCreator.class);
        if(!schemaCreator.isCreated())
            schemaCreator.createOntology();
    }

    private void startBcProcesses(Configuration config) {
        boolean enableWebContainerProcesses = config.get(WebOptions.ENABLE_WEB_PROCESSES);
        if (!enableWebContainerProcesses) {
            return;
        }

        try {
            String boltEnabled = System.getProperty("bolt.enabled", "true");
            if (Boolean.parseBoolean(boltEnabled)) {
                Class boltServer = ClassUtils.getClass("com.mware.bolt.BoltServer");
                InjectHelper.getInstance(boltServer);
                LOGGER.info("Found Bolt Server. Starting...");
            }
        } catch (ClassNotFoundException e) {
            LOGGER.info("Bolt Server not available.");
        }

        InjectHelper.getInstance(DataWorkerRunnerProcess.class);
        InjectHelper.getInstance(ExternalResourceRunnerProcess.class);
        InjectHelper.getInstance(LongRunningProcessRunnerProcess.class);
        InjectHelper.getInstance(SystemNotificationProcess.class);
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        if (isStopped) {
            return;
        }
        isStopped = true;

        InjectHelper.getInstance(LifeSupportService.class).shutdown();
    }

    private void setupInjector(ServletContext context, Configuration config) {
        LOGGER.debug("setupInjector");
        InjectHelper.inject(this, BcBootstrap.bootstrapModuleMaker(config), config);

        if(config.get(CoreOptions.TRACE_ENABLED)) {
            TraceRepository traceRepository = InjectHelper.getInstance(TraceRepository.class);
            traceRepository.enable();
        }

        // Store the injector in the context for a servlet to access later
        context.setAttribute(Injector.class.getName(), InjectHelper.getInjector());

        InjectHelper.getInstance(SchemaRepository.class); // verify we are up
    }

    private void setupGraphAuthorizations() {
        LOGGER.debug("setupGraphAuthorizations");
        GraphAuthorizationRepository graphAuthorizationRepository = InjectHelper.getInstance(GraphAuthorizationRepository.class);
        graphAuthorizationRepository.addAuthorizationToGraph(
                BcVisibility.SUPER_USER_VISIBILITY_STRING,
                UserRepository.VISIBILITY_STRING,
                TermMentionRepository.VISIBILITY_STRING,
                LongRunningProcessRepository.VISIBILITY_STRING,
                SchemaRepository.VISIBILITY_STRING,
                WorkspaceRepository.VISIBILITY_STRING,
                VideoFrameInfo.VISIBILITY_STRING
        );
    }

    private void setupWebApp(ServletContext context, Configuration config) {
        LOGGER.debug("setupWebApp");
        Router router = new Router(context);
        ServletRegistration.Dynamic servlet = context.addServlet(BC_SERVLET_NAME, router);
        servlet.addMapping("/*");
        servlet.setAsyncSupported(true);
        addMultiPartConfig(config, servlet);
        addSecurityConstraint(servlet, config);
        addAtmosphereServlet(context, config);
        addSessionProhibitionFilter(context, config);
        addAuthTokenFilter(context, config);
        addDebugFilter(context);
        addCacheFilter(context);
        LOGGER.info(
                "JavaScript / Less modifications will not be reflected on server. Run `grunt` from webapp directory in development");
    }

    private void addMultiPartConfig(Configuration config, ServletRegistration.Dynamic servlet) {
        String location = config.get(WebOptions.MULTIPART_LOCATION);
        long maxFileSize = config.get(WebOptions.MULTIPART_MAX_FILE_SIZE);
        long maxRequestSize = config.get(WebOptions.MULTIPART_MAX_REQUEST_SIZE);
        int fileSizeThreshold = config.get(WebOptions.MULTIPART_FILE_SIZE_THRESHOLD);

        servlet.setMultipartConfig(
                new MultipartConfigElement(location, maxFileSize, maxRequestSize, fileSizeThreshold)
        );
    }

    private void addAtmosphereServlet(ServletContext context, Configuration config) {
        ServletRegistration.Dynamic servlet = context.addServlet(ATMOSPHERE_SERVLET_NAME, AtmosphereServlet.class);
        servlet.addMapping(Messaging.PATH + "/*");
        servlet.setAsyncSupported(true);
        servlet.setLoadOnStartup(0);
        servlet.setInitParameter(AtmosphereHandler.class.getName(), Messaging.class.getName());
        servlet.setInitParameter(ApplicationConfig.BROADCAST_FILTER_CLASSES, MessagingFilter.class.getName());
        servlet.setInitParameter(AtmosphereInterceptor.class.getName(), HeartbeatInterceptor.class.getName() + "," +
                AuthTokenWebSocketInterceptor.class.getName());
        servlet.setInitParameter(ApplicationConfig.MAX_INACTIVE, "-1");
        servlet.setInitParameter(ApplicationConfig.CLIENT_HEARTBEAT_INTERVAL_IN_SECONDS, "30");
        servlet.setInitParameter(ApplicationConfig.HEARTBEAT_INTERVAL_IN_SECONDS, "30");
        servlet.setInitParameter(ApplicationConfig.WEBSOCKET_IDLETIME, "14400000"); // 4 hours in millis
        servlet.setInitParameter(ApplicationConfig.BROADCASTER_CACHE, UUIDBroadcasterCache.class.getName());
        servlet.setInitParameter(ApplicationConfig.DROP_ACCESS_CONTROL_ALLOW_ORIGIN_HEADER, "true");
        servlet.setInitParameter(ApplicationConfig.WEBSOCKET_MAXTEXTSIZE, "1048576");
        servlet.setInitParameter(ApplicationConfig.WEBSOCKET_MAXBINARYSIZE, "1048576");
        servlet.setInitParameter(CoreOptions.AUTH_TOKEN_PASSWORD.name(), config.get(CoreOptions.AUTH_TOKEN_PASSWORD));
        servlet.setInitParameter(CoreOptions.AUTH_TOKEN_SALT.name(), config.get(CoreOptions.AUTH_TOKEN_SALT));
        servlet.setInitParameter(CoreOptions.AUTH_TOKEN_EXPIRATION_TOLERANCE_IN_SECS.name(), config.get(CoreOptions.AUTH_TOKEN_EXPIRATION_TOLERANCE_IN_SECS).toString());

        addSecurityConstraint(servlet, config);
    }

    private void addSessionProhibitionFilter(ServletContext context, Configuration config) {
        FilterRegistration.Dynamic filter = context.addFilter(SESSION_PROHIBITION_FILTER_NAME, SessionProhibitionFilter.class);
        filter.setAsyncSupported(true);
        filter.addMappingForUrlPatterns(EnumSet.allOf(DispatcherType.class), false, "/*");
    }

    private void addAuthTokenFilter(ServletContext context, Configuration config) {
        FilterRegistration.Dynamic filter = context.addFilter(AUTH_TOKEN_FILTER_NAME, AuthTokenFilter.class);
        filter.setInitParameter(CoreOptions.AUTH_TOKEN_PASSWORD.name(), config.get(CoreOptions.AUTH_TOKEN_PASSWORD));
        filter.setInitParameter(CoreOptions.AUTH_TOKEN_SALT.name(), config.get(CoreOptions.AUTH_TOKEN_SALT));
        filter.setInitParameter(CoreOptions.AUTH_TOKEN_EXPIRATION_TOLERANCE_IN_SECS.name(), config.get(CoreOptions.AUTH_TOKEN_EXPIRATION_TOLERANCE_IN_SECS).toString());
        filter.setInitParameter(WebOptions.AUTH_TOKEN_EXPIRATION_IN_MINS.name(), config.get(WebOptions.AUTH_TOKEN_EXPIRATION_IN_MINS).toString());
        filter.setAsyncSupported(true);
        filter.addMappingForUrlPatterns(EnumSet.allOf(DispatcherType.class), false, "/*");
    }

    private void addDebugFilter(ServletContext context) {
        FilterRegistration.Dynamic filter = context.addFilter(DEBUG_FILTER_NAME, RequestDebugFilter.class);
        filter.setAsyncSupported(true);
        filter.addMappingForUrlPatterns(EnumSet.of(DispatcherType.REQUEST), false, "/*");
    }

    private void addCacheFilter(ServletContext context) {
        FilterRegistration.Dynamic filter = context.addFilter(CACHE_FILTER_NAME, CacheServletFilter.class);
        filter.setAsyncSupported(true);
        String[] mappings = new String[]{"/", "*.html", "*.css", "*.js", "*.ejs", "*.less", "*.hbs"};
        for (String mapping : mappings) {
            filter.addMappingForUrlPatterns(EnumSet.of(DispatcherType.REQUEST), false, mapping);
        }
    }

    private void addSecurityConstraint(ServletRegistration.Dynamic servletRegistration, Configuration config) {
        ServletSecurity.TransportGuarantee transportGuarantee = ServletSecurity.TransportGuarantee.CONFIDENTIAL;
        String constraintType = config.get(WebOptions.HTTP_TRANSPORT_GUARANTEE);
        if (constraintType != null) {
            transportGuarantee = ServletSecurity.TransportGuarantee.valueOf(constraintType);
        }

        HttpConstraintElement httpConstraintElement = new HttpConstraintElement(transportGuarantee);
        ServletSecurityElement securityElement = new ServletSecurityElement(httpConstraintElement);
        servletRegistration.setServletSecurity(securityElement);
    }

    private Map<String, String> getInitParametersAsMap(ServletContext context) {
        Map<String, String> initParameters = new HashMap<>();
        Enumeration<String> e = context.getInitParameterNames();
        while (e.hasMoreElements()) {
            String initParameterName = e.nextElement();
            initParameters.put(initParameterName, context.getInitParameter(initParameterName));
        }
        return initParameters;
    }
}
