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

import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

public class RequestDebugFilter implements Filter {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(RequestDebugFilter.class);
    public static final String BC_REQUEST_DEBUG = "bc.request.debug";

    public static final String HEADER_DELAY = "BC-Request-Delay-Millis";
    public static final String HEADER_ERROR = "BC-Request-Error";
    public static final String HEADER_ERROR_JSON = "BC-Request-Error-Json";

    static {
        if ("true".equals(System.getProperty(BC_REQUEST_DEBUG))) {
            LOGGER.warn("Request debugging is enabled. Set -D%s=false to disable", BC_REQUEST_DEBUG);
        }
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {

        if ("true".equals(System.getProperty(BC_REQUEST_DEBUG))) {
            if (processDebugCommands(request, response)) {
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private boolean processDebugCommands(ServletRequest request, ServletResponse response) throws IOException {
        if (request instanceof HttpServletRequest && response instanceof HttpServletResponse) {

            HttpServletRequest httpRequest = (HttpServletRequest) request;
            HttpServletResponse httpResponse = (HttpServletResponse) response;

            String delay = httpRequest.getHeader(HEADER_DELAY);
            String error = httpRequest.getHeader(HEADER_ERROR);
            String json = httpRequest.getHeader(HEADER_ERROR_JSON);

            if (delay != null) {
                try {
                    LOGGER.warn("BigConnect Explorer Debug Header Found %s. Delaying for %s", HEADER_DELAY, delay);
                    Thread.sleep(Integer.parseInt(delay));
                } catch (InterruptedException e) { }
            }

            if (json != null) {
                LOGGER.warn("BigConnect Explorer Debug Header Found %s. Sending error json instead: %s", HEADER_ERROR_JSON, json);
                httpResponse.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                httpResponse.setContentType("application/json");
                httpResponse.setCharacterEncoding("UTF-8");
                httpResponse.getWriter().write(json);
                return true;
            }

            if (error != null) {
                LOGGER.warn("BigConnect Explorer Debug Header Found %s. Sending error instead: %s", HEADER_ERROR, error);
                Integer code = Integer.parseInt(error);
                ((HttpServletResponse) response).sendError(code);
                return true;
            }
        }

        return false;
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
    }

    @Override
    public void destroy() {
    }
}
