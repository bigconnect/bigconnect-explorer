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
package com.mware.web.webEventListeners;

import com.mware.core.config.Configuration;
import com.mware.core.exception.BcAccessDeniedException;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.web.BadRequestException;
import com.mware.web.BcResponse;
import com.mware.web.ResponseTypes;
import com.mware.web.WebApp;
import org.json.JSONArray;
import org.json.JSONObject;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

public class ErrorHandlerWebEventListener extends DefaultWebEventListener {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(ErrorHandlerWebEventListener.class);
    public static final int PRIORITY = -1000;

    public static final long DEFAULT_MULTIPART_MAX_FILE_SIZE = 1024 * 1024 * 512;
    public static final long DEFAULT_MULTIPART_MAX_REQUEST_SIZE = 1024 * 1024 * 1024;

    @Override
    public void error(WebApp app, HttpServletRequest request, HttpServletResponse response, Throwable e) throws ServletException, IOException {
        if (e.getCause() instanceof BcResourceNotFoundException) {
            handleNotFound(response, (BcResourceNotFoundException) e.getCause());
            return;
        }
        if (e.getCause() instanceof BadRequestException) {
            handleBadRequest(response, (BadRequestException) e.getCause());
            return;
        }
        if (e.getCause() instanceof BcAccessDeniedException) {
            handleAccessDenied(response, (BcAccessDeniedException) e.getCause());
            return;
        }
        if (handleIllegalState(request, response, e)) {
            return;
        }
        if (isClientAbortException(e)) {
            return;
        }

        String message = String.format("Unhandled exception for %s %s", request.getMethod(), request.getRequestURI());
        if (app.isDevModeEnabled()) {
            throw new ServletException(message, e);
        } else {
            LOGGER.warn(message, e);
            response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
        }
    }

    private boolean isClientAbortException(Throwable e) {
        // Need to use a string here because ClientAbortException is a Tomcat specific exception
        if (e.getClass().getName().equals("org.apache.catalina.connector.ClientAbortException")) {
            return true;
        }
        if (e.getCause() != null) {
            return isClientAbortException(e.getCause());
        }
        return false;
    }

    private boolean handleIllegalState(HttpServletRequest request, HttpServletResponse response, Throwable e) throws IOException {
        boolean isMultipart = request.getContentType() != null && request.getContentType().startsWith("multipart/");
        if (isMultipart) {
            String TOMCAT_MAX_REQUEST_MESSAGE = "$SizeLimitExceededException";
            String TOMCAT_MAX_FILE_MESSAGE = "$FileSizeLimitExceededException";
            Throwable cause = e.getCause() == null ? e : e.getCause();
            String message = cause == null ? null : cause.getMessage();

            if (message != null && (
                    message.contains(TOMCAT_MAX_FILE_MESSAGE) || message.contains(TOMCAT_MAX_REQUEST_MESSAGE))) {
                long bytesToMB = 1024 * 1024;
                String errorMessage = String.format(
                        "Uploaded file(s) are too large. " +
                                "Limits are set to %dMB per file and %dMB total for all files",
                        DEFAULT_MULTIPART_MAX_FILE_SIZE / bytesToMB,
                        DEFAULT_MULTIPART_MAX_REQUEST_SIZE / bytesToMB
                );
                LOGGER.error(message, cause);
                handleBadRequest(response, new BadRequestException("files", errorMessage));
                return true;
            }
        }
        return false;
    }

    private void handleBadRequest(HttpServletResponse response, BadRequestException badRequestException) {
        LOGGER.error("bad request", badRequestException);
        JSONObject error = new JSONObject();
        error.put(badRequestException.getParameterName(), badRequestException.getMessage());
        if (badRequestException.getInvalidValues() != null) {
            JSONArray values = new JSONArray();
            for (String v : badRequestException.getInvalidValues()) {
                values.put(v);
            }
            error.put("invalidValues", values);
        }
        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        BcResponse.configureResponse(ResponseTypes.JSON_OBJECT, response, error);
    }

    private void handleAccessDenied(HttpServletResponse response, BcAccessDeniedException accessDenied) throws IOException {
        response.sendError(HttpServletResponse.SC_FORBIDDEN, accessDenied.getMessage());
    }

    private void handleNotFound(HttpServletResponse response, BcResourceNotFoundException notFoundException) throws IOException {
        response.sendError(HttpServletResponse.SC_NOT_FOUND, notFoundException.getMessage());
    }

    @Override
    public int getPriority() {
        return PRIORITY;
    }
}
