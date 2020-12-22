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
package com.mware.http;

import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import org.apache.commons.io.IOUtils;

import java.io.*;
import java.net.*;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
import java.util.zip.GZIPInputStream;

public abstract class HttpRepository {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(HttpRepository.class);
    private static final int HTTP_TOO_MANY_REQUESTS = 429;
    private static final int DEFAULT_RETRY_COUNT = 2;
    private final Proxy.Type proxyType;
    private final SocketAddress proxyAddress;

    protected HttpRepository(Configuration configuration) {
        String proxyUrlString = configuration.get("http.proxy.url", null);
        if (proxyUrlString != null) {
            try {
                URL proxyUrl = new URL(proxyUrlString);
                proxyType = Proxy.Type.valueOf(proxyUrl.getProtocol().toUpperCase());
                int port = proxyUrl.getPort();
                if (port == -1) {
                    throw new MalformedURLException("Expected port");
                }
                proxyAddress = new InetSocketAddress(proxyUrl.getHost(), port);

                String proxyUsername = configuration.get("http.proxy.username", null);
                String proxyPassword = configuration.get("http.proxy.password", null);
                if (proxyUsername != null && proxyPassword != null) {
                    Authenticator.setDefault(new ProxyAuthenticator(proxyUrl.getHost(), proxyUrl.getPort(), proxyUsername, proxyPassword));
                }

                LOGGER.info("configured to use proxy (type: %s, address: %s, username: %s, w/password: %s)", proxyType, proxyAddress, proxyUsername, proxyPassword != null);
            } catch (MalformedURLException e) {
                throw new BcException("Failed to parse url: " + proxyUrlString, e);
            }

            if (LOGGER.isTraceEnabled()) {
                String packageName = "sun.net.www.protocol.http";
                LOGGER.trace("configuring java.util.Logging -> Log4J logging for: %s", packageName);
                Handler handler = new Handler() {
                    @Override
                    public void publish(LogRecord record) {
                        LOGGER.trace("%s.%s [%s] %s", record.getSourceClassName(), record.getSourceMethodName(), record.getLevel(), record.getMessage());
                    }

                    @Override
                    public void flush() {
                        // do nothing
                    }

                    @Override
                    public void close() throws SecurityException {
                        // do nothing
                    }
                };
                Logger logger = Logger.getLogger(packageName);
                logger.addHandler(handler);
                logger.setLevel(Level.ALL);
            }
        } else {
            proxyType = null;
            proxyAddress = null;
        }
    }

    public byte[] get(String urlString) {
        return get(urlString, DEFAULT_RETRY_COUNT);
    }

    public byte[] get(String urlString, int retryCount) {
        try {
            HttpURLConnection connection = openConnection("GET", urlString);
            return getResponse(connection, urlString, retryCount);
        } catch (Exception ex) {
            throw new BcException("Could not get url: " + urlString, ex);
        }
    }

    private byte[] getResponse(HttpURLConnection connection, String urlString, int retryCount) throws IOException, InterruptedException {
        int responseCode = connection.getResponseCode();
        if (responseCode != HttpURLConnection.HTTP_OK) {
            LOGGER.warn("Failed to get URL: %s", urlString);
            if (retryCount > 0) {
                if (responseCode == HTTP_TOO_MANY_REQUESTS || responseCode == HttpURLConnection.HTTP_FORBIDDEN) {
                    String rateLimitResetString = connection.getHeaderField("X-RateLimit-Reset");
                    if (rateLimitResetString == null) {
                        rateLimitResetString = connection.getHeaderField("Retry-After");
                    }
                    if (rateLimitResetString != null) {
                        long rateLimitReset = Long.parseLong(rateLimitResetString);
                        if (rateLimitReset > 1400000000) {
                            Date resetDate = new Date(rateLimitReset * 1000);
                            long millis = resetDate.getTime() - new Date().getTime();
                            if (millis > 0) {
                                LOGGER.info("Hit rate limit (%s). Waiting until %s or %d seconds.", urlString, resetDate.toString(), millis / 1000);
                                Thread.sleep(millis);
                            } else {
                                LOGGER.info("Hit rate limit (%s). Retrying.", urlString);
                            }
                            return get(urlString, retryCount - 1);
                        } else {
                            LOGGER.info("Hit rate limit (%s). Waiting %d seconds.", urlString, rateLimitReset);
                            Thread.sleep((rateLimitReset + 1) * 1000);
                            return get(urlString, retryCount - 1);
                        }
                    }
                }
            }
            throw new BcException(connection.getResponseMessage() + " (" + responseCode + ")");
        }
        return IOUtils.toByteArray(getResponseStream(connection));
    }

    private HttpURLConnection openConnection(String method, String urlString) throws IOException {
        URL url = new URL(urlString);
        HttpURLConnection connection;
        if (proxyType != null) {
            Proxy proxy = new Proxy(proxyType, proxyAddress);
            connection = (HttpURLConnection) url.openConnection(proxy);
            LOGGER.debug("%s (via proxy) %s", method, urlString);
        } else {
            connection = (HttpURLConnection) url.openConnection();
            LOGGER.debug("%s %s", method, urlString);
        }
        connection.setRequestProperty("Accept-Encoding", "gzip");
        connection.setRequestMethod(method);
        return connection;
    }

    public InputStream getResponseStream(URLConnection connection) throws IOException {
        String contentEncoding = connection.getContentEncoding();
        if (contentEncoding != null && contentEncoding.toLowerCase().contains("gzip")) {
            return new GZIPInputStream(connection.getInputStream());
        }

        // Detect Gzipped content
        byte[] magicNumber = new byte[2];
        PushbackInputStream pushbackInputStream = new PushbackInputStream(connection.getInputStream(), magicNumber.length);
        int read = pushbackInputStream.read(magicNumber);
        pushbackInputStream.unread(magicNumber, 0, read);
        if (read >= magicNumber.length) {
            if ((byte) ((GZIPInputStream.GZIP_MAGIC & 0xff00) >> 8) == magicNumber[1]
                    && (byte) (GZIPInputStream.GZIP_MAGIC & 0xff) == magicNumber[0]) {
                return new GZIPInputStream(pushbackInputStream);
            }
        }

        return pushbackInputStream;
    }

    public byte[] get(String url, Map<String, String> parameters) {
        String completeUrl = createUrl(url, Parameter.toList(parameters));
        return get(completeUrl);
    }

    public byte[] post(String url, Map<String, String> urlParameters, List<Parameter> formParameters) {
        String completeUrl = createUrl(url, Parameter.toList(urlParameters));
        return post(completeUrl, formParameters);
    }

    public byte[] post(String urlString, List<Parameter> formParameters) {
        try {
            byte[] formData = createQueryString(formParameters).getBytes();
            HttpURLConnection connection = openConnection("POST", urlString);
            connection.setDoOutput(true);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            connection.setRequestProperty("charset", "utf-8");
            connection.setRequestProperty("Content-Length", Integer.toString(formData.length));
            connection.setUseCaches(false);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(formData);
            }
            return getResponse(connection, urlString, 0);
        } catch (Exception ex) {
            throw new BcException("Could not post url: " + urlString, ex);
        }
    }

    private String createUrl(String url, List<Parameter> parameters) {
        String queryString = createQueryString(parameters);
        return url + "?" + queryString;
    }

    protected String createQueryString(List<Parameter> parameters) {
        StringBuilder query = new StringBuilder();
        boolean first = true;
        for (Parameter entry : parameters) {
            if (first) {
                first = false;
            } else {
                query.append("&");
            }
            String urlEncodedValue;
            try {
                urlEncodedValue = URLEncoder.encode(entry.getValue(), "utf-8");
            } catch (UnsupportedEncodingException e) {
                throw new BcException("Could not find encoder", e);
            }
            query.append(entry.getName()).append("=").append(urlEncodedValue);
        }
        return query.toString();
    }

    private class ProxyAuthenticator extends Authenticator {
        private String proxyHost;
        private int proxyPort;
        private String username;
        private char[] password;

        public ProxyAuthenticator(String proxyHost, int proxyPort, String username, String password) {
            this.proxyHost = proxyHost;
            this.proxyPort = proxyPort;
            this.username = username;
            this.password = password.toCharArray();
        }

        @Override
        protected PasswordAuthentication getPasswordAuthentication() {
            if (getRequestingHost().equals(proxyHost) && getRequestingPort() == proxyPort) {
                LOGGER.trace("ProxyAuthenticator.getPasswordAuthentication() Responding to proxy authentication request");
                return new PasswordAuthentication(username, password);
            }
            LOGGER.trace("ProxyAuthenticator.getPasswordAuthentication() Ignoring authentication request for: %s:%d", getRequestingHost(), getRequestingPort());
            return null;
        }
    }

    public static class Parameter {
        private final String name;
        private final String value;

        public Parameter(String name, String value) {
            this.name = name;
            this.value = value;
        }

        public String getName() {
            return name;
        }

        public String getValue() {
            return value;
        }

        public static List<Parameter> toList(Map<String, String> parameters) {
            List<Parameter> results = new ArrayList<>();
            for (Map.Entry<String, String> entry : parameters.entrySet()) {
                results.add(new Parameter(entry.getKey(), entry.getValue()));
            }
            return results;
        }
    }
}
