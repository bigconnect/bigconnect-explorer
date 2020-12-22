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
package com.mware.web.framework;

import com.mware.web.framework.handlers.StaticFileHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.lang.reflect.InvocationTargetException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Router {
    private static final Logger LOGGER = LoggerFactory.getLogger(Router.class);

    private ServletContext servletContext;
    private Map<Route.Method, List<Route>> routes = new HashMap<>();
    private HandlerChain missingRouteHandlerChain = new HandlerChain(new RequestResponseHandler[0]);
    private RequestResponseHandler missingRouteHandler;
    Map<Class<? extends Exception>, RequestResponseExceptionHandler[]> exceptionHandlers = new HashMap<>();

    public Router(ServletContext servletContext) {
        this.servletContext = servletContext;
        this.missingRouteHandler = new StaticFileHandler(servletContext);

        routes.put(Route.Method.GET, new ArrayList<>());
        routes.put(Route.Method.POST, new ArrayList<>());
        routes.put(Route.Method.PUT, new ArrayList<>());
        routes.put(Route.Method.DELETE, new ArrayList<>());
        routes.put(Route.Method.HEAD, new ArrayList<>());
        routes.put(Route.Method.OPTIONS, new ArrayList<>());
        routes.put(Route.Method.TRACE, new ArrayList<>());
        routes.put(Route.Method.CONNECT, new ArrayList<>());
    }

    public Route addRoute(Route.Method method, String path, RequestResponseHandler... handlers) {
        List<Route> methodRoutes = routes.get(method);
        Route route = new Route(method, path, handlers);
        int existingRouteIndex = methodRoutes.indexOf(route);

        if (existingRouteIndex > -1) {
            methodRoutes.set(existingRouteIndex, route);
        } else {
            methodRoutes.add(route);
        }

        return route;
    }

    public void addExceptionHandler(Class<? extends Exception> exceptionClass, RequestResponseExceptionHandler[] handlers) {
        exceptionHandlers.put(exceptionClass, handlers);
    }

    public void route(HttpServletRequest request, HttpServletResponse response) throws Exception {
        try {
            routeWithExceptionHandling(request, response);
        } catch (Exception ex) {
            Throwable t = ex;
            if(ex instanceof InvocationTargetException) {
                t = ((InvocationTargetException) ex).getTargetException();
            }

            RequestResponseExceptionHandler[] handlers = exceptionHandlers.get(t.getClass());

            if (handlers != null && handlers.length > 0) {
                LOGGER.error("Caught exception in route: " + request.getRequestURI(), t);
                dispatchToExceptionHandlers(handlers, request, response, t);
            } else {
                throw ex;
            }
        }
    }

    private void dispatchToExceptionHandlers(
            RequestResponseExceptionHandler[] handlers,
            HttpServletRequest request,
            HttpServletResponse response,
            Throwable t
    ) throws Exception {
        HandlerChain chain = new HandlerChain(handlers);
        chain.next(request, response, t);
    }

    private void routeWithExceptionHandling(HttpServletRequest request, HttpServletResponse response) throws Exception {
        Route.Method method = Route.Method.valueOf(request.getMethod().toUpperCase());

        if (method == null) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST);
            return;
        }

        String requestURI = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath == null) {
            contextPath = "";
        }
        String relativeUri = requestURI.substring(contextPath.length());
        if (relativeUri.length() == 0) {
            response.sendRedirect(contextPath + '/');
            return;
        }

        Route route = findRoute(method, request, relativeUri);

        if (route == null) {
            missingRouteHandler.handle(request, response, missingRouteHandlerChain);
        } else {
            RequestResponseHandler[] handlers = route.getHandlers();
            dispatch(handlers, request, response);
        }
    }

    private void dispatch(
            RequestResponseHandler[] handlers,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws Exception {
        HandlerChain chain = new HandlerChain(handlers);
        chain.next(request, response);
    }

    private Route findRoute(Route.Method method, HttpServletRequest request, String relativeUri) {
        List<Route> potentialRoutes = routes.get(method);
        for (Route route : potentialRoutes) {
            if (route.isMatch(request, relativeUri)) {
                return route;
            }
        }
        return null;
    }

    public Map<Route.Method, List<Route>> getRoutes() {
        return routes;
    }

    public void setMissingRouteHandler(RequestResponseHandler missingRouteHandler) {
        this.missingRouteHandler = missingRouteHandler;
    }

    public RequestResponseHandler getMissingRouteHandler() {
        return missingRouteHandler;
    }
}
