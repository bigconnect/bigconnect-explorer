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

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class BcResourceBundle extends ResourceBundle {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(BcResourceBundle.class);
    private static final Pattern ALIAS_KEY_PATTERN = Pattern.compile("@\\{([\\w\\.]+)\\}");
    private Properties properties;
    private ResourceBundle rootResourceBundle;
    private Properties aliasedProperties = new Properties();

    public BcResourceBundle(Properties properties, ResourceBundle rootResourceBundle) {
        this.properties = properties;
        this.rootResourceBundle = rootResourceBundle;
        this.aliasedProperties = getAliasProperties();

    }

    @Override
    protected Object handleGetObject(String key) {
        String value = aliasedProperties.getProperty(key);
        if (value != null) {
            return value;
        }
        value = properties.getProperty(key);
        if (value != null) {
            return value;
        }
        return rootResourceBundle.getString(key);
    }

    @Override
    public Enumeration<String> getKeys() {
        Set keys = new HashSet();
        keys.addAll(aliasedProperties.keySet());
        keys.addAll(properties.keySet());
        keys.addAll(rootResourceBundle.keySet());
        return Collections.enumeration(keys);
    }

    protected Properties getAliasProperties() {
        Properties properties = new Properties();
        Enumeration<String> keys = getKeys();

        while (keys.hasMoreElements()) {
            String key = keys.nextElement();
            String value = handleGetObject(key).toString();
            Matcher m = ALIAS_KEY_PATTERN.matcher(value);

            while (m.find(0)) {
                String aliasKey = m.group(1);

                try {
                    aliasKey = (String) handleGetObject(aliasKey);
                } catch (MissingResourceException ex) {
                    LOGGER.debug("No key for alias: %s", aliasKey);
                } catch (Exception ex) {
                    throw ex;
                }

                String aliasedValue = m.replaceFirst(aliasKey);
                properties.setProperty(key, aliasedValue);

                m = ALIAS_KEY_PATTERN.matcher(aliasedValue);
            }
        }

        return properties;
    }
}
