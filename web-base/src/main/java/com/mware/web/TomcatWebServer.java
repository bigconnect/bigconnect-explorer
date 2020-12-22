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
import org.apache.catalina.Context;
import org.apache.catalina.connector.Connector;
import org.apache.catalina.startup.Tomcat;
import org.apache.catalina.webresources.StandardRoot;
import org.apache.coyote.ProtocolHandler;
import org.apache.coyote.http11.AbstractHttp11Protocol;
import org.apache.tomcat.util.scan.StandardJarScanner;

import java.io.IOException;
import java.net.DatagramSocket;
import java.net.ServerSocket;

public class TomcatWebServer extends WebServer {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(TomcatWebServer.class);
    private static final String COMPRESSABLE_MIME_TYPES = String.join(",",
            "application/json",
            "text/html",
            "text/plain",
            "text/xml",
            "application/xhtml+xml",
            "text/css",
            "application/javascript",
            "image/svg+xml",
            "text/javascript"
    );

    private Tomcat tomcat;

    public static void main(String[] args) throws Exception {
        main(new TomcatWebServer(), args, false);
    }

    @Override
    protected int run() throws Exception {
        if(!available(super.getHttpPort())) {
            throw new BcException("ERROR: Port "+super.getHttpPort()+" is already in use");
        }

        tomcat = new Tomcat();
        tomcat.setPort(super.getHttpPort());

        Connector httpConnector = tomcat.getConnector();
        httpConnector.setAttribute("relaxedQueryChars", "<>[\\\\]^`{|}");
        httpConnector.setAttribute("relaxedPathChars", "<>[\\\\]^`{|}");


        ProtocolHandler handler = httpConnector.getProtocolHandler();
        if (handler instanceof AbstractHttp11Protocol) {
            AbstractHttp11Protocol protocol = (AbstractHttp11Protocol) handler;
            setupCompression(protocol);
            protocol.setMaxSwallowSize(-1);
        }

        Context context = tomcat.addWebapp(this.getContextPath(), getWebAppDir().getAbsolutePath());

        // don't scan classpath for web components to avoid benign log warnings
        StandardJarScanner jarScanner = new StandardJarScanner();
        jarScanner.setScanClassPath(false);
        context.setJarScanner(jarScanner);

        // establish default caching settings to avoid benign log warnings
        StandardRoot webRoot = new StandardRoot(context);
        webRoot.setCacheMaxSize(100000);
        webRoot.setCachingAllowed(true);
        context.setResources(webRoot);

        LOGGER.info("getSessionTimeout() is %d minutes", context.getSessionTimeout());

        System.out.println("configuring app with basedir: " + getWebAppDir().getAbsolutePath());

        tomcat.start();
        tomcat.getServer().await();

        return 0;
    }

    protected Tomcat getServer() {
        return tomcat;
    }

    private void setupSslHandling(Connector connector) {
        connector.setPort(super.getHttpsPort());
        connector.setSecure(true);
        connector.setScheme("https");
        connector.setAttribute("keystoreFile", super.getKeyStorePath());
        connector.setAttribute("keystorePass", super.getKeyStorePassword());
        connector.setAttribute("keystoreType", super.getKeyStoreType());
        connector.setAttribute("truststoreFile", super.getTrustStorePath());
        connector.setAttribute("truststorePass", super.getTrustStorePassword());
        connector.setAttribute("truststoreType", super.getTrustStoreType());
        connector.setAttribute("sslProtocol", "TLS");
        connector.setAttribute("SSLEnabled", true);
    }

    public void setupClientCertHandling(Connector httpsConnector) {
        if (getRequireClientCert() && getWantClientCert()) {
            throw new IllegalArgumentException("Choose only one of --requireClientCert and --wantClientCert");
        }

        String clientAuthSetting = "false";
        if (getRequireClientCert()) {
            clientAuthSetting = "true";
        } else if (getWantClientCert()) {
            clientAuthSetting = "want";
        }

        httpsConnector.setAttribute("clientAuth", clientAuthSetting);
        LOGGER.info("clientAuth certificate handling set to %s", clientAuthSetting);
    }

    public void setupCompression(AbstractHttp11Protocol<?> protocol) {
        protocol.setCompression("on");
        protocol.setCompressableMimeType(COMPRESSABLE_MIME_TYPES);
        protocol.setMaxSwallowSize(-1);
        LOGGER.info("compression set for mime types: %s", COMPRESSABLE_MIME_TYPES);
    }

    public static boolean available(int port) {
        ServerSocket ss = null;
        DatagramSocket ds = null;
        try {
            ss = new ServerSocket(port);
            ss.setReuseAddress(true);
            ds = new DatagramSocket(port);
            ds.setReuseAddress(true);
            return true;
        } catch (IOException e) {
        } finally {
            if (ds != null) {
                ds.close();
            }

            if (ss != null) {
                try {
                    ss.close();
                } catch (IOException e) {
                    /* should not be thrown */
                }
            }
        }

        return false;
    }
}
