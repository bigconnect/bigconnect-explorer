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


import com.mware.core.exception.BcException;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.web.framework.HandlerChain;
import com.mware.web.framework.RequestResponseHandler;
import com.mware.web.util.js.BabelExecutor;
import com.mware.web.util.js.CachedCompilation;
import com.mware.web.util.js.SourceMapType;
import org.apache.commons.io.IOUtils;

import javax.script.ScriptException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;

import static com.mware.ge.util.Preconditions.checkNotNull;


public class JsxResourceHandler implements RequestResponseHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(JsxResourceHandler.class);
    private static final BabelExecutor babelExecutor = new BabelExecutor();

    private String jsResourceName;
    private String jsResourcePath;
    private String toJsResourcePath;
    private SourceMapType sourceMapType;
    private Future<CachedCompilation> compilationTask;
    private volatile CachedCompilation previousCompilation;

    public JsxResourceHandler(final String jsResourceName, final String jsResourcePath, final String toJsResourcePath) {
        this(jsResourceName, jsResourcePath, toJsResourcePath, SourceMapType.INLINE);
    }

    public JsxResourceHandler(final String jsResourceName, final String jsResourcePath, final String toJsResourcePath, SourceMapType sourceMapType) {
        this.jsResourceName = jsResourceName;
        this.jsResourcePath = jsResourcePath;
        this.toJsResourcePath = toJsResourcePath;
        this.sourceMapType = sourceMapType;

        compilationTask = babelExecutor.submit(() -> compileIfNecessary(null));
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, HandlerChain chain) throws Exception {
        CachedCompilation cache = getCache();

        if (request.getRequestURI().endsWith(".map")) {
            write(response, "application/json", cache.getSourceMap());
        } else if (request.getRequestURI().endsWith(".src")) {
            write(response, "application/javascript", cache.getInput());
        } else {
            if (this.sourceMapType == SourceMapType.EXTERNAL && cache.getSourceMap() != null) {
                response.setHeader("X-SourceMap", request.getRequestURI() + ".map");
            }
            write(response, "application/javascript", cache.getOutput());
        }
    }

    private CachedCompilation getCache() throws IOException, InterruptedException, ExecutionException, ScriptException {
        CachedCompilation cache;


        if (compilationTask == null) {
            cache = compileIfNecessary(previousCompilation);
        } else if (compilationTask.isDone()) {
            try {
                previousCompilation = compilationTask.get();
                compilationTask = null;
                cache = compileIfNecessary(previousCompilation);
            } catch (ExecutionException e) {
                cache = compileIfNecessary(previousCompilation);
            }
        } else {
            cache = compilationTask.get();
        }

        previousCompilation = cache;
        return cache;
    }

    private void write(HttpServletResponse response, String contentType, String output) throws IOException {
        if (output != null) {
            try (PrintWriter outWriter = response.getWriter()) {
                response.setContentType(contentType);
                outWriter.println(output);
            }
        } else {
            throw new BcException("Errors during compilation: " + jsResourceName);
        }
    }


    private CachedCompilation compileIfNecessary(CachedCompilation previousCompilation) {
        try {
            URL url = this.getClass().getResource(jsResourceName);
            long lastModified = url.openConnection().getLastModified();

            if (previousCompilation == null || previousCompilation.isNecessary(lastModified)) {
                CachedCompilation newCache = new CachedCompilation();
                newCache.setLastModified(lastModified);
                try (InputStream in = this.getClass().getResourceAsStream(jsResourceName)) {
                    checkNotNull(in, "Could not find resource: " + jsResourceName);
                    try (StringWriter writer = new StringWriter()) {
                        IOUtils.copy(in, writer, StandardCharsets.UTF_8);
                        String inputJavascript = writer.toString();
                        newCache.setInput(inputJavascript);
                        newCache.setPath(toJsResourcePath);
                        newCache.setResourcePath(jsResourceName);
                        babelExecutor.compileWithSharedEngine(newCache, sourceMapType);
                    }
                }
                return newCache;
            }
        } catch (IOException e) {
            throw new BcException("Unable to read last modified");
        } catch (ScriptException e) {
            LOGGER.error("%s in file %s", e.getCause().getMessage(), jsResourcePath.replaceAll("^\\/jsc", ""));
            return null;
        }
        return previousCompilation;
    }

}

