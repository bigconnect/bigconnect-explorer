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

import javax.servlet.http.HttpServletRequest;

public abstract class ValueParameterProvider<T> extends ParameterProvider<T> {
    private final Class<?> parameterType;
    private final String parameterName;
    private final ParameterValueConverter parameterValueConverter;

    protected ValueParameterProvider(Class<?> parameterType, String parameterName, ParameterValueConverter parameterValueConverter) {
        this.parameterType = parameterType;
        this.parameterName = parameterName;
        this.parameterValueConverter = parameterValueConverter;
    }

    protected String[] getParameterOrAttribute(final HttpServletRequest request) {
        String[] paramValue = request.getParameterValues(parameterName);
        if (paramValue == null) {
            Object paramValueObject = request.getAttribute(parameterName);
            if (paramValueObject != null) {
                if (paramValueObject.getClass().isArray()) {
                    Object[] arr = (Object[]) paramValueObject;
                    paramValue = new String[arr.length];
                    for (int i = 0; i < arr.length; i++) {
                        paramValue[i] = arr[i] == null ? null : arr[i].toString();
                    }
                } else {
                    paramValue = new String[]{paramValueObject.toString()};
                }
            }
            if (paramValue == null) {
                String headerValue = request.getHeader(parameterName);
                if (headerValue != null) {
                    paramValue = new String[]{headerValue};
                }
            }
        }
        return paramValue;
    }

    public String getParameterName() {
        return parameterName;
    }

    protected T toParameterType(String[] value) {
        return (T) parameterValueConverter.toValue(parameterType, parameterName, value);
    }

    public Class<?> getParameterType() {
        return parameterType;
    }

    public ParameterValueConverter getParameterValueConverter() {
        return parameterValueConverter;
    }
}
