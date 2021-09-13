package com.mware.config;

import com.mware.core.config.ConfigOption;
import com.mware.core.config.OptionHolder;
import com.mware.security.ACLProvider;
import com.mware.security.AllowAllAclProvider;

import java.util.TimeZone;

import static com.mware.core.config.OptionChecker.disallowEmpty;
import static com.mware.core.config.OptionChecker.positiveInt;

public class WebOptions extends OptionHolder {
    public static final ConfigOption<String> BASE_URL = new ConfigOption<>(
            "base.url",
            "",
            String.class,
            null
    );

    public static final ConfigOption<String> DEFAULT_TIME_ZONE = new ConfigOption<>(
            "default.timeZone",
            "",
            String.class,
            TimeZone.getDefault().getDisplayName()
    );

    public static final ConfigOption<Boolean> COMMENTS_AUTO_PUBLISH = new ConfigOption<>(
            "comments.autoPublish",
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

    public static final ConfigOption<Boolean> WEB_GEOCODER_ENABLED = new ConfigOption<>(
            "web.ui.geocoder.enabled",
            "",
            Boolean.class,
            false
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
