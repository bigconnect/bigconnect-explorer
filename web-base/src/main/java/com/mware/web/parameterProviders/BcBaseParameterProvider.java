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

import com.google.common.base.Preconditions;
import com.mware.config.WebOptions;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcAccessDeniedException;
import com.mware.core.exception.BcException;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.user.User;
import com.mware.ge.SecurityGeException;
import com.mware.web.CurrentUser;
import com.mware.web.WebApp;
import com.mware.web.framework.App;
import com.mware.web.framework.parameterProviders.ParameterProvider;

import javax.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.ResourceBundle;
import java.util.TimeZone;

public abstract class BcBaseParameterProvider<T> extends ParameterProvider<T> {
    public static final String BC_WORKSPACE_ID_HEADER_NAME = "BC-Workspace-Id";
    public static final String BC_SOURCE_GUID_HEADER_NAME = "BC-Source-Guid";
    private static final String LOCALE_LANGUAGE_PARAMETER = "localeLanguage";
    private static final String LOCALE_COUNTRY_PARAMETER = "localeCountry";
    private static final String LOCALE_VARIANT_PARAMETER = "localeVariant";
    private static final String BC_TIME_ZONE_HEADER_NAME = "BC-TimeZone";
    private static final String TIME_ZONE_ATTRIBUTE_NAME = "timeZone";
    private static final String TIME_ZONE_PARAMETER_NAME = "timeZone";
    public static final String WORKSPACE_ID_ATTRIBUTE_NAME = "workspaceId";
    private final Configuration configuration;

    public BcBaseParameterProvider(Configuration configuration) {
        this.configuration = configuration;
    }

    public static String getActiveWorkspaceIdOrDefault(
            final HttpServletRequest request,
            final WorkspaceRepository workspaceRepository
    ) {
        String workspaceId = (String) request.getAttribute(WORKSPACE_ID_ATTRIBUTE_NAME);
        if (workspaceId == null || workspaceId.trim().length() == 0) {
            workspaceId = request.getHeader(BC_WORKSPACE_ID_HEADER_NAME);
            if (workspaceId == null || workspaceId.trim().length() == 0) {
                workspaceId = getOptionalParameter(request, WORKSPACE_ID_ATTRIBUTE_NAME);
                if (workspaceId == null || workspaceId.trim().length() == 0) {
                    return null;
                }
            }
        }

        User user = CurrentUser.get(request);
        try {
            if (!workspaceRepository.hasReadPermissions(workspaceId, user)) {
                throw new BcAccessDeniedException(
                        "You do not have access to workspace: " + workspaceId,
                        user,
                        workspaceId
                );
            }
        } catch (SecurityGeException e) {
            throw new BcAccessDeniedException(
                    "Error getting access to requested workspace: " + workspaceId,
                    user,
                    workspaceId
            );
        }

        return workspaceId;
    }

    protected static String getActiveWorkspaceId(
            final HttpServletRequest request,
            final WorkspaceRepository workspaceRepository
    ) {
        String workspaceId = getActiveWorkspaceIdOrDefault(request, workspaceRepository);
        if (workspaceId == null || workspaceId.trim().length() == 0) {
            throw new BcException(BC_WORKSPACE_ID_HEADER_NAME + " is a required header.");
        }
        return workspaceId;
    }

    protected static String getSourceGuid(final HttpServletRequest request) {
        return request.getHeader(BC_SOURCE_GUID_HEADER_NAME);
    }

    public static String getOptionalParameter(final HttpServletRequest request, final String parameterName) {
        Preconditions.checkNotNull(request, "The provided request was invalid");
        return getParameter(request, parameterName, true);
    }

    public static String[] getOptionalParameterArray(HttpServletRequest request, String parameterName) {
        Preconditions.checkNotNull(request, "The provided request was invalid");

        return getParameterValues(request, parameterName, true);
    }

    public static Integer getOptionalParameterInt(
            final HttpServletRequest request,
            final String parameterName,
            Integer defaultValue
    ) {
        String val = getOptionalParameter(request, parameterName);
        if (val == null || val.length() == 0) {
            return defaultValue;
        }
        return Integer.parseInt(val);
    }

    public static String[] getOptionalParameterAsStringArray(
            final HttpServletRequest request,
            final String parameterName
    ) {
        Preconditions.checkNotNull(request, "The provided request was invalid");
        return getParameterValues(request, parameterName, true);
    }

    public static Float getOptionalParameterFloat(
            final HttpServletRequest request,
            final String parameterName,
            Float defaultValue
    ) {
        String val = getOptionalParameter(request, parameterName);
        if (val == null || val.length() == 0) {
            return defaultValue;
        }
        return Float.parseFloat(val);
    }

    public static Double getOptionalParameterDouble(
            final HttpServletRequest request,
            final String parameterName,
            Double defaultValue
    ) {
        String val = getOptionalParameter(request, parameterName);
        if (val == null || val.length() == 0) {
            return defaultValue;
        }
        return Double.parseDouble(val);
    }

    protected static String[] getParameterValues(
            final HttpServletRequest request,
            final String parameterName,
            final boolean optional
    ) {
        String[] paramValues = request.getParameterValues(parameterName);

        if (paramValues == null) {
            Object value = request.getAttribute(parameterName);
            if (value instanceof String[]) {
                paramValues = (String[]) value;
            }
        }

        if (paramValues == null) {
            if (!optional) {
                throw new RuntimeException(String.format("Parameter: '%s' is required in the request", parameterName));
            }
            return null;
        }

        return paramValues;
    }

    public static String[] getRequiredParameterArray(HttpServletRequest request, String parameterName) {
        Preconditions.checkNotNull(request, "The provided request was invalid");
        return getParameterValues(request, parameterName, false);
    }

    public static String getRequiredParameter(final HttpServletRequest request, final String parameterName) {
        String result = getOptionalParameter(request, parameterName);
        if (result == null) {
            throw new BcException("parameter " + parameterName + " is required");
        }
        return result;
    }

    protected static String getParameter(
            final HttpServletRequest request,
            final String parameterName,
            final boolean optional
    ) {
        String paramValue = request.getParameter(parameterName);
        if (paramValue == null) {
            Object paramValueObject = request.getAttribute(parameterName);
            if (paramValueObject != null) {
                paramValue = paramValueObject.toString();
            }
            if (paramValue == null) {
                if (!optional) {
                    throw new BcException(String.format(
                            "Parameter: '%s' is required in the request",
                            parameterName
                    ));
                }
                return null;
            }
        }
        return paramValue;
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

    protected String getTimeZone(final HttpServletRequest request) {
        String timeZone = (String) request.getAttribute(TIME_ZONE_ATTRIBUTE_NAME);
        if (timeZone == null || timeZone.trim().length() == 0) {
            timeZone = request.getHeader(BC_TIME_ZONE_HEADER_NAME);
            if (timeZone == null || timeZone.trim().length() == 0) {
                timeZone = getOptionalParameter(request, TIME_ZONE_PARAMETER_NAME);
                if (timeZone == null || timeZone.trim().length() == 0) {
                    timeZone = this.configuration.get(WebOptions.DEFAULT_TIME_ZONE);
                }
            }
        }
        return timeZone;
    }
}
