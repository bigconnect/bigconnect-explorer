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
package com.mware.web.framework.handlers;

import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.web.framework.HandlerChain;
import com.mware.web.framework.RequestResponseHandler;
import org.apache.commons.io.IOUtils;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.*;
import java.net.*;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;

public class CLStaticHttpHandler implements RequestResponseHandler {
    private static BcLogger LOGGER = BcLoggerFactory.getLogger(CLStaticHttpHandler.class);

    private static final String SLASH_STR = "/";
    private static final String EMPTY_STR = "";

    protected static final String CHECK_NON_SLASH_TERMINATED_FOLDERS_PROP =
            CLStaticHttpHandler.class.getName() + ".check-non-slash-terminated-folders";

    /**
     * <tt>true</tt> (default) if we want to double-check the resource requests,
     * that don't have terminating slash if they represent a folder and try
     * to retrieve a welcome resource from the folder.
     */
    private static final boolean CHECK_NON_SLASH_TERMINATED_FOLDERS =
            System.getProperty(CHECK_NON_SLASH_TERMINATED_FOLDERS_PROP) == null ||
                    Boolean.getBoolean(CHECK_NON_SLASH_TERMINATED_FOLDERS_PROP);

    private final ClassLoader classLoader;
    // path prefixes to be used
    private final Set<String> docRoots = new HashSet<>();
    private volatile boolean isFileCacheEnabled = true;

    public CLStaticHttpHandler(final ClassLoader classLoader, final String... docRoots) {
        if (classLoader == null) {
            throw new IllegalArgumentException("ClassLoader can not be null");
        }

        this.classLoader = classLoader;
        if (docRoots.length > 0) {
            for (String docRoot : docRoots) {
                if (!docRoot.endsWith("/")) {
                    throw new IllegalArgumentException("Doc root should end with slash ('/')");
                }
            }

            this.docRoots.addAll(Arrays.asList(docRoots));
        } else {
            this.docRoots.add("/");
        }
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, HandlerChain chain) throws Exception {
        final String uri = getRelativeURI(request);

        if (uri == null || !handleInternal(uri, request, response)) {
            onMissingResource(request, response);
        }
    }

    private boolean handleInternal(String resourcePath, HttpServletRequest request, HttpServletResponse response) throws Exception {
        URLConnection urlConnection = null;
        InputStream urlInputStream = null;

        if (resourcePath.startsWith(SLASH_STR)) {
            resourcePath = resourcePath.substring(1);
        }

        boolean mayBeFolder = true;

        if (resourcePath.length() == 0 || resourcePath.endsWith("/")) {
            resourcePath += "index.html";
            mayBeFolder = false;
        }

        URL url = lookupResource(resourcePath);

        if (url == null && mayBeFolder && CHECK_NON_SLASH_TERMINATED_FOLDERS) {
            // some ClassLoaders return null if a URL points to a folder.
            // So try to add index.html to double-check.
            // For example null will be returned for a folder inside a jar file.
            url = lookupResource(resourcePath + "/index.html");
            mayBeFolder = false;
        }

        File fileResource = null;
        String filePath = null;
        boolean found = false;

        if (url != null) {
            // url may point to a folder or a file
            if ("file".equals(url.getProtocol())) {
                final File file = new File(url.toURI());

                if (file.exists()) {
                    if (file.isDirectory()) {
                        final File welcomeFile = new File(file, "/index.html");
                        if (welcomeFile.exists() && welcomeFile.isFile()) {
                            fileResource = welcomeFile;
                            filePath = welcomeFile.getPath();
                            found = true;
                        }
                    } else {
                        fileResource = file;
                        filePath = file.getPath();
                        found = true;
                    }
                }
            } else {
                urlConnection = url.openConnection();
                if ("jar".equals(url.getProtocol())) {
                    final JarURLConnection jarUrlConnection = (JarURLConnection) urlConnection;
                    JarEntry jarEntry = jarUrlConnection.getJarEntry();
                    final JarFile jarFile = jarUrlConnection.getJarFile();
                    // check if this is not a folder
                    // we can't rely on jarEntry.isDirectory() because of http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=6233323
                    InputStream is = null;

                    if (jarEntry.isDirectory() ||
                            (is = jarFile.getInputStream(jarEntry)) == null) { // it's probably a folder
                        final String welcomeResource =
                                jarEntry.getName().endsWith("/") ?
                                        jarEntry.getName() + "index.html" :
                                        jarEntry.getName() + "/index.html";

                        jarEntry = jarFile.getJarEntry(welcomeResource);
                        if (jarEntry != null) {
                            is = jarFile.getInputStream(jarEntry);
                        }
                    }

                    if (is != null) {
                        urlInputStream = new JarURLInputStream(jarUrlConnection,
                                jarFile, is);

                        assert jarEntry != null;
                        filePath = jarEntry.getName();
                        found = true;
                    } else {
                        closeJarFileIfNeeded(jarUrlConnection, jarFile);
                    }
                } else if ("bundle".equals(url.getProtocol())) { // OSGi resource
                    // it might be either folder or file
                    if (mayBeFolder &&
                            urlConnection.getContentLength() <= 0) { // looks like a folder?
                        // check if there's a welcome resource
                        final URL welcomeUrl = classLoader.getResource(url.getPath() + "/index.html");
                        if (welcomeUrl != null) {
                            url = welcomeUrl;
                            urlConnection = welcomeUrl.openConnection();
                        }
                    }

                    found = true;
                } else {
                    found = true;
                }
            }
        }

        if (!found) {
            if (LOGGER.isDebugEnabled()) {
                LOGGER.debug("Resource not found {0}", resourcePath);
            }
            return false;
        }

        assert url != null;

        // If it's not HTTP GET - return method is not supported status
        if (!"GET".equals(request.getMethod())) {
            if (LOGGER.isDebugEnabled()) {
                LOGGER.debug("Resource found {0}, but HTTP method {1} is not allowed",
                        resourcePath, request.getMethod());
            }
            response.setStatus(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
            response.setHeader("Allow", "GET");
            return true;
        }

        pickupContentType(response,
                filePath != null ? filePath : url.getPath());

        if (fileResource != null) {
            sendFile(response, fileResource);
        } else {
            assert urlConnection != null;

            // if it's not a jar file - we don't know what to do with that
            // so not adding it to the file cache
            if ("jar".equals(url.getProtocol())) {
                final File jarFile = getJarFile(
                        // we need that because url.getPath() may have url encoded symbols,
                        // which are getting decoded when calling uri.getPath()
                        new URI(url.getPath()).getPath()
                );
            }

            sendResource(response,
                    urlInputStream != null ?
                            urlInputStream :
                            urlConnection.getInputStream());
        }

        return true;
    }

    private static void sendResource(HttpServletResponse response, InputStream inputStream) throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        response.addDateHeader("Date", System.currentTimeMillis());
        IOUtils.copy(inputStream, response.getOutputStream());
    }

    protected void onMissingResource(final HttpServletRequest request, final HttpServletResponse response)
            throws Exception {
        response.sendError(404);
    }

    protected String getRelativeURI(final HttpServletRequest request) throws Exception {
        String uri = request.getRequestURI();
        if (uri.contains("..")) {
            return null;
        }

        final String resourcesContextPath = request.getContextPath();
        if (resourcesContextPath != null && !resourcesContextPath.isEmpty()) {
            if (!uri.startsWith(resourcesContextPath)) {
                return null;
            }

            uri = uri.substring(resourcesContextPath.length());
        }

        return uri;
    }

    private URL lookupResource(String resourcePath) {
        final String[] docRootsLocal = docRoots.toArray(new String[0]);
        if (docRootsLocal == null || docRootsLocal.length == 0) {
            if (LOGGER.isDebugEnabled()) {
                LOGGER.debug("No doc roots registered -> resource {0} is not found ", resourcePath);
            }

            return null;
        }

        for (String docRoot : docRootsLocal) {
            if (SLASH_STR.equals(docRoot)) {
                docRoot = EMPTY_STR;
            } else if (docRoot.startsWith(SLASH_STR)) {
                docRoot = docRoot.substring(1);
            }

            final String fullPath = docRoot + resourcePath;
            final URL url = classLoader.getResource(fullPath);

            if (url != null) {
                return url;
            }
        }

        return null;
    }

    static class JarURLInputStream extends java.io.FilterInputStream {

        private final JarURLConnection jarConnection;
        private final JarFile jarFile;

        JarURLInputStream(final JarURLConnection jarConnection,
                          final JarFile jarFile,
                          final InputStream src) {
            super(src);
            this.jarConnection = jarConnection;
            this.jarFile = jarFile;
        }

        @Override
        public void close() throws IOException {
            try {
                super.close();
            } finally {
                closeJarFileIfNeeded(jarConnection, jarFile);
            }
        }
    }

    private static void closeJarFileIfNeeded(final JarURLConnection jarConnection,
                                             final JarFile jarFile) throws IOException {
        if (!jarConnection.getUseCaches()) {
            jarFile.close();
        }
    }

    private File getJarFile(final String path) throws MalformedURLException, FileNotFoundException {
        final int jarDelimIdx = path.indexOf("!/");
        if (jarDelimIdx == -1) {
            throw new MalformedURLException("The jar file delimeter were not found");
        }

        final File file = new File(path.substring(0, jarDelimIdx));

        if (!file.exists() || !file.isFile()) {
            throw new FileNotFoundException("The jar file was not found");
        }

        return file;
    }

    protected static void pickupContentType(final HttpServletResponse response,
                                            final String path) {
        if (!response.containsHeader("Content-Type")) {
            int dot = path.lastIndexOf('.');

            if (dot > 0) {
                String ext = path.substring(dot + 1);
                String ct = MimeType.get(ext);
                if (ct != null) {
                    response.setContentType(ct);
                }
            } else {
                response.setContentType(MimeType.get("html"));
            }
        }
    }

    public static void sendFile(final HttpServletResponse response, final File file)
            throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);

        // In case this sendFile(...) is called directly by user - pickup the content-type
        pickupContentType(response, file.getPath());

        final long length = file.length();
        response.setContentLengthLong(length);
        response.addDateHeader("Date", System.currentTimeMillis());

        final OutputStream outputStream = response.getOutputStream();
        IOUtils.copy(new FileInputStream(file), outputStream);
    }
}
