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
import com.mware.web.util.js.CachedCompilation;
import org.apache.commons.io.IOUtils;
import org.visallo.web.closurecompiler.com.google.javascript.jscomp.*;
import org.visallo.web.closurecompiler.com.google.javascript.jscomp.Compiler;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URL;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.logging.Level;

import static com.mware.ge.util.Preconditions.checkNotNull;

public class JavascriptResourceHandler implements RequestResponseHandler {
    private static final int EXECUTOR_CONCURRENT = 3;
    private static final long EXECUTOR_IDLE_THREAD_RELEASE_SECONDS = 5;
    private static final ThreadPoolExecutor compilationExecutor = new ThreadPoolExecutor(
            EXECUTOR_CONCURRENT,
            EXECUTOR_CONCURRENT,
            EXECUTOR_IDLE_THREAD_RELEASE_SECONDS,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>()
    );

    static {
        compilationExecutor.allowCoreThreadTimeOut(true);
    }

    private String jsResourceName;
    private String jsResourcePath;
    private boolean enableSourceMaps;
    private String closureExternResourcePath;
    private Future<CachedCompilation> compilationTask;
    private volatile CachedCompilation previousCompilation;

    public JavascriptResourceHandler(final String jsResourceName, final String jsResourcePath, boolean enableSourceMaps) {
        this(jsResourceName, jsResourcePath, enableSourceMaps, null);
    }

    public JavascriptResourceHandler(final String jsResourceName, final String jsResourcePath, boolean enableSourceMaps, String closureExternResourcePath) {
        this.jsResourceName = jsResourceName;
        this.jsResourcePath = jsResourcePath;
        this.enableSourceMaps = enableSourceMaps;
        this.closureExternResourcePath = closureExternResourcePath;

        compilationTask = compilationExecutor.submit(() -> compileIfNecessary(null));
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, HandlerChain chain) throws Exception {
        CachedCompilation cache = getCache();

        if (request.getRequestURI().endsWith(".map")) {
            write(response, "application/json", cache.getSourceMap());
        } else if (request.getRequestURI().endsWith(".src")) {
            write(response, "application/javascript", cache.getInput());
        } else {
            if (this.enableSourceMaps && cache.getSourceMap() != null) {
                response.setHeader("X-SourceMap", request.getRequestURI() + ".map");
            }
            write(response, "application/javascript", cache.getOutput());
        }
    }

    private CachedCompilation getCache() throws IOException, InterruptedException, ExecutionException {
        CachedCompilation cache;

        if (compilationTask == null) {
            cache = compileIfNecessary(previousCompilation);
        } else if (compilationTask.isDone()) {
            previousCompilation = compilationTask.get();
            compilationTask = null;
            cache = compileIfNecessary(previousCompilation);
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
            throw new BcException("Errors during minify: " + jsResourceName);
        }
    }


    private CachedCompilation compileIfNecessary(CachedCompilation previousCompilation) throws IOException {
        URL url = this.getClass().getResource(jsResourceName);
        if (url == null) {
            throw new BcException("Could not find resource: " + jsResourceName);
        }
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

                    runClosureCompilation(newCache);
                }
            }
            return newCache;
        }

        return previousCompilation;
    }

    private CachedCompilation runClosureCompilation(CachedCompilation cachedCompilation) throws IOException {
        Compiler.setLoggingLevel(Level.INFO);
        Compiler compiler = new Compiler(new JavascriptResourceHandlerErrorManager());

        CompilerOptions compilerOptions = new CompilerOptions();
        CompilationLevel.SIMPLE_OPTIMIZATIONS.setOptionsForCompilationLevel(compilerOptions);
        WarningLevel.VERBOSE.setOptionsForWarningLevel(compilerOptions);
        compilerOptions.setLanguageIn(CompilerOptions.LanguageMode.ECMASCRIPT6);
        compilerOptions.setLanguageOut(CompilerOptions.LanguageMode.ECMASCRIPT5);
        compilerOptions.setEnvironment(CompilerOptions.Environment.BROWSER);
        compilerOptions.setSourceMapOutputPath("");
        compilerOptions.setSourceMapFormat(SourceMap.Format.V3);
        compilerOptions.setSourceMapDetailLevel(SourceMap.DetailLevel.ALL);

        List<SourceFile> inputs = new ArrayList<>();
        inputs.add(SourceFile.fromCode(jsResourcePath + ".src", cachedCompilation.getInput()));

        List<SourceFile> externs = AbstractCommandLineRunner.getBuiltinExterns(compilerOptions);
        InputStream bcExterns = JavascriptResourceHandler.class.getResourceAsStream("bc-externs.js");
        externs.add(SourceFile.fromInputStream("bc-externs.js", bcExterns, Charset.forName("UTF-8")));

        if (closureExternResourcePath != null) {
            externs.add(SourceFile.fromInputStream(
                    closureExternResourcePath,
                    this.getClass().getResourceAsStream(closureExternResourcePath),
                    Charset.forName("UTF-8")));
        }

        Result result = compiler.compile(externs, inputs, compilerOptions);
        if (result.success) {
            cachedCompilation.setOutput(compiler.toSource());

            if (enableSourceMaps) {
                StringBuilder sb = new StringBuilder();
                result.sourceMap.appendTo(sb, jsResourcePath);
                cachedCompilation.setSourceMap(sb.toString());
            }
        }
        return cachedCompilation;
    }

    private static class JavascriptResourceHandlerErrorManager extends BasicErrorManager {
        private static final BcLogger LOGGER = BcLoggerFactory.getLogger(JavascriptResourceHandlerErrorManager.class);

        @Override
        public void println(CheckLevel checkLevel, JSError jsError) {
            if (checkLevel.equals(CheckLevel.ERROR)) {
                LOGGER.error("%s:%s %s", jsError.sourceName, jsError.getLineNumber(), jsError.description);
            }
        }

        @Override
        protected void printSummary() {
            if (this.getErrorCount() > 0) {
                LOGGER.error("%d error(s)", this.getErrorCount());
            }
        }
    }

}

