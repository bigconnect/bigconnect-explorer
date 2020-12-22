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
package com.mware.formula;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.ClientApiGeObject;
import com.mware.core.model.clientapi.dto.ClientApiSchema;
import com.mware.core.model.clientapi.util.ObjectMapperFactory;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.ClientApiConverter;
import com.mware.ge.Authorizations;
import com.mware.ge.GeObject;
import org.apache.commons.io.IOUtils;
import org.mozilla.javascript.*;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.ResourceBundle;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Evaluates JavaScript formulas (title, subtitle, etc) using Java's Rhino JavaScript interpreter.
 */
@Singleton
public class FormulaEvaluator {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(FormulaEvaluator.class);
    private static final String CONFIGURATION_PARAMETER_MAX_THREADS = FormulaEvaluator.class.getName() + ".max.threads";
    private static final int CONFIGURATION_DEFAULT_MAX_THREADS = 1;
    private Configuration configuration;
    private SchemaRepository schemaRepository;
    private ExecutorService executorService;

    private static final ThreadLocal<Map<String, Scriptable>> threadLocalScope = ThreadLocal.withInitial(HashMap::new);

    @Inject
    public FormulaEvaluator(Configuration configuration, SchemaRepository schemaRepository) {
        this.configuration = configuration;
        this.schemaRepository = schemaRepository;

        executorService = Executors.newFixedThreadPool(configuration.getInt(
                CONFIGURATION_PARAMETER_MAX_THREADS,
                CONFIGURATION_DEFAULT_MAX_THREADS
        ));
    }

    public void close() {
        executorService.shutdown();
    }

    public String evaluateTitleFormula(GeObject geObject, UserContext userContext, Authorizations authorizations) {
        return evaluateFormula("Title", geObject, null, null, userContext, authorizations);
    }

    public String evaluateTimeFormula(GeObject geObject, UserContext userContext, Authorizations authorizations) {
        return evaluateFormula("Time", geObject, null, null, userContext, authorizations);
    }

    public String evaluateSubtitleFormula(GeObject geObject, UserContext userContext, Authorizations authorizations) {
        return evaluateFormula("Subtitle", geObject, null, null, userContext, authorizations);
    }

    public String evaluatePropertyDisplayFormula(
            GeObject geObject,
            String propertyKey,
            String propertyName,
            UserContext userContext,
            Authorizations authorizations
    ) {
        return evaluateFormula("Property", geObject, propertyKey, propertyName, userContext, authorizations);
    }

    private String evaluateFormula(
            String type,
            GeObject geObject,
            String propertyKey,
            String propertyName,
            UserContext userContext,
            Authorizations authorizations
    ) {
        FormulaEvaluatorCallable evaluationCallable = new FormulaEvaluatorCallable(
                type,
                geObject,
                propertyKey,
                propertyName,
                userContext,
                authorizations
        );

        try {
            return executorService.submit(evaluationCallable).get();
        } catch (InterruptedException e) {
            LOGGER.error(type + " evaluation interrupted", e);
        } catch (ExecutionException e) {
            LOGGER.error("Error encountered during " + type + " evaluation", e);
        }

        return "Unable to Evaluate " + type;
    }

    public Scriptable getScriptable(UserContext userContext) {
        Map<String, Scriptable> scopes = threadLocalScope.get();

        String mapKey = userContext.locale.toString() + userContext.timeZone;
        Scriptable scope = scopes.get(mapKey);
        if (scope == null) {
            scope = setupContext(getOntologyJson(userContext.getWorkspaceId()), getConfigurationJson(userContext.locale, userContext.getWorkspaceId()), userContext.timeZone);
            scopes.put(mapKey, scope);
        } else {
            scope.put("ONTOLOGY_JSON", scope, Context.toObject(getOntologyJson(userContext.getWorkspaceId()), scope));
        }
        return scope;
    }

    private Scriptable setupContext(String ontologyJson, String configurationJson, String timeZone) {
        Context context = Context.enter();
        context.setLanguageVersion(Context.VERSION_1_8);
        context.setOptimizationLevel(-1);

        RequireJsSupport browserSupport = new RequireJsSupport();

        ScriptableObject scope = context.initStandardObjects(browserSupport, true);

        try {
            scope.put("ONTOLOGY_JSON", scope, Context.toObject(ontologyJson, scope));
            scope.put("CONFIG_JSON", scope, Context.toObject(configurationJson, scope));
            scope.put("USERS_TIMEZONE", scope, Context.toObject(timeZone, scope));
        } catch (Exception e) {
            throw new BcException("Json resource not available", e);
        }

        String[] names = new String[]{"print", "load", "consoleWarn", "consoleError", "readFully"};
        browserSupport.defineFunctionProperties(names, scope.getClass(), ScriptableObject.DONTENUM);

        Scriptable argsObj = context.newArray(scope, new Object[]{});
        scope.defineProperty("arguments", argsObj, ScriptableObject.DONTENUM);

        loadJavaScript(scope);

        return scope;
    }

    private void loadJavaScript(ScriptableObject scope) {
        evaluateFile(scope, "../libs/underscore.js");
        evaluateFile(scope, "../libs/r.js");
        evaluateFile(scope, "../libs/windowTimers.js");
        evaluateFile(scope, "ontologyConstants.js");
        evaluateFile(scope, "loader.js");
    }

    protected String getOntologyJson(String workspaceId) {
        ClientApiSchema result = schemaRepository.getClientApiObject(workspaceId);
        try {
            return ObjectMapperFactory.getInstance().writeValueAsString(result);
        } catch (JsonProcessingException ex) {
            throw new BcException("Could not evaluate JSON: " + result, ex);
        }
    }

    protected String getConfigurationJson(Locale locale, String workspaceId) {
        return configuration.toJSON(workspaceId, null).toString();
    }

    private void evaluateFile(ScriptableObject scope, String filename) {
        String transformed = RequireJsSupport.transformFilePath(filename);

        LOGGER.debug("evaluating file: %s", transformed);
        try (InputStream is = FormulaEvaluator.class.getResourceAsStream(transformed)) {
            if (is == null) {
                throw new BcException("File not found " + transformed);
            }

            Context.getCurrentContext().evaluateString(scope, IOUtils.toString(is), transformed, 0, null);
        } catch (JavaScriptException ex) {
            throw new BcException("JavaScript error in " + transformed, ex);
        } catch (IOException ex) {
            throw new BcException("Could not read file: " + transformed, ex);
        }
    }

    protected String toJson(GeObject geObject, String workspaceId, Authorizations authorizations) {
        ClientApiGeObject v = ClientApiConverter.toClientApi(geObject, workspaceId, authorizations);
        return v.toString();
    }

    public static class UserContext {
        private final Locale locale;
        private final String timeZone;
        private final String workspaceId;
        private final ResourceBundle resourceBundle;

        public UserContext(Locale locale, ResourceBundle resourceBundle, String timeZone, String workspaceId) {
            this.locale = locale == null ? Locale.getDefault() : locale;
            this.resourceBundle = resourceBundle;
            this.timeZone = timeZone;
            this.workspaceId = workspaceId;
        }

        public Locale getLocale() {
            return locale;
        }

        public ResourceBundle getResourceBundle() {
            return resourceBundle;
        }

        public String getTimeZone() {
            return timeZone;
        }

        public String getWorkspaceId() {
            return workspaceId;
        }
    }

    private class FormulaEvaluatorCallable implements Callable<String> {
        private final String propertyKey;
        private final String propertyName;
        private UserContext userContext;
        private String fieldName;
        private GeObject geObject;
        private Authorizations authorizations;

        public FormulaEvaluatorCallable(
                String fieldName,
                GeObject geObject,
                String propertyKey,
                String propertyName,
                UserContext userContext,
                Authorizations authorizations
        ) {
            this.fieldName = fieldName;
            this.geObject = geObject;
            this.propertyKey = propertyKey;
            this.propertyName = propertyName;
            this.userContext = userContext;
            this.authorizations = authorizations;
        }

        @Override
        public String call() throws Exception {
            Scriptable scope = getScriptable(userContext);
            Context context = Context.getCurrentContext();

            String json = toJson(geObject, userContext.getWorkspaceId(), authorizations);
            Object func = scope.get("evaluate" + fieldName + "FormulaJson", scope);
            if (func.equals(Scriptable.NOT_FOUND)) {
                throw new BcException("formula function not found");
            }

            if (func instanceof Function) {
                Function function = (Function) func;
                Object result = function.call(
                        context,
                        scope,
                        scope,
                        new Object[] { json, propertyKey, propertyName }
                );

                return (String) context.jsToJava(result, String.class);
            }

            throw new BcException("Unknown result from formula");
        }
    }
}
