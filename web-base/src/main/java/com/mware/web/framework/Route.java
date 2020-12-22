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

import com.mware.web.framework.utils.UrlUtils;

import javax.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Route {
    public static final String MATCHED_ROUTE = "websterMatchedRoute";

    public enum Method {GET, POST, PUT, DELETE, HEAD, OPTIONS, TRACE, CONNECT}

    private static final char[] REGEX_SPECIAL_CHARS = new char[]{
            '\\', '^', '$', '.', '|', '?', '*', '+', '(', ')', '[', ']', '{', '}'
    };
    private static final Pattern COMPONENT_NAME_GREEDY_PATTERN = Pattern.compile("^(.*)\\*$");
    private static final Pattern COMPONENT_NAME_REGEX_PATTERN = Pattern.compile("^(.*?)<(.*)>$");

    private Method method;
    private String path;
    private RequestResponseHandler[] handlers;
    private List<String> componentNames = new ArrayList<>();
    private Pattern routePathPattern;

    public Route(Method method, String path, RequestResponseHandler... handlers) {
        this.method = method;
        this.path = path;
        this.handlers = handlers;
        this.routePathPattern = convertPathToRegex(path, componentNames);
    }

    private Pattern convertPathToRegex(String path, List<String> componentNames) {
        Matcher m;
        StringBuilder regex = new StringBuilder();
        regex.append('^');
        for (int i = 0; i < path.length(); i++) {
            char ch = path.charAt(i);
            if (ch == '{') {
                i++;
                StringBuilder componentNameStringBuilder = new StringBuilder();
                for (; i < path.length(); i++) {
                    ch = path.charAt(i);
                    if (ch == '}') {
                        break;
                    }
                    componentNameStringBuilder.append(ch);
                }
                String componentName = componentNameStringBuilder.toString();
                if ((m = COMPONENT_NAME_GREEDY_PATTERN.matcher(componentName)) != null && m.matches()) {
                    componentNames.add(m.group(1));
                    regex.append("(.*)");
                } else if ((m = COMPONENT_NAME_REGEX_PATTERN.matcher(componentName)) != null && m.matches()) {
                    componentNames.add(m.group(1));
                    regex.append('(');
                    regex.append(m.group(2));
                    regex.append(')');
                } else {
                    componentNames.add(componentName);
                    regex.append("(.*?)");
                }
            } else {
                if (isRegexSpecialChar(ch)) {
                    regex.append('\\');
                }
                regex.append(ch);
            }
        }
        regex.append('$');
        return Pattern.compile(regex.toString());
    }

    private boolean isRegexSpecialChar(char ch) {
        for (char regexChar : REGEX_SPECIAL_CHARS) {
            if (regexChar == ch) {
                return true;
            }
        }
        return false;
    }

    public boolean isMatch(HttpServletRequest request) {
        String requestURI = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath == null) {
            contextPath = "";
        }
        String relativeUri = requestURI.substring(contextPath.length());
        return isMatch(request, relativeUri);
    }

    public boolean isMatch(HttpServletRequest request, String relativeUri) {
        Method requestMethod = Method.valueOf(request.getMethod().toUpperCase());
        if (!requestMethod.equals(method)) {
            return false;
        }

        Matcher m = this.routePathPattern.matcher(relativeUri);
        if (!m.matches()) {
            return false;
        }
        if (m.groupCount() != this.componentNames.size()) {
            return false;
        }

        request.setAttribute(MATCHED_ROUTE, this);

        for (int i = 0; i < m.groupCount(); i++) {
            String routeComponent = m.group(i + 1);
            String requestComponent = UrlUtils.urlDecode(routeComponent);
            request.setAttribute(this.componentNames.get(i), requestComponent);
        }

        return true;
    }

    public RequestResponseHandler[] getHandlers() {
        return handlers;
    }

    public Method getMethod() {
        return method;
    }

    public String getPath() {
        return path;
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null || !obj.getClass().isAssignableFrom(Route.class)) {
            return false;
        }
        Route otherRoute = (Route) obj;
        return this.getMethod().equals(otherRoute.getMethod()) && this.getPath().equals(otherRoute.getPath());
    }

    @Override
    public int hashCode() {
        return this.getPath().hashCode() + 37 * this.getMethod().hashCode();
    }
}
