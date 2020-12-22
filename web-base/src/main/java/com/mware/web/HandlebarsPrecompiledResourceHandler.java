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

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import com.github.jknack.handlebars.io.ClassPathTemplateLoader;
import com.mware.core.exception.BcException;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.web.framework.HandlerChain;
import com.mware.web.framework.RequestResponseHandler;

import javax.servlet.ServletOutputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URL;
import java.util.concurrent.TimeUnit;

public class HandlebarsPrecompiledResourceHandler implements RequestResponseHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(HandlebarsPrecompiledResourceHandler.class);

    private final String path;
    private String cached;
    private Long cachedLastModified;
    private boolean recompileOnModification;

    public HandlebarsPrecompiledResourceHandler(String path, boolean recompileOnModification) {
        this.path = path;
        this.recompileOnModification = recompileOnModification;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, HandlerChain handlerChain) throws Exception {
        try (ServletOutputStream out = response.getOutputStream()) {
            response.setContentType("application/javascript");

            if (shouldRecompile()) {
                if (LOGGER.isDebugEnabled()) {
                    long start = System.nanoTime();
                    compile();
                    LOGGER.debug("Compiled template %s (%d ms)", path, TimeUnit.MILLISECONDS.convert(System.nanoTime() - start, TimeUnit.NANOSECONDS));
                } else {
                    compile();
                }
            }

            out.write(cached.getBytes());
        }
    }

    private boolean shouldRecompile() throws IOException {
        if (cached == null) {
            return true;
        }

        if (recompileOnModification) {
            return (cachedLastModified == null || cachedLastModified != getLastModified());
        }

        return false;
    }

    private long getLastModified() {
        URL url = this.getClass().getResource(path);
        try {
            return url.openConnection().getLastModified();
        } catch (IOException e) {
            throw new BcException("Unable to find template file: " + path, e);
        }
    }

    private void compile() {
        Handlebars handlebars = new Handlebars(new ClassPathTemplateLoader("", ""));
        try {
            Template template = handlebars.compile(path);
            String precompiled = template.toJavaScript();
            StringBuffer buffer = new StringBuffer()
                    .append("define(['handlebars'], function(Handlebars) {\n")
                    .append("    return Handlebars.template(")
                    .append(precompiled)
                    .append("    );\n")
                    .append("});");

            Handlebars.SafeString output = new Handlebars.SafeString(buffer);
            cached = output.toString();
            if (recompileOnModification) {
                cachedLastModified = getLastModified();
            }
        } catch (IOException e) {
            throw new BcException("Unable to precompile template: " + path, e);
        }
    }
}
