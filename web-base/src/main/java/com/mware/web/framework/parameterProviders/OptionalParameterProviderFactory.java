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
package com.mware.web.framework.parameterProviders;

import com.mware.web.framework.ParameterValueConverter;
import com.mware.web.framework.WebsterException;
import com.mware.web.framework.annotations.Optional;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;

public class OptionalParameterProviderFactory<T> extends ValueParameterProviderFactory<T> {
    @Override
    public boolean isHandled(Method handleMethod, Class parameterType, Annotation[] parameterAnnotations) {
        return getOptionalAnnotation(parameterAnnotations) != null;
    }

    @Override
    public ParameterProvider<T> createParameterProvider(Method handleMethod, Class parameterType, Annotation[] parameterAnnotations) {
        Optional optionalAnnotation = getOptionalAnnotation(parameterAnnotations);
        if (optionalAnnotation == null) {
            throw new WebsterException("Could not find optional annotation");
        }
        ParameterValueConverter parameterValueConverter = createParameterValueConverter(optionalAnnotation.parameterValueConverter());
        String defaultValue = getDefaultValueFromAnnotation(optionalAnnotation);
        return new OptionalParameterProvider<>(parameterType, optionalAnnotation, parameterValueConverter, defaultValue);
    }

    private String getDefaultValueFromAnnotation(Optional optionalAnnotation) {
        if (optionalAnnotation.defaultValue().equals(Optional.NOT_SET)) {
            return null;
        }
        return optionalAnnotation.defaultValue();
    }

    private static Optional getOptionalAnnotation(Annotation[] annotations) {
        for (Annotation annotation : annotations) {
            if (annotation instanceof Optional) {
                return (Optional) annotation;
            }
        }
        return null;
    }
}
