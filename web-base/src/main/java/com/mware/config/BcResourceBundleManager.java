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
package com.mware.config;

import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URL;
import java.net.URLConnection;
import java.util.*;

public class BcResourceBundleManager {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(BcResourceBundleManager.class);
    public static final String RESOURCE_BUNDLE_BASE_NAME = "MessageBundle";
    private Properties unlocalizedProperties;
    private Map<Locale, Properties> localizedProperties;

    public BcResourceBundleManager() {
        unlocalizedProperties = new Properties();
        localizedProperties = new HashMap<>();
    }

    public void register(InputStream inputStream) throws IOException {
        unlocalizedProperties.load(new InputStreamReader(inputStream, "UTF-8"));
    }

    public void register(InputStream inputStream, Locale locale) throws IOException {
        Properties properties = localizedProperties.get(locale);
        if (properties == null) {
            properties = new Properties();
            localizedProperties.put(locale, properties);
        }
        properties.load(new InputStreamReader(inputStream, "UTF-8"));
    }

    public ResourceBundle getBundle() {
        Locale defaultLocale = Locale.getDefault();
        LOGGER.debug("returning a bundle configured for the default locale: %s ", defaultLocale);
        return createBundle(defaultLocale);
    }

    public ResourceBundle getBundle(Locale locale) {
        LOGGER.debug("returning a bundle configured for locale: %s ", locale);
        return createBundle(locale);
    }

    private ResourceBundle createBundle(Locale locale) {
        Properties properties = new Properties();
        properties.putAll(unlocalizedProperties);
        properties.putAll(getLocaleProperties(locale));
        return new BcResourceBundle(properties, getRootBundle(locale));
    }

    private Properties getLocaleProperties(Locale locale) {
        Properties properties = new Properties();

        Properties languageProperties = localizedProperties.get(new Locale(locale.getLanguage()));
        if (languageProperties != null) {
            properties.putAll(languageProperties);
        }

        Properties languageCountryProperties = localizedProperties.get(new Locale(locale.getLanguage(), locale.getCountry()));
        if (languageCountryProperties != null) {
            properties.putAll(languageCountryProperties);
        }

        Properties languageCountryVariantProperties = localizedProperties.get(new Locale(locale.getLanguage(), locale.getCountry(), locale.getVariant()));
        if (languageCountryVariantProperties != null) {
            properties.putAll(languageCountryVariantProperties);
        }

        return properties;
    }

    private ResourceBundle getRootBundle(Locale locale) {
        return ResourceBundle.getBundle(RESOURCE_BUNDLE_BASE_NAME, locale, new UTF8PropertiesControl());
    }

    /**
     * use an InputStreamReader to allow for UTF-8 values in property file bundles, otherwise use the base class implementation
     */
    private class UTF8PropertiesControl extends ResourceBundle.Control {
        public ResourceBundle newBundle(String baseName, Locale locale, String format, ClassLoader loader, boolean reload)
                throws IllegalAccessException, InstantiationException, IOException {
            if (format.equals("java.properties")) {
                String resourceName = toResourceName(toBundleName(baseName, locale), "properties");
                InputStream inputStream = null;
                if (reload) {
                    URL url = loader.getResource(resourceName);
                    if (url != null) {
                        URLConnection urlConnection = url.openConnection();
                        if (urlConnection != null) {
                            urlConnection.setUseCaches(false);
                            inputStream = urlConnection.getInputStream();
                        }
                    }
                } else {
                    inputStream = loader.getResourceAsStream(resourceName);
                }

                if (inputStream != null) {
                    try {
                        return new PropertyResourceBundle(new InputStreamReader(inputStream, "UTF-8"));
                    } finally {
                        inputStream.close();
                    }
                }
            }
            return super.newBundle(baseName, locale, format, loader, reload);
        }
    }
}
