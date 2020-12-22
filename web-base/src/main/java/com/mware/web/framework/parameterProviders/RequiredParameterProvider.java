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

import com.mware.web.framework.HandlerChain;
import com.mware.web.framework.ParameterValueConverter;
import com.mware.web.framework.WebsterException;
import com.mware.web.framework.annotations.Required;
import com.mware.web.framework.utils.StringUtils;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public class RequiredParameterProvider<T> extends ValueParameterProvider<T> {
    private final Required annotation;

    protected RequiredParameterProvider(Class<?> parameterType, Required annotation, ParameterValueConverter parameterValueConverter) {
        super(parameterType, annotation.name(), parameterValueConverter);
        this.annotation = annotation;
    }

    @Override
    public T getParameter(HttpServletRequest request, HttpServletResponse response, HandlerChain chain) {
        String[] value = getParameterOrAttribute(request);
        if (value == null) {
            throw new WebsterException(String.format("Parameter: '%s' is required in the request", getParameterName()));
        }
        if (!annotation.allowEmpty() && StringUtils.containsAnEmpty(value)) {
            throw new WebsterException(String.format("Parameter: '%s' may not be blank or contain blanks in the request", getParameterName()));
        }
        T result = toParameterType(value);
        if (!isValueValid(result)) {
            throw new WebsterException(String.format("Parameter: '%s' is required in the request", getParameterName()));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private boolean isValueValid(T result) {
        if (result == null) {
            return false;
        }
        if (result.getClass().isArray()) {
            T[] arr = (T[]) result;
            if (arr.length == 0) {
                return false;
            }
            if (arr.length == 1 && arr[0] == null) {
                return false;
            }
        }

        return true;
    }

}
