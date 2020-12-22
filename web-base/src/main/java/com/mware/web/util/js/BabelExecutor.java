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
package com.mware.web.util.js;

import com.mware.core.exception.BcException;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import org.apache.commons.io.IOUtils;

import javax.script.*;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

public class BabelExecutor {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(BabelExecutor.class);

    private ScriptEngine engine;
    private Bindings bindings;
    private Future babelFuture;
    private ExecutorService executorService;

    public BabelExecutor() {
        this.executorService = Executors.newSingleThreadExecutor(new ThreadFactory() {
            @Override
            public Thread newThread(Runnable r) {
                Thread thread = new Thread(r);
                thread.setPriority(Thread.MIN_PRIORITY);
                return thread;
            }
        });
        this.babelFuture = this.executorService.submit(() -> initializeBabel());
    }

    public <T> Future<T> submit(Callable<T> task) {
        return this.executorService.submit(() -> {
            this.babelFuture.get();
            return task.call();
        });
    }

    public synchronized void compileWithSharedEngine(CachedCompilation cachedCompilation, SourceMapType sourceMapType) throws ScriptException {
        ScriptEngine engine = this.engine;
        Bindings bindings = this.bindings;

        LOGGER.debug("Compiling jsx with babel: " + cachedCompilation.getResourcePath());

        bindings.put("input", cachedCompilation.getInput());
        bindings.put("resourcePath", cachedCompilation.getResourcePath());
        bindings.put("sourcePath", cachedCompilation.getPath() + ".src");
        bindings.put("sourceMapType", sourceMapJsType(sourceMapType));

        Object output = engine.eval(getTransformJavaScript(), bindings);
        Bindings result = (Bindings) output;

        if (result.containsKey("error")) {
            throw new BcException((String) result.get("error"));
        }

        if (sourceMapType == SourceMapType.EXTERNAL) {
            String sourceMap = (String) result.get("sourceMap");
            cachedCompilation.setSourceMap(sourceMap);
        }
        cachedCompilation.setOutput((String) result.get("code"));
    }

    private String getTransformJavaScript() {
        String transform = null;
        try (StringWriter writer = new StringWriter()) {
            IOUtils.copy(getClass().getResourceAsStream("babel-transform.js"), writer, StandardCharsets.UTF_8);
            transform = writer.toString();
        } catch (IOException e) {
            throw new BcException("Unable to read babel transformer");
        }
        if (transform == null) {
            throw new BcException("Babel configuration not found");
        }
        return transform;
    }

    private Object sourceMapJsType(SourceMapType sourceMapType) {
        switch (sourceMapType) {
            case EXTERNAL: return true;
            case INLINE: return "inline";
            case NONE:
            default: return false;
        }
    }

    private void initializeBabel() {
        try {
            long start = System.nanoTime();
            LOGGER.info("Initializing Babel Transformer...");
            InputStreamReader babelReader = new InputStreamReader(getClass().getResourceAsStream("babel.js"));

            ScriptEngine engine = new ScriptEngineManager().getEngineByName("nashorn");
            if (engine == null) {
                throw new BcException("JavaScript Engine \"nashorn\" not found. Unable to compile jsx");
            }
            SimpleBindings bindings = new SimpleBindings();

            engine.eval(babelReader, bindings);
            LOGGER.info("Babel Transformer initialized in %d seconds...", TimeUnit.NANOSECONDS.toSeconds(System.nanoTime() - start));
            this.engine = engine;
            this.bindings = bindings;
        } catch (Exception e) {
            LOGGER.error("Unable to initialize babel transpiler: %s", e.getMessage());
            throw new BcException("Unable to initialize babel transpiler", e);
        }
    }

}
