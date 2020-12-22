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

import javax.servlet.ServletOutputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;

import static com.google.common.base.Preconditions.checkNotNull;

public class StyleAppendableHandler implements RequestResponseHandler {
    private LessEngine lessCompiler;
    private String css = "";

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, HandlerChain chain) throws Exception {
        response.setContentType("text/css");
        try (ServletOutputStream out = response.getOutputStream()) {
            out.write(css.getBytes());
        }
    }

    public void appendLessResource(String pathInfo) {
        try (InputStream in = this.getClass().getResourceAsStream(pathInfo)) {
            checkNotNull(in, "Could not find resource: " + pathInfo);
            try (StringWriter writer = new StringWriter()) {
                IOUtils.copy(in, writer, StandardCharsets.UTF_8);
                String inputLess = writer.toString();
                String output = lessCompiler().compile(inputLess);
                appendCss(output);
            }
        } catch (Exception ex) {
            throw new BcException("Could not append less resource: " + pathInfo, ex);
        }
    }

    public void appendCssResource(String pathInfo) {
        try (InputStream in = this.getClass().getResourceAsStream(pathInfo)) {
            checkNotNull(in, "Could not find resource: " + pathInfo);
            appendCss(IOUtils.toString(in));
        } catch (IOException ex) {
            throw new BcException("Could not append css resource: " + pathInfo, ex);
        }
    }

    private void appendCss(String output) {
        css += output + "\n";
    }

    private synchronized LessEngine lessCompiler() {
        if (lessCompiler == null) {
            LessOptions options = new LessOptions();
            options.setCompress(true);
            options.setCharset("UTF-8");
            lessCompiler = new LessEngine(options);
        }
        return lessCompiler;
    }
}
