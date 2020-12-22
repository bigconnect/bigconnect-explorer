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
package com.mware.web.webEventListeners;

import com.google.common.base.Joiner;
import com.mware.core.trace.Trace;
import com.mware.core.trace.TraceSpan;
import com.mware.web.WebApp;

import javax.servlet.ServletRequest;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;

public class TraceWebEventListener extends DefaultWebEventListener {
    private static final String TRACE_ATTRIBUTE = "com.mware.web.webEventListeners.TraceWebEventListener.trace";
    private static final String GRAPH_TRACE_ENABLE = "graphTraceEnable";
    public static final int PRIORITY = CurrentUserWebEventListener.PRIORITY + 100;

    @Override
    public void before(WebApp app, HttpServletRequest request, HttpServletResponse response) {
        if (isGraphTraceEnabled(request)) {
            String traceDescription = request.getRequestURI();
            Map<String, String> parameters = new HashMap<>();
            for (Map.Entry<String, String[]> reqParameters : request.getParameterMap().entrySet()) {
                parameters.put(reqParameters.getKey(), Joiner.on(", ").join(reqParameters.getValue()));
            }
            TraceSpan trace = Trace.on(traceDescription, parameters);
            request.setAttribute(TRACE_ATTRIBUTE, trace);
        }
    }

    @Override
    public void always(WebApp app, HttpServletRequest request, HttpServletResponse response) {
        TraceSpan trace = (TraceSpan) request.getAttribute(TRACE_ATTRIBUTE);
        if (trace != null) {
            trace.close();
        }
        Trace.off();
    }

    private boolean isGraphTraceEnabled(ServletRequest req) {
        return req.getParameter(GRAPH_TRACE_ENABLE) != null || req instanceof HttpServletRequest && ((HttpServletRequest) req).getHeader(GRAPH_TRACE_ENABLE) != null;
    }

    @Override
    public int getPriority() {
        return PRIORITY;
    }
}
