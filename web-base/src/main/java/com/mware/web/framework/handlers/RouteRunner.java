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
package com.mware.web.framework.handlers;

import com.mware.web.framework.*;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.parameterProviders.OptionalParameterProvider;
import com.mware.web.framework.parameterProviders.ParameterProvider;
import com.mware.web.framework.parameterProviders.RequiredParameterProvider;
import org.apache.commons.lang.StringUtils;

import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;

public class RouteRunner implements ParameterizedHandler {
    public static final String ROUTE_RUNNER_HTML = "routeRunner.html";
    private final String routeRunnerHtml;

    public RouteRunner() {
        routeRunnerHtml = loadRouteRunnerHtml();
    }

    protected String loadRouteRunnerHtml() {
        try {
            InputStream routeRunnerHtmlStream = RouteRunner.class.getResourceAsStream(ROUTE_RUNNER_HTML);
            if (routeRunnerHtmlStream == null) {
                throw new WebsterException("Could not find " + RouteRunner.class.getResource(ROUTE_RUNNER_HTML));
            }
            ByteArrayOutputStream temp = new ByteArrayOutputStream();
            int read;
            byte[] data = new byte[1024];
            while ((read = routeRunnerHtmlStream.read(data)) > 0) {
                temp.write(data, 0, read);
            }
            String routeRunnerHtml = new String(temp.toByteArray());
            routeRunnerHtml = StringUtils.replace(routeRunnerHtml, "${pageTitle}", getPageTitle());
            routeRunnerHtml = StringUtils.replace(routeRunnerHtml,"${additionalStyles}", getAdditionalStyles());
            routeRunnerHtml = StringUtils.replace(routeRunnerHtml,"${additionalJavascript}", getAdditionalJavascript());
            return routeRunnerHtml;
        } catch (IOException ex) {
            throw new WebsterException("Could not read " + ROUTE_RUNNER_HTML, ex);
        }
    }

    protected String getAdditionalJavascript() {
        return "";
    }

    protected String getAdditionalStyles() {
        return "";
    }

    protected String getPageTitle() {
        return "Webster: Route Runner";
    }

    @Handle
    public void handle(Router router, HttpServletResponse response) throws Exception {
        response.setContentType("text/html");
        response.getOutputStream().print(getHtml(router));
    }

    protected String getHtml(Router router) {
        String result = routeRunnerHtml;
        result = StringUtils.replace(result, "${routesJson}", getRoutesJson(router));
        result = StringUtils.replace(result , "${routes}", getRoutesHtml(router));
        return result;
    }

    protected String getRoutesJson(Router router) {
        StringBuilder result = new StringBuilder();
        result.append("{\n");
        Map<Route.Method, List<Route>> routesByMethod = getRoutesByMethod(router);
        boolean firstMethod = true;
        for (Map.Entry<Route.Method, List<Route>> routesByMethodEntry : routesByMethod.entrySet()) {
            if (!firstMethod) {
                result.append(",\n");
            }
            result.append("      \"").append(routesByMethodEntry.getKey().name()).append("\": {\n");
            boolean firstRoute = true;
            for (Route route : routesByMethodEntry.getValue()) {
                if (!firstRoute) {
                    result.append(",\n");
                }
                result.append("        \"").append(route.getPath()).append("\": ").append(getRouteJson(route));
                firstRoute = false;
            }
            result.append("\n      }");
            firstMethod = false;
        }
        result.append("\n    }");
        return result.toString();
    }

    private Map<Route.Method, List<Route>> getRoutesByMethod(Router router) {
        Map<Route.Method, List<Route>> results = new HashMap<>();
        for (Map.Entry<Route.Method, List<Route>> routeEntry : router.getRoutes().entrySet()) {
            for (Route route : routeEntry.getValue()) {
                List<Route> byMethod = results.get(route.getMethod());
                if (byMethod == null) {
                    byMethod = new ArrayList<>();
                    results.put(route.getMethod(), byMethod);
                }
                byMethod.add(route);
            }
        }
        return results;
    }

    protected String getRoutesHtml(Router router) {
        StringBuilder result = new StringBuilder();
        List<Route> routes = getSortedRoutes(router.getRoutes());
        for (Route route : routes) {
            result
                    .append("<li title=\"").append(route.getPath()).append("\" onclick=\"javascript:loadRoute('").append(route.getMethod().name()).append("', '").append(route.getPath()).append("')\">\n")
                    .append("<div class='method method-").append(route.getMethod().name()).append("'>").append(route.getMethod().name()).append("</div>")
                    .append(" ")
                    .append("<div class='path'>").append(route.getPath()).append("</div>")
                    .append("</li>\n");
        }
        return result.toString();
    }

    private List<Route> getSortedRoutes(Map<Route.Method, List<Route>> routes) {
        List<Route> results = new ArrayList<>();
        for (Map.Entry<Route.Method, List<Route>> routeEntry : routes.entrySet()) {
            for (Route route : routeEntry.getValue()) {
                results.add(route);
            }
        }
        Collections.sort(results, new Comparator<Route>() {
            @Override
            public int compare(Route route1, Route route2) {
                int r = route1.getPath().compareTo(route2.getPath());
                if (r != 0) {
                    return r;
                }
                return route1.getMethod().name().compareTo(route2.getMethod().name());
            }
        });
        return results;
    }

    private String getRouteJson(Route route) {
        StringBuilder result = new StringBuilder()
                .append("{")
                .append("\"method\":\"").append(route.getMethod().name()).append("\",")
                .append("\"path\":\"").append(route.getPath()).append("\",")
                .append("\"parameters\":[");
        List<String> parametersJsonItems = getParametersJsonItems(route);
        for (int i = 0; i < parametersJsonItems.size(); i++) {
            if (i > 0) {
                result.append(",");
            }
            result.append(parametersJsonItems.get(i));
        }
        result
                .append("]")
                .append("}");
        return result.toString();
    }

    protected List<String> getParametersJsonItems(Route route) {
        List<String> results = new ArrayList<>();
        RequestResponseHandler lastHandler = route.getHandlers()[route.getHandlers().length - 1];
        if (lastHandler instanceof RequestResponseHandlerParameterizedHandlerWrapper) {
            ParameterProvider[] parameterProviders = ((RequestResponseHandlerParameterizedHandlerWrapper) lastHandler).getParameterProviders();
            for (ParameterProvider parameterProvider : parameterProviders) {
                getParameterJson(parameterProvider, results);
            }
        }
        return results;
    }

    protected void getParameterJson(ParameterProvider parameterProvider, List<String> results) {
        if (parameterProvider instanceof RequiredParameterProvider) {
            RequiredParameterProvider req = (RequiredParameterProvider) parameterProvider;
            results.add("{\"required\":true,\"name\":\"" + req.getParameterName() + "\",\"type\":\"" + req.getParameterType().getName() + "\"}");
        } else if (parameterProvider instanceof OptionalParameterProvider) {
            OptionalParameterProvider opt = (OptionalParameterProvider) parameterProvider;
            String json = "{\"required\":false,\"name\":\"" + opt.getParameterName() + "\",\"type\":\"" + opt.getParameterType().getName() + "\"";
            if (opt.getDefaultValue() != null) {
                json += ",\"defaultValue\":\"" + opt.getDefaultValue() + "\"";
            }
            json += "}";
            results.add(json);
        }
    }
}
