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

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;

import javax.servlet.http.HttpServletRequest;
import java.util.StringJoiner;

import static org.apache.commons.lang.StringUtils.trimToNull;

@Singleton
public class ContentSecurityPolicy {
    protected static final String CONTENT_SECURITY_POLICY = "web.response.header.Content-Security-Policy";
    protected static final String PREFIX = CONTENT_SECURITY_POLICY + ".";
    protected static final String APPEND = ".append";

    protected static final String DEFAULT_SRC = "default-src";
    protected static final String SCRIPT_SRC = "script-src";
    protected static final String STYLE_SRC = "style-src";
    protected static final String IMG_SRC = "img-src";
    protected static final String CONNECT_SRC = "connect-src";
    protected static final String FONT_SRC = "font-src";
    protected static final String OBJECT_SRC = "object-src";
    protected static final String MEDIA_SRC = "media-src";
    protected static final String FRAME_SRC = "frame-src";
    protected static final String CHILD_SRC = "child-src";
    protected static final String FRAME_ANCESTORS = "frame-ancestors";
    protected static final String FORM_ACTION = "form-action";
    protected static final String SANDBOX = "sandbox";
    protected static final String PLUGIN_TYPES = "plugin-types";
    protected static final String REPORT_URI = "report-uri";

    protected static final String SELF = "'self'";
    protected static final String UNSAFE_INLINE = "'unsafe-inline'";
    protected static final String UNSAFE_EVAL = "'unsafe-eval'";
    protected static final String ALL = "*";
    protected static final String NONE = "'none'";
    protected static final String DATA = "data:";
    protected static final String BLOB = "blob:";


    private final Configuration configuration;
    private String policyTemplate;

    @Inject
    public ContentSecurityPolicy(Configuration configuration) {
        this.configuration = configuration;
    }

    public String generatePolicy(HttpServletRequest request) {
        if (policyTemplate == null) {
            policyTemplate = configuration.get(CONTENT_SECURITY_POLICY, null);
            if (policyTemplate == null) {
                policyTemplate = buildPolicyTemplate();
            }
        }

        String url = request.getRequestURL().toString()
                .replace("https://", "")
                .replace("http://", "");

        return policyTemplate.replace("{{url}}", url);
    }

    private String buildPolicyTemplate() {
        StringBuilder sb = new StringBuilder();

        appendPart(sb, DEFAULT_SRC, SELF);
        appendPart(sb, SCRIPT_SRC, SELF, UNSAFE_INLINE, UNSAFE_EVAL, BLOB);

        appendPart(sb, STYLE_SRC, SELF, UNSAFE_INLINE);
        appendPart(sb, IMG_SRC, ALL, DATA, BLOB);

        // Need to specify websocket path since self implies same protocol and will block
        // websocket requests otherwise.
        appendPart(sb, CONNECT_SRC, SELF, "wss://{{url}}");

        appendPart(sb, FONT_SRC, SELF, DATA);
        appendPart(sb, FRAME_ANCESTORS, NONE);
        appendPart(sb, FORM_ACTION, SELF);
        appendPart(sb, OBJECT_SRC);
        appendPart(sb, MEDIA_SRC);
        appendPart(sb, FRAME_SRC);
        appendPart(sb, CHILD_SRC);
        appendPart(sb, PLUGIN_TYPES);
        appendPart(sb, SANDBOX);
        appendPart(sb, REPORT_URI, true, "/csp-report");

        return sb.toString();
    }

    private void appendPart(StringBuilder sb, String name, String... defaultValues) {
        appendPart(sb, name, false, defaultValues);
    }

    private void appendPart(StringBuilder sb, String name, boolean last, String... defaultValues) {
        String defaultValue = String.join(" ", defaultValues);
        StringJoiner values = new StringJoiner(" ");
        String value = trimNoSemicolon(configuration.get(PREFIX + name, defaultValue));
        if (value != null) {
            values.add(value);
        }
        String append = trimNoSemicolon(configuration.get(PREFIX + name + APPEND, null));
        if (append != null) {
            values.add(append);
        }

        if (values.length() > 0) {
            sb.append(name);
            sb.append(" ");
            sb.append(values);
            sb.append(";");

            if (!last) {
                sb.append(" ");
            }
        }
    }

    private String trimNoSemicolon(String str) {
        return trimToNull(str == null ? null : str.replaceAll("\\s*;\\s*$", ""));
    }
}
