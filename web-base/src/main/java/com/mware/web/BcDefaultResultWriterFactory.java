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
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.config.WebOptions;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.ClientApiObject;
import com.mware.core.model.clientapi.dto.ClientApiWorkspace;
import com.mware.core.model.clientapi.util.ObjectMapperFactory;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.trace.Trace;
import com.mware.core.trace.TraceSpan;
import com.mware.core.user.User;
import com.mware.security.ACLProvider;
import com.mware.web.framework.resultWriters.ResultWriter;
import com.mware.web.framework.resultWriters.ResultWriterBase;
import com.mware.web.framework.resultWriters.ResultWriterFactory;
import com.mware.web.parameterProviders.BcBaseParameterProvider;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;
import org.json.JSONObject;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;

@Singleton
public class BcDefaultResultWriterFactory implements ResultWriterFactory {
    private final String responseHeaderXFrameOptions;
    private ACLProvider aclProvider;
    private WorkspaceRepository workspaceRepository;

    @Inject
    public BcDefaultResultWriterFactory(
            ACLProvider aclProvider,
            WorkspaceRepository workspaceRepository,
            Configuration configuration
    ) {
        this.aclProvider = aclProvider;
        this.workspaceRepository = workspaceRepository;
        this.responseHeaderXFrameOptions = configuration.get(WebOptions.WEB_RESPONSE_HEADER_X_FRAME_OPTIONS);
    }

    @Override
    public ResultWriter createResultWriter(Method handleMethod) {
        return new ResultWriterBase(handleMethod) {
            private boolean resultIsClientApiObject;
            private boolean resultIsInputStream;

            @Override
            protected String getContentType(Method handleMethod) {
                Class returnType = handleMethod.getReturnType();
                if (Iterable.class.isAssignableFrom(returnType)) {
                    Type type = handleMethod.getGenericReturnType();
                    if (type instanceof ParameterizedType) {
                        Type[] actualTypeArguments = ((ParameterizedType) type).getActualTypeArguments();
                        if (actualTypeArguments != null && actualTypeArguments.length == 1) {
                            returnType = (Class) actualTypeArguments[0];
                        }
                    }
                }

                if (JSONObject.class.equals(returnType)) {
                    return "application/json";
                }
                if (ClientApiObject.class.isAssignableFrom(returnType)) {
                    resultIsClientApiObject = true;
                    return "application/json";
                }
                if (InputStream.class.isAssignableFrom(returnType)) {
                    resultIsInputStream = true;
                }
                return super.getContentType(handleMethod);
            }

            @Override
            protected void writeResult(HttpServletRequest request, HttpServletResponse response, Object result)
                    throws IOException {
                if (result != null) {
                    if (!response.containsHeader("X-Frame-Options")) {
                        response.addHeader("X-Frame-Options", responseHeaderXFrameOptions);
                    }
                    if (!response.containsHeader("X-Content-Type-Options")) {
                        response.addHeader("X-Content-Type-Options", "nosniff");
                    }
                    response.setCharacterEncoding("UTF-8");
                    if (resultIsClientApiObject || result instanceof JSONObject) {
                        response.addHeader("Cache-Control", "no-cache, no-store, must-revalidate");
                        response.addHeader("Pragma", "no-cache");
                        response.addHeader("Expires", "0");
                    }
                    if (resultIsClientApiObject) {
                        Object clientApiObject = result;
                        try (TraceSpan ignored = Trace.start("aclProvider.appendACL")) {
                            if (clientApiObject != BcResponse.SUCCESS) {
                                User user = CurrentUser.get(request);
                                String workspaceId;
                                if (clientApiObject instanceof ClientApiWorkspace) {
                                    workspaceId = ((ClientApiWorkspace)clientApiObject).getWorkspaceId();
                                } else {
                                    workspaceId = BcBaseParameterProvider.getActiveWorkspaceIdOrDefault(request, workspaceRepository);
                                }
                                if (StringUtils.isEmpty(workspaceId)) {
                                    workspaceId = user == null ? null : user.getCurrentWorkspaceId();
                                }

                                if (clientApiObject instanceof Iterable) {
                                    Iterable<ClientApiObject> iterable = (Iterable<ClientApiObject>) clientApiObject;
                                    for (ClientApiObject o : iterable) {
                                        aclProvider.appendACL(o, user, workspaceId);
                                    }
                                } else {
                                    clientApiObject = aclProvider.appendACL((ClientApiObject) clientApiObject, user, workspaceId);
                                }
                            }
                        };
                        String jsonObject;
                        try {
                            jsonObject = ObjectMapperFactory.getInstance().writeValueAsString(clientApiObject);
                        } catch (JsonProcessingException e) {
                            throw new BcException("Could not convert clientApiObject to string", e);
                        }
                        response.getWriter().write(jsonObject);
                    } else if (resultIsInputStream) {
                        try (InputStream in = (InputStream) result) {
                            IOUtils.copy(in, response.getOutputStream());
                        } finally {
                            response.flushBuffer();
                        }
                    } else {
                        super.writeResult(request, response, result);
                    }
                }
            }
        };
    }
}
