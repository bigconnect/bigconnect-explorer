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
package com.mware.web.parameterProviders;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.user.UserRepository;
import com.mware.web.WebConfiguration;
import com.mware.web.framework.HandlerChain;
import com.mware.web.framework.parameterProviders.ParameterProvider;
import com.mware.web.framework.parameterProviders.ParameterProviderFactory;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;

@Singleton
public class JustificationTextParameterProviderFactory extends ParameterProviderFactory<String> {
    public static final String JUSTIFICATION_TEXT = "justificationText";
    private final ParameterProvider<String> parameterProvider;

    @Inject
    public JustificationTextParameterProviderFactory(UserRepository userRepository, final Configuration configuration) {
        final boolean isJustificationRequired = WebConfiguration.justificationRequired(configuration);

        parameterProvider = new BcBaseParameterProvider<String>(configuration) {
            @Override
            public String getParameter(HttpServletRequest request, HttpServletResponse response, HandlerChain chain) {
                String propertyName = getOptionalParameter(request, "propertyName");
                if (propertyName != null && propertyName.length() > 0) {
                    boolean isComment = BcSchema.COMMENT.isSameName(propertyName);
                    String sourceInfo = getOptionalParameter(request, "sourceInfo");
                    return getJustificationText(isComment, sourceInfo, request);
                } else {
                    return justificationParameter(isJustificationRequired, request);
                }
            }

            public String getJustificationText(boolean isComment, String sourceInfo, HttpServletRequest request) {
                return justificationParameter(isJustificationRequired(isComment, sourceInfo), request);
            }

            public boolean isJustificationRequired(boolean isComment, String sourceInfo) {
                return !isComment && sourceInfo == null && isJustificationRequired;
            }

            private String justificationParameter(boolean required, HttpServletRequest request) {
                return required ?
                        getRequiredParameter(request, JUSTIFICATION_TEXT) :
                        getOptionalParameter(request, JUSTIFICATION_TEXT);
            }
        };
    }

    @Override
    public boolean isHandled(Method handleMethod, Class<? extends String> parameterType, Annotation[] parameterAnnotations) {
        return getJustificationTextAnnotation(parameterAnnotations) != null;
    }

    @Override
    public ParameterProvider<String> createParameterProvider(Method handleMethod, Class<?> parameterType, Annotation[] parameterAnnotations) {
        return parameterProvider;
    }

    private static JustificationText getJustificationTextAnnotation(Annotation[] annotations) {
        for (Annotation annotation : annotations) {
            if (annotation instanceof JustificationText) {
                return (JustificationText) annotation;
            }
        }
        return null;
    }
}
