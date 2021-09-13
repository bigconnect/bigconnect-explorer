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

import com.mware.config.WebOptions;
import com.mware.core.config.Configuration;
import com.mware.core.model.properties.types.BcPropertyBase;
import com.mware.core.model.properties.types.MetadataBcProperty;

import java.util.HashMap;
import java.util.Map;

public class WebConfiguration {
    public static final Map<String, String> DEFAULTS = new HashMap<>();

    public static class PropertyMetadata {
        private String name;
        private String messageKey;
        private String dataType;

        public PropertyMetadata(BcPropertyBase property, String messageKey, String dataType) {
            this(property.getPropertyName(), messageKey, dataType);
        }

        public PropertyMetadata(MetadataBcProperty property, String messageKey, String dataType) {
            this(property.getMetadataKey(), messageKey, dataType);
        }

        public PropertyMetadata(String name, String messageKey, String dataType) {
            this.name = name;
            this.messageKey = messageKey;
            this.dataType = dataType;
        }

        public String getName() {
            return name;
        }

        public String getMessageKey() {
            return messageKey;
        }

        public String getDataType() {
            return dataType;
        }
    }

    public enum MapProvider {
        BING("BingMaps"),
        OSM("osm"),
        ARCGIS93REST("ArcGIS93Rest");

        private String string;

        private MapProvider(String string) {
            this.string = string;
        }

        @Override
        public String toString() {
            return string;
        }
    }

    public enum JustificationFieldValidation {
        REQUIRED,
        OPTIONAL,
        NONE;
    }

    public static JustificationFieldValidation getJustificationFieldValidation(Configuration configuration) {
        return JustificationFieldValidation.valueOf(configuration.get(WebOptions.FIELD_JUSTIFICATION_VALIDATION));
    }

    public static boolean justificationRequired(Configuration configuration) {
        return getJustificationFieldValidation(configuration).equals(JustificationFieldValidation.REQUIRED);
    }
}
