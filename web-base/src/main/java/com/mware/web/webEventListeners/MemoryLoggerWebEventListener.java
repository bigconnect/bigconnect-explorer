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

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configurable;
import com.mware.core.config.Configuration;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.BcPlugin;
import com.mware.web.WebApp;
import com.sun.management.ThreadMXBean;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.lang.management.ManagementFactory;
import java.util.Enumeration;
import java.util.Map;

@BcPlugin(disabledByDefault = true)
@Singleton
public class MemoryLoggerWebEventListener extends DefaultWebEventListener {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(MemoryLoggerWebEventListener.class);
    private static final String BEFORE_MEMORY_ATTR_NAME = MemoryLoggerWebEventListener.class.getName() + "-beforeMemory";
    private ThreadMXBean threadMXBean;
    private Config config;

    private static class Config {
        @Configurable(defaultValue = "10000000")
        public long infoThreshold;

        @Configurable(defaultValue = "50000000")
        public long warningThreshold;
    }

    @Inject
    public MemoryLoggerWebEventListener(Configuration configuration) {
        config = configuration.setConfigurables(new Config(), MemoryLoggerWebEventListener.class.getName());
    }

    @Override
    public void before(WebApp app, HttpServletRequest request, HttpServletResponse response) {
        long mem = getThreadAllocatedBytes();
        request.setAttribute(BEFORE_MEMORY_ATTR_NAME, mem);
    }

    @Override
    public void after(WebApp app, HttpServletRequest request, HttpServletResponse response) {
        Long beforeMem = (Long) request.getAttribute(BEFORE_MEMORY_ATTR_NAME);
        if (beforeMem == null) {
            LOGGER.error("Could not find before memory attribute: %s", BEFORE_MEMORY_ATTR_NAME);
            return;
        }
        long afterMem = getThreadAllocatedBytes();
        long usedMem = afterMem - beforeMem;
        StringBuilder logMessage = new StringBuilder();
        logMessage.append(String.format(
                "HTTP Thread Memory %s %s %d",
                request.getMethod(),
                request.getRequestURI(),
                usedMem
        ));
        if (usedMem > config.infoThreshold || usedMem > config.warningThreshold) {
            addHttpHeadersToLogMessage(logMessage, request);
            addHttpParametersToLogMessage(logMessage, request);
        }

        if (usedMem > config.warningThreshold) {
            LOGGER.warn("%s", logMessage.toString());
        } else if (usedMem > config.infoThreshold) {
            LOGGER.info("%s", logMessage.toString());
        } else {
            LOGGER.debug("%s", logMessage.toString());
        }
    }

    private void addHttpHeadersToLogMessage(StringBuilder logMessage, HttpServletRequest request) {
        Enumeration<String> headerNames = request.getHeaderNames();
        while (headerNames.hasMoreElements()) {
            String headerName = headerNames.nextElement();
            Enumeration<String> headerValues = request.getHeaders(headerName);
            while (headerValues.hasMoreElements()) {
                String headerValue = headerValues.nextElement();
                logMessage.append("\n   HEADER: ").append(headerName).append(": ").append(headerValue);
            }
        }
    }

    private void addHttpParametersToLogMessage(StringBuilder logMessage, HttpServletRequest request) {
        for (Map.Entry<String, String[]> parameters : request.getParameterMap().entrySet()) {
            for (String value : parameters.getValue()) {
                logMessage.append("\n   PARAM: ").append(parameters.getKey()).append(": ").append(value);
            }
        }
    }

    private long getThreadAllocatedBytes() {
        return getThreadMXBean().getThreadAllocatedBytes(Thread.currentThread().getId());
    }

    private ThreadMXBean getThreadMXBean() {
        if (threadMXBean == null) {
            threadMXBean = (ThreadMXBean) ManagementFactory.getThreadMXBean();
        }
        return threadMXBean;
    }
}
