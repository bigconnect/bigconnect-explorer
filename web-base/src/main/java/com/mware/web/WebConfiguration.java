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

import com.google.common.base.Joiner;
import com.mware.core.config.Configuration;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.types.BcPropertyBase;
import com.mware.core.model.properties.types.MetadataBcProperty;

import java.util.HashMap;
import java.util.Map;

public class WebConfiguration {
    public static final String PREFIX = Configuration.WEB_CONFIGURATION_PREFIX;
    public static final String BOLT_SERVER_ADDRESS = PREFIX + "bolt.server";
    public static final String CYPHER_LAB = PREFIX + "cypher.lab";
    public static final String THROTTLE_MESSAGING_SECONDS = PREFIX + "throttle.messaging.seconds";
    public static final String CACHE_VERTEX_LRU_EXPIRATION_SECONDS = PREFIX + "cache.vertex.lru.expiration.seconds";
    public static final String CACHE_VERTEX_MAX_SIZE = PREFIX + "cache.vertex.max_size";
    public static final String CACHE_EDGE_LRU_EXPIRATION_SECONDS = PREFIX + "cache.edge.lru.expiration.seconds";
    public static final String CACHE_EDGE_MAX_SIZE = PREFIX + "cache.edge.max_size";
    public static final String VERTEX_LOAD_RELATED_MAX_BEFORE_PROMPT = PREFIX + "vertex.loadRelatedMaxBeforePrompt";
    public static final String VERTEX_LOAD_RELATED_MAX_FORCE_SEARCH = PREFIX + "vertex.loadRelatedMaxForceSearch";
    public static final String VERTEX_RELATIONSHIPS_MAX_PER_SECTION = PREFIX + "vertex.relationships.maxPerSection";
    public static final String DETAIL_HISTORY_STACK_MAX = PREFIX + "detail.history.stack.max";
    public static final String MAX_SELECTION_PARAGRAPHS_FOR_TERM_POPOVER = PREFIX + "detail.text.popover.maxSelectionParagraphs";
    public static final String MAX_TEXT_LENGTH = PREFIX + "detail.text.maxTextLength";
    public static final String FIELD_JUSTIFICATION_VALIDATION = PREFIX + "field.justification.validation";
    public static final String SEARCH_DISABLE_WILDCARD_SEARCH = PREFIX + "search.disableWildcardSearch";
    public static final String SEARCH_EXACT_MATCH = PREFIX + "search.exactMatch";
    public static final String NOTIFICATIONS_LOCAL_AUTO_DISMISS_SECONDS = PREFIX + "notifications.local.autoDismissSeconds";
    public static final String NOTIFICATIONS_SYSTEM_AUTO_DISMISS_SECONDS = PREFIX + "notifications.system.autoDismissSeconds";
    public static final String NOTIFICATIONS_USER_AUTO_DISMISS_SECONDS = PREFIX + "notifications.user.autoDismissSeconds";
    public static final String TYPEAHEAD_PROPERTIES_MAX_ITEMS = PREFIX + "typeahead.properties.maxItems";
    public static final String TYPEAHEAD_CONCEPTS_MAX_ITEMS = PREFIX + "typeahead.concepts.maxItems";
    public static final String TYPEAHEAD_EDGE_LABELS_MAX_ITEMS = PREFIX + "typeahead.edgeLabels.maxItems";
    public static final String PROPERTIES_MULTIVALUE_DEFAULT_VISIBLE_COUNT = PREFIX + "properties.multivalue.defaultVisibleCount";
    public static final String PROPERTIES_METADATA_PROPERTY_NAMES = PREFIX + "properties.metadata.propertyNames";
    public static final String PROPERTIES_METADATA_PROPERTY_NAMES_DISPLAY = PREFIX + "properties.metadata.propertyNamesDisplay";
    public static final String PROPERTIES_METADATA_PROPERTY_NAMES_TYPE = PREFIX + "properties.metadata.propertyNamesType";
    public static final String MAP_PROVIDER = PREFIX + "map.provider";
    public static final String MAP_PROVIDER_OSM_URL = PREFIX + "map.provider.osm.url";
    public static final String LOGIN_SHOW_POWERED_BY = PREFIX + "login.showPoweredBy";
    public static final String FORMATS_DATE_DATEDISPLAY = PREFIX + "formats.date.dateDisplay";
    public static final String FORMATS_DATE_TIMEDISPLAY = PREFIX + "formats.date.timeDisplay";
    public static final String FORMATS_DATE_SHOW_TIMEZONE = PREFIX + "formats.date.showTimezone";
    public static final String SHOW_VERSION_COMMENTS = PREFIX + "showVersionComments";
    public static final String SHOW_VISIBILITY_IN_DETAILS_PANE = PREFIX + "showVisibilityInDetailsPane";
    public static final String DATE_DISPLAY = PREFIX + "date.default.display";
    public static final PropertyMetadata PROPERTY_METADATA_SOURCE_TIMEZONE = new PropertyMetadata("sourceTimezone",
            "properties.metadata.label.source_timezone",
            "timezone");
    public static final PropertyMetadata PROPERTY_METADATA_MODIFIED_DATE = new PropertyMetadata(BcSchema.MODIFIED_DATE,
            "properties.metadata.label.modified_date",
            "datetime");
    public static final PropertyMetadata PROPERTY_METADATA_MODIFIED_BY = new PropertyMetadata(BcSchema.MODIFIED_BY,
            "properties.metadata.label.modified_by",
            "user");
    public static final PropertyMetadata PROPERTY_METADATA_STATUS = new PropertyMetadata("sandboxStatus",
            "properties.metadata.label.status",
            "sandboxStatus");
    public static final PropertyMetadata PROPERTY_METADATA_KEY = new PropertyMetadata("key",
            "properties.metadata.label.key",
            "string");

    public static final Map<String, String> DEFAULTS = new HashMap<>();

    static {
        DEFAULTS.put(BOLT_SERVER_ADDRESS, "localhost:10242");

        // To display exact date or relative date
        DEFAULTS.put(DATE_DISPLAY, "relative");

        DEFAULTS.put(LOGIN_SHOW_POWERED_BY, "false");
        DEFAULTS.put(SHOW_VERSION_COMMENTS, "true");

        DEFAULTS.put(FORMATS_DATE_DATEDISPLAY, "YYYY-MM-DD");
        DEFAULTS.put(FORMATS_DATE_TIMEDISPLAY, "HH:mm");
        DEFAULTS.put(FORMATS_DATE_SHOW_TIMEZONE, "true");

        DEFAULTS.put(SHOW_VISIBILITY_IN_DETAILS_PANE, "true");

        DEFAULTS.put(THROTTLE_MESSAGING_SECONDS, "2");

        // Local cache rules for vertices / edges (per workspace)
        DEFAULTS.put(CACHE_VERTEX_LRU_EXPIRATION_SECONDS, Integer.toString(10 * 60));
        DEFAULTS.put(CACHE_VERTEX_MAX_SIZE, "500");
        DEFAULTS.put(CACHE_EDGE_LRU_EXPIRATION_SECONDS, Integer.toString(10 * 60));
        DEFAULTS.put(CACHE_EDGE_MAX_SIZE, "250");

        // Load related vertices thresholds
        DEFAULTS.put(VERTEX_LOAD_RELATED_MAX_BEFORE_PROMPT, "50");
        DEFAULTS.put(VERTEX_LOAD_RELATED_MAX_FORCE_SEARCH, "250");

        DEFAULTS.put(VERTEX_RELATIONSHIPS_MAX_PER_SECTION, "5");

        DEFAULTS.put(DETAIL_HISTORY_STACK_MAX, "5");
        DEFAULTS.put(MAX_SELECTION_PARAGRAPHS_FOR_TERM_POPOVER, "5");
        DEFAULTS.put(MAX_TEXT_LENGTH, "1500000");

        // Justification field validation
        DEFAULTS.put(FIELD_JUSTIFICATION_VALIDATION, JustificationFieldValidation.OPTIONAL.toString());

        // Search
        DEFAULTS.put(SEARCH_DISABLE_WILDCARD_SEARCH, "false");
        DEFAULTS.put(SEARCH_EXACT_MATCH, "false");

        // Notifications
        DEFAULTS.put(NOTIFICATIONS_LOCAL_AUTO_DISMISS_SECONDS, "10");
        DEFAULTS.put(NOTIFICATIONS_SYSTEM_AUTO_DISMISS_SECONDS, "10");
        DEFAULTS.put(NOTIFICATIONS_USER_AUTO_DISMISS_SECONDS, "10");

        DEFAULTS.put(TYPEAHEAD_CONCEPTS_MAX_ITEMS, "-1");
        DEFAULTS.put(TYPEAHEAD_PROPERTIES_MAX_ITEMS, "-1");
        DEFAULTS.put(TYPEAHEAD_EDGE_LABELS_MAX_ITEMS, "-1");

        // Hide multivalue properties after this count
        DEFAULTS.put(PROPERTIES_MULTIVALUE_DEFAULT_VISIBLE_COUNT, "2");

        // Property Metadata shown in info popover
        DEFAULTS.put(PROPERTIES_METADATA_PROPERTY_NAMES, Joiner.on(',').join(
                PROPERTY_METADATA_SOURCE_TIMEZONE.getName(),
                PROPERTY_METADATA_MODIFIED_DATE.getName(),
                PROPERTY_METADATA_MODIFIED_BY.getName(),
                PROPERTY_METADATA_STATUS.getName(),
                PROPERTY_METADATA_KEY.getName()
        ));
        DEFAULTS.put(PROPERTIES_METADATA_PROPERTY_NAMES_DISPLAY, Joiner.on(',').join(
                PROPERTY_METADATA_SOURCE_TIMEZONE.getMessageKey(),
                PROPERTY_METADATA_MODIFIED_DATE.getMessageKey(),
                PROPERTY_METADATA_MODIFIED_BY.getMessageKey(),
                PROPERTY_METADATA_STATUS.getMessageKey(),
                PROPERTY_METADATA_KEY.getMessageKey()
        ));
        DEFAULTS.put(PROPERTIES_METADATA_PROPERTY_NAMES_TYPE, Joiner.on(',').join(
                PROPERTY_METADATA_SOURCE_TIMEZONE.getDataType(),
                PROPERTY_METADATA_MODIFIED_DATE.getDataType(),
                PROPERTY_METADATA_MODIFIED_BY.getDataType(),
                PROPERTY_METADATA_STATUS.getDataType(),
                PROPERTY_METADATA_KEY.getDataType()
        ));

        DEFAULTS.put(MAP_PROVIDER, MapProvider.OSM.toString());
        DEFAULTS.put(MAP_PROVIDER_OSM_URL, "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png");
        DEFAULTS.put(CYPHER_LAB, "true");
    }

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
        /**
         * @deprecated Google is not officially supported by OpenLayers, OpenStreetMap will be used.
         */
        @Deprecated
        GOOGLE("google"),
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
        return JustificationFieldValidation.valueOf(configuration.get(FIELD_JUSTIFICATION_VALIDATION, DEFAULTS.get(FIELD_JUSTIFICATION_VALIDATION)));
    }

    public static boolean justificationRequired(Configuration configuration) {
        return getJustificationFieldValidation(configuration).equals(JustificationFieldValidation.REQUIRED);
    }
}
