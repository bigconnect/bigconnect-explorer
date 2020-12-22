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

import com.beust.jcommander.Parameter;
import com.beust.jcommander.converters.FileConverter;
import com.mware.core.cmdline.CommandLineTool;

import java.io.File;

public abstract class WebServer extends CommandLineTool {
    public static final int DEFAULT_SERVER_PORT = 8080;
    public static final int DEFAULT_HTTPS_SERVER_PORT = 8443;
    public static final String DEFAULT_CONTEXT_PATH = "/";
    public static final String DEFAULT_KEYSTORE_TYPE = "JKS";

    @Parameter(names = {"--port"}, arity = 1, description = "The port to run the HTTP connector on")
    private int httpPort = DEFAULT_SERVER_PORT;

    @Parameter(names = {"--httpsPort"}, arity = 1, description = "The port to run the HTTPS connector on")
    private int httpsPort = DEFAULT_HTTPS_SERVER_PORT;

    @Parameter(names = {"--keyStoreType"}, arity = 1, description = "Keystore type (JKS, PKCS12)")
    private String keyStoreType = DEFAULT_KEYSTORE_TYPE;

    @Parameter(names = {"--keyStorePath"}, required = false, arity = 1, converter = FileConverter.class, description = "Path to the keystore used for SSL")
    private File keyStorePath;

    @Parameter(names = {"--keyStorePassword"}, required = false, arity = 1, description = "Keystore password")
    private String keyStorePassword;

    @Parameter(names = {"--trustStoreType"}, arity = 1, description = "Truststore type (JKS, PKCS12)")
    private String trustStoreType = DEFAULT_KEYSTORE_TYPE;

    @Parameter(names = {"--trustStorePath"}, arity = 1, converter = FileConverter.class, description = "Path to the truststore used for SSL")
    private File trustStorePath;

    @Parameter(names = {"--trustStorePassword"}, arity = 1, description = "Truststore password")
    private String trustStorePassword;

    @Parameter(names = {"--requireClientCert"}, description = "require client certificate")
    private boolean requireClientCert = false;

    @Parameter(names = {"--wantClientCert"}, description = "want client certificate, but don't require it")
    private boolean wantClientCert = false;

    @Parameter(names = {"--webAppDir"}, required = true, arity = 1, converter = FileConverter.class, description = "Path to the webapp directory")
    private File webAppDir;

    @Parameter(names = {"--contextPath"}, arity = 1, description = "Context path for the webapp")
    private String contextPath = DEFAULT_CONTEXT_PATH;

    public int getHttpPort() {
        return httpPort;
    }

    public int getHttpsPort() {
        return httpsPort;
    }

    public String getKeyStoreType() {
        return keyStoreType;
    }

    public File getKeyStorePath() {
        return keyStorePath;
    }

    public String getKeyStorePassword() {
        return keyStorePassword;
    }

    public String getTrustStoreType() {
        return trustStoreType;
    }

    public File getTrustStorePath() {
        return trustStorePath != null ? trustStorePath : keyStorePath;
    }

    public String getTrustStorePassword() {
        return trustStorePassword != null ? trustStorePassword : keyStorePassword;
    }

    public boolean getRequireClientCert() {
        return requireClientCert;
    }

    public boolean getWantClientCert() {
        return wantClientCert;
    }

    public String getContextPath() {
        return contextPath;
    }

    public File getWebAppDir() {
        return webAppDir;
    }
}
