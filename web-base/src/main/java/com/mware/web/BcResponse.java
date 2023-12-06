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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.google.common.base.Preconditions;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.ClientApiObject;
import com.mware.core.model.clientapi.util.ObjectMapperFactory;
import com.mware.web.model.ClientApiSuccess;
import org.apache.commons.codec.binary.Hex;
import org.apache.commons.io.IOUtils;
import org.json.JSONArray;
import org.json.JSONObject;

import javax.servlet.ServletOutputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;

public class BcResponse {
    public static final int EXPIRES_1_HOUR = 60 * 60;
    public static final int EXPIRES_10_SECONDS = 10;
    public static final ClientApiSuccess SUCCESS = new ClientApiSuccess();
    private final HttpServletRequest request;
    private final HttpServletResponse response;

    public BcResponse(HttpServletRequest request, HttpServletResponse response) {
        this.request = request;
        this.response = response;
    }

    public void respondWithClientApiObject(ClientApiObject obj) throws IOException {
        if (obj == null) {
            respondWithNotFound();
            return;
        }
        try {
            String jsonObject = ObjectMapperFactory.getInstance().writeValueAsString(obj);
            configureResponse(ResponseTypes.JSON_OBJECT, response, jsonObject);
        } catch (JsonProcessingException e) {
            throw new BcException("Could not write json", e);
        }
    }

    public void respondWithNotFound() throws IOException {
        response.sendError(HttpServletResponse.SC_NOT_FOUND);
    }

    public void respondWithNotFound(String message) throws IOException {
        response.sendError(HttpServletResponse.SC_NOT_FOUND, message);
    }

    public void respondWithBadRequest(final String parameterName, final String errorMessage, final List<String> invalidValues) throws IOException {
        JSONObject error = new JSONObject();
        error.put(parameterName, errorMessage);
        if (invalidValues != null) {
            JSONArray values = new JSONArray();
            for (String v : invalidValues) {
                values.put(v);
            }
            error.put("invalidValues", values);
        }
        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        respondWithJson(error);
    }

    public void respondWithBadRequest(final String message) {
        JSONObject error = new JSONObject();
        error.put("error", message);
        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        respondWithJson(error);
    }

    public void respondWithSuccessJson() {
        JSONObject successJson = new JSONObject();
        successJson.put("success", true);
        respondWithJson(successJson);
    }

    public void respondWithJson(JSONObject jsonObject) {
        configureResponse(ResponseTypes.JSON_OBJECT, response, jsonObject);
    }

    public void respondWithHtml(final String html) {
        configureResponse(ResponseTypes.HTML, response, html);
    }

    public String generateETag(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            byte[] md5 = digest.digest(data);
            return Hex.encodeHexString(md5);
        } catch (NoSuchAlgorithmException e) {
            throw new BcException("Could not find MD5", e);
        }
    }

    public void addETagHeader(String eTag) {
        response.setHeader("ETag", "\"" + eTag + "\"");
    }

    public boolean testEtagHeaders(String eTag) throws IOException {
        String ifNoneMatch = request.getHeader("If-None-Match");
        if (ifNoneMatch != null) {
            if (ifNoneMatch.startsWith("\"") && ifNoneMatch.length() > 2) {
                ifNoneMatch = ifNoneMatch.substring(1, ifNoneMatch.length() - 1);
            }
            if (eTag.equalsIgnoreCase(ifNoneMatch)) {
                addETagHeader(eTag);
                respondWithNotModified();
                return true;
            }
        }

        return false;
    }

    public void respondWithNotModified() throws IOException {
        response.sendError(HttpServletResponse.SC_NOT_MODIFIED);
    }

    public void write(byte[] bytes) throws IOException {
        ServletOutputStream out = response.getOutputStream();
        out.write(bytes);
        out.close();
    }

    public void write(InputStream in) throws IOException {
        ServletOutputStream out = response.getOutputStream();
        IOUtils.copy(in, out);
        out.close();
    }

    public void setContentType(String contentType) {
        response.setContentType(contentType);
    }

    public void setHeader(String name, String value) {
        response.setHeader(name, value);
    }

    public void addHeader(String name, String value) {
        response.addHeader(name, value);
    }

    public void setMaxAge(int numberOfSeconds) {
        response.setHeader("Cache-Control", "max-age=" + numberOfSeconds);
    }

    public OutputStream getOutputStream() {
        try {
            return response.getOutputStream();
        } catch (IOException e) {
            throw new BcException("Could not get response output stream", e);
        }
    }

    public void flushBuffer() {
        try {
            response.flushBuffer();
        } catch (IOException e) {
            throw new BcException("Could not flush response buffer");
        }
    }

    public void setStatus(int statusCode) {
        response.setStatus(statusCode);
    }

    public void setContentLength(int length) {
        response.setContentLength(length);
    }

    public void setCharacterEncoding(String charset) {
        response.setCharacterEncoding(charset);
    }

    public static void configureResponse(final ResponseTypes type, final HttpServletResponse response, final Object responseData) {
        Preconditions.checkNotNull(response, "The provided response was invalid");
        Preconditions.checkNotNull(responseData, "The provided data was invalid");

        try {
            switch (type) {
                case JSON_OBJECT:
                    response.setContentType("application/json");
                    response.setCharacterEncoding("UTF-8");
                    response.getWriter().write(responseData.toString());
                    break;
                case JSON_ARRAY:
                    response.setContentType("application/json");
                    response.setCharacterEncoding("UTF-8");
                    response.getWriter().write(responseData.toString());
                    break;
                case PLAINTEXT:
                    response.setContentType("text/plain");
                    response.setCharacterEncoding("UTF-8");
                    response.getWriter().write(responseData.toString());
                    break;
                case HTML:
                    response.setContentType("text/html");
                    response.setCharacterEncoding("UTF-8");
                    response.getWriter().write(responseData.toString());
                    break;
                default:
                    throw new BcException("Unsupported response type encountered");
            }

            if (response.getWriter().checkError()) {
                throw new ConnectionClosedException();
            }
        } catch (IOException e) {
            throw new BcException("Error occurred while writing response", e);
        }
    }

    public HttpServletResponse getHttpServletResponse() {
        return response;
    }
}
