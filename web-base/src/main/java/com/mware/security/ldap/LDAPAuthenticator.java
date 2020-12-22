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
package com.mware.security.ldap;

import com.google.common.collect.ImmutableSet;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.GeException;

import javax.naming.AuthenticationException;
import javax.naming.Context;
import javax.naming.NamingEnumeration;
import javax.naming.NamingException;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.SearchControls;
import javax.naming.directory.SearchResult;
import java.io.IOException;
import java.util.Collections;
import java.util.Hashtable;
import java.util.Optional;
import java.util.Set;

@Singleton
public class LDAPAuthenticator {
    private static BcLogger LOGGER = BcLoggerFactory.getLogger(LDAPAuthenticator.class);

    private boolean ldapEnabled;
    private String ldapUrl;
    private String ldapAdminUser;
    private String ldapAdminPassword;
    private String ldapAdminAttribute;
    private String ldapAdminAttrValue;
    private String ldapUserClass;
    private String ldapUserContainer;
    private String ldapUserameAttr;
    private String ldapGroupClass;
    private String ldapGroupContainer;
    private String ldapGroupnameAttr;
    private String ldapGroupMembershipAttr;
    private TlsOption ldapNegociateTls = TlsOption.NONE;

    @Inject
    public LDAPAuthenticator(Configuration configuration) {
        this.ldapEnabled = configuration.getBoolean("ldap.enabled", false);

        if (ldapEnabled) {
            this.ldapUrl = Optional.ofNullable(configuration.get("ldap.url", null))
                    .orElseThrow(() -> new GeException("LDAP Authentication is enabled, but 'ldap.url' config property not found"));
            this.ldapAdminUser = Optional.ofNullable(configuration.get("ldap.admin.user", null))
                    .orElseThrow(() -> new GeException("LDAP Authentication is enabled, but 'ldap.admin.user' config property not found"));
            this.ldapAdminPassword = Optional.ofNullable(configuration.get("ldap.admin.password", null))
                    .orElseThrow(() -> new GeException("LDAP Authentication is enabled, but 'ldap.admin.password' config property not found"));
            this.ldapAdminAttribute = Optional.ofNullable(configuration.get("ldap.admin.attribute", "isAdmin"))
                    .orElseThrow(() -> new GeException("LDAP Authentication is enabled, but 'ldap.admin.attribute' config property not found"));
            this.ldapUserClass = Optional.ofNullable(configuration.get("ldap.user.class", null))
                    .orElseThrow(() -> new GeException("LDAP Authentication is enabled, but 'ldap.user.class' config property not found"));
            this.ldapUserameAttr = Optional.ofNullable(configuration.get("ldap.username.attr", null))
                    .orElseThrow(() -> new GeException("LDAP Authentication is enabled, but 'ldap.username.attr' config property not found"));
            this.ldapUserContainer = Optional.ofNullable(configuration.get("ldap.user.container", null))
                    .orElseThrow(() -> new GeException("LDAP Authentication is enabled, but 'ldap.user.container' config property not found"));
            this.ldapGroupMembershipAttr = Optional.ofNullable(configuration.get("ldap.group.membership.attr", null))
                    .orElseThrow(() -> new GeException("LDAP Authentication is enabled, but 'ldap.group.membership.attr' config property not found"));
            this.ldapGroupClass = Optional.ofNullable(configuration.get("ldap.group.class", null))
                    .orElseThrow(() -> new GeException("LDAP Authentication is enabled, but 'ldap.group.class' config property not found"));
            this.ldapGroupContainer = Optional.ofNullable(configuration.get("ldap.group.container", null))
                    .orElseThrow(() -> new GeException("LDAP Authentication is enabled, but 'ldap.group.container' config property not found"));
            this.ldapGroupnameAttr = Optional.ofNullable(configuration.get("ldap.groupname.attr", null))
                    .orElseThrow(() -> new GeException("LDAP Authentication is enabled, but 'ldap.groupname.attr' config property not found"));
            this.ldapAdminAttrValue = Optional.ofNullable(configuration.get("ldap.admin.attr.value", null))
                    .orElseThrow(() -> new GeException("LDAP Authentication is enabled, but 'ldap.admin.attr.value' config property not found"));
        }
    }

    public boolean isPasswordValid(String username, String password) {
        final String sanitizedUsername = sanitizeEntity(username);

        try {
            final String userDN = findUserDN(sanitizedUsername);

            if (userDN == null)
                return false;

            try (AutoclosingLdapContext context = buildContext(userDN, password)) {
                return true;
            }
        } catch (AuthenticationException ae) {
            LOGGER.debug("{} failed to authenticate. {}", sanitizedUsername, ae);
        } catch (IOException | NamingException err) {
            LOGGER.debug(String.format("LDAP Authentication failure (username: %s)", sanitizedUsername), err);
        }

        return false;
    }

    public boolean hasAdminFlag(String username) {
        final String sanitizedUsername = sanitizeEntity(username);

        try {
            final String userDN = findUserDN(sanitizedUsername);

            try (AutoclosingLdapContext context = buildContext(ldapAdminUser, ldapAdminPassword)) {
                Attributes attrs = context.getAttributes(userDN);
                if (attrs != null) {
                    Attribute att = attrs.get(ldapAdminAttribute);
                    if (att != null) {
                        NamingEnumeration e = att.getAll();
                        while (e.hasMore()) {
                            String val = (String) e.next();
                            if (ldapAdminAttrValue.equals(val))
                                return true;
                        }
                    }
                    return false;
                } else {
                    LOGGER.debug("{} failed to retrieve user attributes.", sanitizedUsername);
                }
                return false;
            }
        } catch (AuthenticationException ae) {
            LOGGER.debug("{} failed to retrieve admin attribute. {}", sanitizedUsername, ae);
        } catch (IOException | NamingException err) {
            LOGGER.debug(String.format("LDAP Authentication failure (username: %s)", sanitizedUsername), err);
        }

        return false;
    }

    public Set<String> getGroupMemberships(String userName) {
        try (AutoclosingLdapContext context = buildContext(ldapAdminUser, ldapAdminPassword)) {
            String sanitizedUsername = sanitizeEntity(userName);
            sanitizedUsername = userNameBaseOnGroupClass(sanitizedUsername);
            final String filter = String.format("(&(%s=%s)(objectClass=%s))", ldapGroupMembershipAttr, sanitizedUsername, ldapGroupClass);
            final NamingEnumeration<SearchResult> result = context.search(ldapGroupContainer, filter, new SearchControls());
            ImmutableSet.Builder<String> overlappingGroups = ImmutableSet.builder();
            try {
                while (result.hasMore()) {
                    SearchResult next = result.next();
                    if (next.getAttributes() != null && next.getAttributes().get(ldapGroupnameAttr) != null) {
                        String group = (String) next.getAttributes().get(ldapGroupnameAttr).get(0);
                        overlappingGroups.add(group);
                    }
                }
                return overlappingGroups.build();
            } finally {
                result.close();
            }
        } catch (AuthenticationException ae) {
            LOGGER.debug("{} failed to authenticate. {}", ldapAdminUser, ae);
        } catch (IOException | NamingException err) {
            throw new BcException(String.format("LDAP Authentication failure (username: %s)", ldapAdminUser), err);
        }

        return Collections.emptySet();
    }

    private String findUserDN(String username) throws NamingException, IOException {
        try (AutoclosingLdapContext context = buildAdminContext()) {
            SearchControls sc = new SearchControls();
            sc.setSearchScope(SearchControls.SUBTREE_SCOPE);
            NamingEnumeration<SearchResult> result = context.search(ldapUserContainer, String.format("%s=%s", ldapUserameAttr, username), sc);
            try {
                while (result.hasMore()) {
                    SearchResult next = result.next();
                    return next.getNameInNamespace();
                }
            } finally {
                result.close();
            }
        }

        return null;
    }

    private static String sanitizeEntity(String name) {
        return name.replaceAll("[^A-Za-z0-9-_.]", "");
    }

    public boolean isLdapEnabled() {
        return ldapEnabled;
    }

    private AutoclosingLdapContext buildContext(String userDN, String password) throws IOException, NamingException {
        final Hashtable<String, String> env = contextConfiguration();

        env.put(Context.SECURITY_PRINCIPAL, userDN);
        env.put(Context.SECURITY_CREDENTIALS, password);

        return new AutoclosingLdapContext(env, ldapNegociateTls);
    }

    private AutoclosingLdapContext buildAdminContext() throws IOException, NamingException {
        final Hashtable<String, String> env = contextConfiguration();

        env.put(Context.SECURITY_PRINCIPAL, ldapAdminUser);
        env.put(Context.SECURITY_CREDENTIALS, ldapAdminPassword);

        return new AutoclosingLdapContext(env, ldapNegociateTls);
    }

    private Hashtable<String, String> contextConfiguration() {
        final Hashtable<String, String> env = new Hashtable<>();

        env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.ldap.LdapCtxFactory");
        env.put(Context.PROVIDER_URL, ldapUrl);
        env.put("com.sun.jndi.ldap.connect.timeout", "10000");
        env.put("com.sun.jndi.ldap.read.timeout", "10000");
        env.put("com.sun.jndi.ldap.connect.pool", "true");

        return env;
    }

    private String userNameBaseOnGroupClass(String userName) throws IOException, NamingException {
        return groupRequiresDn(ldapGroupClass, ldapGroupMembershipAttr) ? findUserDN(userName) : userName;
    }

    private static boolean groupRequiresDn(final String className, final String membershipAttr) {
        return ("groupOfNames".equalsIgnoreCase(className) && "member".equalsIgnoreCase(membershipAttr))
                || ("groupOfUniqueNames".equalsIgnoreCase(className) && "uniqueMember".equalsIgnoreCase(membershipAttr));
    }
}
