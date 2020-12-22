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

import com.asual.lesscss.LessEngine;
import com.asual.lesscss.LessOptions;
import com.mware.core.exception.BcException;
import com.mware.web.framework.HandlerChain;
import com.mware.web.framework.RequestResponseHandler;
import org.apache.commons.io.IOUtils;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import static com.mware.ge.util.Preconditions.checkNotNull;

public class LessResourceHandler implements RequestResponseHandler {
    private static LessEngine lessCompiler;

    private String lessResourceName;
    private boolean checkLastModified;
    private LessCache cache;

    public LessResourceHandler(String lessResourceName, boolean checkLastModified) {
        this.lessResourceName = lessResourceName;
        this.checkLastModified = checkLastModified;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, HandlerChain chain) throws Exception {
        response.setContentType("text/css");

        synchronized (lessResourceName.intern()) {
            if (cache == null) {
                cache = new LessCache(getCompiled(), checkLastModified ? getLastModified() : 0l);
            } else if (checkLastModified) {
                long newLastModified = getLastModified();
                if (cache.lastModified != newLastModified) {
                    cache = new LessCache(getCompiled(), newLastModified);
                }
            }
        }

        try (PrintWriter outWriter = response.getWriter()) {
            outWriter.println(cache.getOutput());
        }
    }

    private String getCompiled() throws Exception {
        try (InputStream in = this.getClass().getResourceAsStream(lessResourceName)) {
            checkNotNull(in, "Could not find resource: " + lessResourceName);
            try (StringWriter writer = new StringWriter()) {
                IOUtils.copy(in, writer, StandardCharsets.UTF_8);
                String inputLess = writer.toString();
                return lessCompiler().compile(inputLess);
            }
        }
    }

    private long getLastModified() {
        URL url = this.getClass().getResource(lessResourceName);
        try {
            return url.openConnection().getLastModified();
        } catch (IOException e) {
            throw new BcException("Unable to find less resource: " + lessResourceName, e);
        }
    }

    private synchronized LessEngine lessCompiler() {
        if (lessCompiler == null) {
            lessCompiler = new LessEngine();
            LessOptions options = new LessOptions();
            options.setCompress(true);
            options.setCharset("UTF-8");
            lessCompiler = new LessEngine(options);
        }
        return lessCompiler;
    }

    class LessCache {
        private long lastModified;
        private String output;

        LessCache(String output, long lastModified) {
            this.lastModified = lastModified;
            this.output = output;
        }

        public long getLastModified() {
            return lastModified;
        }

        public String getOutput() {
            return output;
        }
    }
}
