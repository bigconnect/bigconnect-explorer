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

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.web.framework.HandlerChain;
import com.mware.web.framework.RequestResponseHandler;
import net.sf.uadetector.ReadableUserAgent;
import net.sf.uadetector.UserAgentStringParser;
import net.sf.uadetector.VersionNumber;
import net.sf.uadetector.service.UADetectorServiceFactory;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public class UserAgentFilter implements RequestResponseHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(UserAgentFilter.class);

    private static final Map<String, VersionNumber> MINIMUM_VERSION_BROWSERS = new HashMap<String, VersionNumber>();

    static {
        MINIMUM_VERSION_BROWSERS.put("IE", new VersionNumber("11"));
        MINIMUM_VERSION_BROWSERS.put("Firefox", new VersionNumber("52"));
    }

    private final UserAgentStringParser parser = UADetectorServiceFactory.getResourceModuleParser();

    private final Cache<String, String> cache = CacheBuilder.newBuilder()
            .maximumSize(100)
            .expireAfterWrite(2, TimeUnit.HOURS)
            .build();

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse httpServletResponse, HandlerChain handlerChain) throws Exception {
        String message = isUnsupported(request.getHeader("User-Agent"));
        if (!message.equals("")) {
            httpServletResponse.setContentType("text/plain");
            PrintWriter writer = httpServletResponse.getWriter();
            writer.println(message);
            writer.close();
            writer.flush();
            return;
        }
        handlerChain.next(request, httpServletResponse);
    }

    private String isUnsupported(String userAgentString) {
        String message = cache.getIfPresent(userAgentString);
        if (message == null) {
            ReadableUserAgent userAgent = parser.parse(userAgentString);
            message = isUnsupported(userAgent);
            cache.put(userAgentString, message);
        }
        return message;
    }

    private String isUnsupported(ReadableUserAgent userAgent) {
        if (MINIMUM_VERSION_BROWSERS.containsKey(userAgent.getName())) {
            VersionNumber minimumVersion = MINIMUM_VERSION_BROWSERS.get(userAgent.getName());
            if (userAgent.getVersionNumber().compareTo(minimumVersion) < 0) {
                String message = getUnsupportedMessage(userAgent);
                LOGGER.warn(message);
                return message;
            }
        }
        return "";
    }

    private String getUnsupportedMessage(ReadableUserAgent userAgent) {
        VersionNumber minimumVersion = MINIMUM_VERSION_BROWSERS.get(userAgent.getName());
        if (minimumVersion != null) {
            return userAgent.getName() + " " + userAgent.getVersionNumber().toVersionString() + " is not supported. Please upgrade to at least version " + minimumVersion.toVersionString() + ".";
        }
        return userAgent.getName() + " " + userAgent.getVersionNumber().toVersionString() + " is not supported.";
    }
}
