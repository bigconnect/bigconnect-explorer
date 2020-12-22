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

import com.mware.web.framework.App;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.Route;
import com.mware.web.framework.annotations.ContentType;
import com.mware.web.framework.annotations.Handle;

import javax.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class AdminList implements ParameterizedHandler {

    @Handle
    @ContentType("text/html")
    public String handle(HttpServletRequest request) throws Exception {
        App app = App.getApp(request);
        List<String> paths = getPaths(app);
        return pathsToHtml(paths);
    }

    private String pathsToHtml(List<String> paths) {
        StringBuilder out = new StringBuilder();
        out.append("<html>");
        out.append("<head>");
        out.append("  <title>BigConnect Explorer: Admin Index</title>");
        out.append("</head>");
        out.append("<body>");
        out.append("  <ul>");
        for (String path : paths) {
            out.append("    <li><a href='" + path + "'>" + path + "</a></li>");
        }
        out.append("  </ul>");
        out.append("</body>");
        out.append("</html>");
        return out.toString();
    }

    private List<String> getPaths(App app) {
        Map<Route.Method, List<Route>> routes = app.getRouter().getRoutes();
        List<String> paths = new ArrayList<String>();
        for (Map.Entry<Route.Method, List<Route>> routeByMethod : routes.entrySet()) {
            if (routeByMethod.getKey() != Route.Method.GET) {
                continue;
            }
            for (Route route : routeByMethod.getValue()) {
                if (!route.getPath().startsWith("/admin/")) {
                    continue;
                }
                paths.add(route.getPath());
            }
        }
        return paths;
    }
}
