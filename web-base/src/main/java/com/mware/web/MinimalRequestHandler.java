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

import com.google.common.base.Preconditions;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.web.framework.App;
import com.mware.web.framework.RequestResponseHandler;

import javax.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.ResourceBundle;

/**
 * This is a handler that provides common helper methods, and only depends on {@link Configuration}
 * to be injected.
 */
public abstract class MinimalRequestHandler implements RequestResponseHandler {
    private static final String LOCALE_LANGUAGE_PARAMETER = "localeLanguage";
    private static final String LOCALE_COUNTRY_PARAMETER = "localeCountry";
    private static final String LOCALE_VARIANT_PARAMETER = "localeVariant";

    private final Configuration configuration;

    protected MinimalRequestHandler(Configuration configuration) {
        this.configuration = configuration;
    }

    protected Configuration getConfiguration() {
        return configuration;
    }

    protected WebApp getWebApp(HttpServletRequest request) {
        return (WebApp) App.getApp(request);
    }

    protected Locale getLocale(HttpServletRequest request) {
        String language = getOptionalParameter(request, LOCALE_LANGUAGE_PARAMETER);
        String country = getOptionalParameter(request, LOCALE_COUNTRY_PARAMETER);
        String variant = getOptionalParameter(request, LOCALE_VARIANT_PARAMETER);

        if (language != null) {
            return WebApp.getLocal(language, country, variant);
        }
        return request.getLocale();
    }

    protected ResourceBundle getBundle(HttpServletRequest request) {
        WebApp webApp = getWebApp(request);
        Locale locale = getLocale(request);
        return webApp.getBundle(locale);
    }

    protected String getString(HttpServletRequest request, String key) {
        ResourceBundle resourceBundle = getBundle(request);
        return resourceBundle.getString(key);
    }

    /**
     * Attempts to extract the specified parameter from the provided request
     *
     * @param request       The request instance containing the parameter
     * @param parameterName The name of the parameter to extract
     * @return The value of the specified parameter
     * @throws RuntimeException Thrown if the required parameter was not in the request
     */
    protected String getRequiredParameter(final HttpServletRequest request, final String parameterName) {
        Preconditions.checkNotNull(request, "The provided request was invalid");

        return getParameter(request, parameterName, false);
    }

    protected String[] getOptionalParameterArray(HttpServletRequest request, String parameterName) {
        Preconditions.checkNotNull(request, "The provided request was invalid");

        return getParameterValues(request, parameterName, true);
    }

    protected String[] getRequiredParameterArray(HttpServletRequest request, String parameterName) {
        Preconditions.checkNotNull(request, "The provided request was invalid");

        return getParameterValues(request, parameterName, false);
    }

    protected Long getOptionalParameterLong(final HttpServletRequest request, final String parameterName, long defaultValue) {
        Long defaultValueLong = defaultValue;
        return getOptionalParameterLong(request, parameterName, defaultValueLong);
    }

    protected Long getOptionalParameterLong(final HttpServletRequest request, final String parameterName, Long defaultValue) {
        String val = getOptionalParameter(request, parameterName);
        if (val == null || val.length() == 0) {
            return defaultValue;
        }
        return Long.parseLong(val);
    }

    protected Integer getOptionalParameterInt(final HttpServletRequest request, final String parameterName, Integer defaultValue) {
        String val = getOptionalParameter(request, parameterName);
        if (val == null || val.length() == 0) {
            return defaultValue;
        }
        return Integer.parseInt(val);
    }

    protected boolean getOptionalParameterBoolean(final HttpServletRequest request, final String parameterName, boolean defaultValue) {
        Boolean defaultValueBoolean = defaultValue;
        return getOptionalParameterBoolean(request, parameterName, defaultValueBoolean);
    }

    protected Boolean getOptionalParameterBoolean(final HttpServletRequest request, final String parameterName, Boolean defaultValue) {
        String val = getOptionalParameter(request, parameterName);
        if (val == null || val.length() == 0) {
            return defaultValue;
        }
        return Boolean.parseBoolean(val);
    }

    protected Double getOptionalParameterDouble(final HttpServletRequest request, final String parameterName, Double defaultValue) {
        String val = getOptionalParameter(request, parameterName);
        if (val == null || val.length() == 0) {
            return defaultValue;
        }
        return Double.parseDouble(val);
    }

    protected Float getOptionalParameterFloat(final HttpServletRequest request, final String parameterName, Float defaultValue) {
        String val = getOptionalParameter(request, parameterName);
        if (val == null || val.length() == 0) {
            return defaultValue;
        }
        return Float.parseFloat(val);
    }

    /**
     * Attempts to extract the specified parameter from the provided request and convert it to a long value
     *
     * @param request       The request instance containing the parameter
     * @param parameterName The name of the parameter to extract
     * @return The long value of the specified parameter
     * @throws RuntimeException Thrown if the required parameter was not in the request
     */
    protected long getRequiredParameterAsLong(final HttpServletRequest request, final String parameterName) {
        return Long.parseLong(getRequiredParameter(request, parameterName));
    }

    /**
     * Attempts to extract the specified parameter from the provided request and convert it to a int value
     *
     * @param request       The request instance containing the parameter
     * @param parameterName The name of the parameter to extract
     * @return The int value of the specified parameter
     * @throws RuntimeException Thrown if the required parameter was not in the request
     */
    protected int getRequiredParameterAsInt(final HttpServletRequest request, final String parameterName) {
        return Integer.parseInt(getRequiredParameter(request, parameterName));
    }

    /**
     * Attempts to extract the specified parameter from the provided request and convert it to a double value
     *
     * @param request       The request instance containing the parameter
     * @param parameterName The name of the parameter to extract
     * @return The double value of the specified parameter
     * @throws RuntimeException Thrown if the required parameter was not in the request
     */
    protected double getRequiredParameterAsDouble(final HttpServletRequest request, final String parameterName) {
        return Double.parseDouble(getRequiredParameter(request, parameterName));
    }

    /**
     * Attempts to extract the specified parameter from the provided request, if available
     *
     * @param request       The request instance containing the parameter
     * @param parameterName The name of the parameter to extract
     * @return The value of the specified parameter if found, null otherwise
     */
    protected String getOptionalParameter(final HttpServletRequest request, final String parameterName) {
        Preconditions.checkNotNull(request, "The provided request was invalid");

        return getParameter(request, parameterName, true);
    }

    protected String[] getOptionalParameterAsStringArray(final HttpServletRequest request, final String parameterName) {
        Preconditions.checkNotNull(request, "The provided request was invalid");

        return getParameterValues(request, parameterName, true);
    }

    protected String[] getParameterValues(final HttpServletRequest request, final String parameterName, final boolean optional) {
        String[] paramValues = request.getParameterValues(parameterName);

        if (paramValues == null) {
            Object value = request.getAttribute(parameterName);
            if (value instanceof String[]) {
                paramValues = (String[]) value;
            }
        }

        if (paramValues == null) {
            if (!optional) {
                throw new BcException(String.format("Parameter: '%s' is required in the request", parameterName));
            }
            return null;
        }

        return paramValues;
    }

    private String getParameter(final HttpServletRequest request, final String parameterName, final boolean optional) {
        String paramValue = request.getParameter(parameterName);
        if (paramValue == null) {
            Object paramValueObject = request.getAttribute(parameterName);
            if (paramValueObject != null) {
                paramValue = paramValueObject.toString();
            }
            if (paramValue == null) {
                if (!optional) {
                    throw new BcException(String.format("Parameter: '%s' is required in the request", parameterName));
                }
                return null;
            }
        }
        return paramValue;
    }

    protected String getAttributeString(final HttpServletRequest request, final String name) {
        String attr = (String) request.getAttribute(name);
        if (attr != null) {
            return attr;
        }
        return getRequiredParameter(request, name);
    }
}
