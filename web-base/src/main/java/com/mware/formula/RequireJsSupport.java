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
package com.mware.formula;

import com.mware.core.exception.BcException;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import org.apache.commons.io.IOUtils;
import org.mozilla.javascript.Context;
import org.mozilla.javascript.Function;
import org.mozilla.javascript.Scriptable;
import org.mozilla.javascript.ScriptableObject;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

@SuppressWarnings("unused")
public class RequireJsSupport extends ScriptableObject {
    private static final long serialVersionUID = 1L;
    private static BcLogger LOGGER = BcLoggerFactory.getLogger(RequireJsSupport.class);

    @Override
    public String getClassName() {
        return "RequireJsSupport";
    }

    public static void print(Context cx, Scriptable thisObj, Object[] args, Function funObj) {
        for (Object arg : args) {
            LOGGER.debug(Context.toString(arg));
        }
    }

    public static void consoleWarn(Context cx, Scriptable thisObj, Object[] args, Function funObj) {
        for (Object arg : args) {
            LOGGER.warn(Context.toString(arg));
        }
    }

    public static void consoleError(Context cx, Scriptable thisObj, Object[] args, Function funObj) {
        for (Object arg : args) {
            LOGGER.error(Context.toString(arg));
        }
    }

    public static void load(Context cx, Scriptable thisObj, Object[] args, Function funObj) throws IOException {
        RequireJsSupport shell = (RequireJsSupport) getTopLevelScope(thisObj);
        for (Object arg : args) {
            shell.processSource(cx, Context.toString(arg));
        }
    }

    public static String readFully(Context cx, Scriptable thisObj, Object[] args, Function funObj) throws IOException {
        RequireJsSupport shell = (RequireJsSupport) getTopLevelScope(thisObj);
        if (args.length == 1) {
            return shell.getFileContents(Context.toString(args[0]));
        }
        return null;
    }

    public static String transformFilePath(String filename) {
        return filename.startsWith("../") ? (filename.replace("../", "")) : ("jsc/" + filename);
    }

    private void processSource(Context cx, String filename) throws IOException {
        String fileContents = getFileContents(filename);
        cx.evaluateString(this, fileContents, filename, 1, null);
    }

    private String getFileContents(String file) {
        String transformed = transformFilePath(file);
        LOGGER.debug("reading file: %s", transformed);
        try (InputStream is = RequireJsSupport.class.getResourceAsStream(transformed)) {
            if (is == null) {
                throw new BcException("File not found: " + transformed);
            }
            return IOUtils.toString(is, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new BcException("Could not read file contents: " + transformed, ex);
        }
    }
}

