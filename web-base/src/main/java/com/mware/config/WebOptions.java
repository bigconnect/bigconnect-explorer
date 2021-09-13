package com.mware.config;

import com.google.common.base.Joiner;
import com.mware.bigconnect.ffmpeg.ArtifactThumbnailRepositoryProps;
import com.mware.core.config.ConfigOption;
import com.mware.core.config.OptionHolder;
import com.mware.core.model.properties.BcSchema;
import com.mware.security.ACLProvider;
import com.mware.security.AllowAllAclProvider;
import com.mware.web.WebConfiguration;

import java.util.TimeZone;

import static com.mware.core.config.OptionChecker.*;

public class WebOptions extends OptionHolder {
    public static final WebConfiguration.PropertyMetadata PROPERTY_METADATA_SOURCE_TIMEZONE = new WebConfiguration.PropertyMetadata(
            "sourceTimezone",
            "properties.metadata.label.source_timezone",
            "timezone"
    );
    public static final WebConfiguration.PropertyMetadata PROPERTY_METADATA_MODIFIED_DATE = new WebConfiguration.PropertyMetadata(
            BcSchema.MODIFIED_DATE,
            "properties.metadata.label.modified_date",
            "datetime"
    );
    public static final WebConfiguration.PropertyMetadata PROPERTY_METADATA_MODIFIED_BY = new WebConfiguration.PropertyMetadata(
            BcSchema.MODIFIED_BY,
            "properties.metadata.label.modified_by",
            "user"
    );
    public static final WebConfiguration.PropertyMetadata PROPERTY_METADATA_STATUS = new WebConfiguration.PropertyMetadata(
            "sandboxStatus",
            "properties.metadata.label.status",
            "sandboxStatus"
    );
    public static final WebConfiguration.PropertyMetadata PROPERTY_METADATA_KEY = new WebConfiguration.PropertyMetadata(
            "key",
            "properties.metadata.label.key",
            "string"
    );

    public static final ConfigOption<String> BASE_URL = new ConfigOption<>(
            "base.url",
            "",
            String.class,
            null
    );

    public static final ConfigOption<Boolean> SHOW_VERSION_COMMENTS = new ConfigOption<>(
            "web.ui.showVersionComments",
            "",
            Boolean.class,
            true
    );

    public static final ConfigOption<Boolean> SHOW_VISIBILITY_IN_DETAILS_PANE = new ConfigOption<>(
            "web.ui.showVisibilityInDetailsPane",
            "",
            Boolean.class,
            true
    );

    public static final ConfigOption<String> DEFAULT_TIME_ZONE = new ConfigOption<>(
            "default.timeZone",
            "",
            String.class,
            TimeZone.getDefault().getDisplayName()
    );

    public static final ConfigOption<Boolean> FORMATS_DATE_SHOW_TIMEZONE = new ConfigOption<>(
            "web.ui.formats.date.showTimezone",
            "",
            Boolean.class,
            true
    );

    public static final ConfigOption<String> DATE_DISPLAY = new ConfigOption<>(
            "web.ui.date.default.display",
            "",
            String.class,
            "relative"
    );

    public static final ConfigOption<String> FORMATS_DATE_DATEDISPLAY = new ConfigOption<>(
            "web.ui.formats.date.dateDisplay",
            "",
            String.class,
            "YYYY-MM-DD"
    );

    public static final ConfigOption<String> FORMATS_DATE_TIMEDISPLAY = new ConfigOption<>(
            "web.ui.formats.date.timeDisplay",
            "",
            String.class,
            "HH:mm"
    );

    public static final ConfigOption<Boolean> COMMENTS_AUTO_PUBLISH = new ConfigOption<>(
            "comments.autoPublish",
            "",
            Boolean.class,
            false
    );

    public static final ConfigOption<Boolean> LOGIN_SHOW_POWERED_BY = new ConfigOption<>(
            "web.ui.login.showPoweredBy",
            "",
            Boolean.class,
            false
    );

    public static final ConfigOption<String> MULTIPART_LOCATION = new ConfigOption<>(
            "multipart.location",
            "Where to store temporary uploaded files",
            String.class,
            System.getProperty("java.io.tmpdir")
    );

    public static final ConfigOption<Long> MULTIPART_MAX_FILE_SIZE = new ConfigOption<>(
            "multipart.maxFileSize",
            "Maximum files size in bytes for file upload",
            Long.class,
            512 * 1024 * 1024L // 512mb
    );

    public static final ConfigOption<Long> MULTIPART_MAX_REQUEST_SIZE = new ConfigOption<>(
            "multipart.maxRequestSize",
            "Maximum request size in bytes for file upload",
            Long.class,
            1024 * 1024 * 1024L // 1Gb
    );

    public static final ConfigOption<Integer> MULTIPART_FILE_SIZE_THRESHOLD = new ConfigOption<>(
            "multipart.fileSizeThreshold",
            "",
            Integer.class,
            0
    );

    public static final ConfigOption<String> BOLT_SERVER_ADDRESS = new ConfigOption<>(
            "web.ui.bolt.server",
            "Bolt server address for Cypher Lab to connect to",
            String.class,
            "localhost:10242"
    );

    public static final ConfigOption<Boolean> CYPHER_LAB = new ConfigOption<>(
            "web.ui.cypher.lab",
            "Show CypherLab on the top menu bar",
            Boolean.class,
            true
    );

    public static final ConfigOption<Integer> VERTEX_LOAD_RELATED_MAX_BEFORE_PROMPT = new ConfigOption<>(
            "web.ui.vertex.loadRelatedMaxBeforePrompt",
            "Maximum number of vertices to show warning on Add Related",
            Integer.class,
            50
    );

    public static final ConfigOption<Integer> VERTEX_LOAD_RELATED_MAX_FORCE_SEARCH = new ConfigOption<>(
            "web.ui.vertex.loadRelatedMaxForceSearch",
            "Maximum number of vertices for Add Related, shows error if more",
            Integer.class,
            250
    );

    public static final ConfigOption<Integer> VERTEX_RELATIONSHIPS_MAX_PER_SECTION = new ConfigOption<>(
            "web.ui.vertex.relationships.maxPerSection",
            "Maximum number of relationships to show per page in Detail View",
            Integer.class,
            5
    );

    public static final ConfigOption<Integer> DETAIL_HISTORY_STACK_MAX = new ConfigOption<>(
            "web.ui.detail.history.stack.max",
            "",
            Integer.class,
            5
    );

    public static final ConfigOption<Integer> MAX_SELECTION_PARAGRAPHS_FOR_TERM_POPOVER = new ConfigOption<>(
            "web.ui.detail.text.popover.maxSelectionParagraphs",
            "",
            Integer.class,
            5
    );

    public static final ConfigOption<Integer> VIDEO_PREVIEW_FRAMES_COUNT = new ConfigOption<>(
            "web.ui.video.preview.frames.count",
            "",
            Integer.class,
            ArtifactThumbnailRepositoryProps.FRAMES_PER_PREVIEW
    );

    public static final ConfigOption<String> FIELD_JUSTIFICATION_VALIDATION = new ConfigOption<>(
            "web.ui.field.justification.validation",
            "",
            String.class,
            WebConfiguration.JustificationFieldValidation.OPTIONAL.toString()
    );

    public static final ConfigOption<Boolean> WEB_GEOCODER_ENABLED = new ConfigOption<>(
            "web.ui.geocoder.enabled",
            "",
            Boolean.class,
            false
    );

    public static final ConfigOption<Boolean> SEARCH_DISABLE_WILDCARD_SEARCH = new ConfigOption<>(
            "web.ui.search.disableWildcardSearch",
            "",
            Boolean.class,
            false
    );

    public static final ConfigOption<Integer> NOTIFICATIONS_LOCAL_AUTO_DISMISS_SECONDS = new ConfigOption<>(
            "web.ui.notifications.local.autoDismissSeconds",
            "",
            Integer.class,
            10
    );

    public static final ConfigOption<Integer> NOTIFICATIONS_SYSTEM_AUTO_DISMISS_SECONDS = new ConfigOption<>(
            "web.ui.notifications.system.autoDismissSeconds",
            "",
            Integer.class,
            10
    );

    public static final ConfigOption<Integer> NOTIFICATIONS_USER_AUTO_DISMISS_SECONDS = new ConfigOption<>(
            "web.ui.notifications.user.autoDismissSeconds",
            "",
            Integer.class,
            10
    );

    public static final ConfigOption<Integer> TYPEAHEAD_PROPERTIES_MAX_ITEMS = new ConfigOption<>(
            "web.ui.typeahead.properties.maxItems",
            "",
            Integer.class,
            -1
    );

    public static final ConfigOption<Integer> TYPEAHEAD_CONCEPTS_MAX_ITEMS = new ConfigOption<>(
            "web.ui.typeahead.concepts.maxItems",
            "",
            Integer.class,
            -1
    );

    public static final ConfigOption<Integer> TYPEAHEAD_EDGE_LABELS_MAX_ITEMS = new ConfigOption<>(
            "web.ui.typeahead.edgeLabels.maxItems",
            "",
            Integer.class,
            -1
    );

    public static final ConfigOption<Integer> PROPERTIES_MULTIVALUE_DEFAULT_VISIBLE_COUNT = new ConfigOption<>(
            "web.ui.properties.multivalue.defaultVisibleCount",
            "Hide multivalue properties after this count",
            Integer.class,
            2
    );

    public static final ConfigOption<String> PROPERTIES_METADATA_PROPERTY_NAMES = new ConfigOption<>(
            "web.ui.properties.metadata.propertyNames",
            "Property Metadata shown in info popover",
            String.class,
            Joiner.on(',').join(
                    PROPERTY_METADATA_SOURCE_TIMEZONE.getName(),
                    PROPERTY_METADATA_MODIFIED_DATE.getName(),
                    PROPERTY_METADATA_MODIFIED_BY.getName(),
                    PROPERTY_METADATA_STATUS.getName(),
                    PROPERTY_METADATA_KEY.getName()
            )
    );

    public static final ConfigOption<String> PROPERTIES_METADATA_PROPERTY_NAMES_DISPLAY = new ConfigOption<>(
            "web.ui.properties.metadata.propertyNamesDisplay",
            "Property Metadata shown in info popover",
            String.class,
            Joiner.on(',').join(
                    PROPERTY_METADATA_SOURCE_TIMEZONE.getMessageKey(),
                    PROPERTY_METADATA_MODIFIED_DATE.getMessageKey(),
                    PROPERTY_METADATA_MODIFIED_BY.getMessageKey(),
                    PROPERTY_METADATA_STATUS.getMessageKey(),
                    PROPERTY_METADATA_KEY.getMessageKey()
            )
    );

    public static final ConfigOption<String> PROPERTIES_METADATA_PROPERTY_NAMES_TYPE = new ConfigOption<>(
            "web.ui.properties.metadata.propertyNamesType",
            "Property Metadata shown in info popover",
            String.class,
            Joiner.on(',').join(
                    PROPERTY_METADATA_SOURCE_TIMEZONE.getDataType(),
                    PROPERTY_METADATA_MODIFIED_DATE.getDataType(),
                    PROPERTY_METADATA_MODIFIED_BY.getDataType(),
                    PROPERTY_METADATA_STATUS.getDataType(),
                    PROPERTY_METADATA_KEY.getDataType()
            )
    );

    public static final ConfigOption<String> MAP_PROVIDER = new ConfigOption<>(
            "web.ui.map.provider",
            "",
            allowValues(
                    WebConfiguration.MapProvider.BING.toString(),
                    WebConfiguration.MapProvider.OSM.toString(),
                    WebConfiguration.MapProvider.ARCGIS93REST.toString()
            ),
            String.class,
            WebConfiguration.MapProvider.OSM.toString()
    );

    public static final ConfigOption<String> MAP_PROVIDER_OSM_URL = new ConfigOption<>(
            "web.ui.map.provider.osm.url",
            "",
            String.class,
            "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    );

    public static final ConfigOption<Boolean> DEV_MODE = new ConfigOption<>(
            "devMode",
            "",
            Boolean.class,
            true
    );

    public static final ConfigOption<Integer> AUTH_TOKEN_EXPIRATION_IN_MINS = new ConfigOption<>(
            "web.ui.auth.token.expiration_minutes",
            "",
            positiveInt(),
            Integer.class,
            60
    );

    public static final ConfigOption<String> WEB_RESPONSE_HEADER_X_FRAME_OPTIONS = new ConfigOption<>(
            "web.response.header.X-Frame-Options",
            "",
            String.class,
            "DENY"
    );

    public static final ConfigOption<Class<? extends ACLProvider>> ACL_PROVIDER_REPOSITORY = new ConfigOption(
            "repository.acl",
            "Implementation of ACLProvider",
            disallowEmpty(),
            Class.class,
            AllowAllAclProvider.class
    );

    public static final ConfigOption<Boolean> LDAP_ENABLED = new ConfigOption<>(
            "ldap.enabled",
            "Enable LDAP Authentication",
            Boolean.class,
            false
    );

    public static final ConfigOption<String> LDAP_URL = new ConfigOption<>(
            "ldap.url",
            "Ldap connection (eg. ldap://host:portP)",
            String.class,
            null
    );

    public static final ConfigOption<String> LDAP_ADMIN_USER = new ConfigOption<>(
            "ldap.admin.user",
            "",
            String.class,
            null
    );

    public static final ConfigOption<String> LDAP_ADMIN_PASSWORD = new ConfigOption<>(
            "ldap.admin.password",
            "",
            String.class,
            null
    );

    public static final ConfigOption<String> LDAP_ADMIN_ATTR = new ConfigOption<>(
            "ldap.admin.attribute",
            "",
            String.class,
            "isAdmin"
    );

    public static final ConfigOption<String> LDAP_USER_CLASS = new ConfigOption<>(
            "ldap.user.class",
            "",
            String.class,
            null
    );

    public static final ConfigOption<String> LDAP_USERNAME_ATTR = new ConfigOption<>(
            "ldap.username.attr",
            "",
            String.class,
            null
    );

    public static final ConfigOption<String> LDAP_USER_CONTAINER = new ConfigOption<>(
            "ldap.user.container",
            "",
            String.class,
            null
    );

    public static final ConfigOption<String> LDAP_GROUP_MEMBER_ATTR = new ConfigOption<>(
            "ldap.group.membership.attr",
            "",
            String.class,
            null
    );

    public static final ConfigOption<String> LDAP_GROUP_CLASS = new ConfigOption<>(
            "ldap.group.class",
            "",
            String.class,
            null
    );

    public static final ConfigOption<String> LDAP_GROUP_CONTAINER = new ConfigOption<>(
            "ldap.group.container",
            "",
            String.class,
            null
    );

    public static final ConfigOption<String> LDAP_GROUP_NAME_ATTR = new ConfigOption<>(
            "ldap.groupname.attr",
            "",
            String.class,
            null
    );

    public static final ConfigOption<String> LDAP_ADMIN_ATTR_VAL = new ConfigOption<>(
            "ldap.admin.attr.value",
            "",
            String.class,
            null
    );

    private WebOptions() {
        super();
    }

    private static volatile WebOptions instance;

    public static synchronized WebOptions instance() {
        if (instance == null) {
            instance = new WebOptions();
            // Should initialize all static members first, then register.
            instance.registerOptions();
        }
        return instance;
    }
}
