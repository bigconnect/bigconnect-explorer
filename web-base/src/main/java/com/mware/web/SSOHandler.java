package com.mware.web;

import com.google.common.collect.ImmutableSet;
import com.mware.core.bootstrap.InjectHelper;
import com.mware.core.config.Configuration;
import com.mware.core.model.clientapi.dto.Privilege;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.user.UserPropertyPrivilegeRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.SystemUser;
import com.mware.core.user.User;
import com.mware.security.ldap.LDAPAuthenticator;
import com.mware.web.framework.HandlerChain;
import com.mware.web.framework.RequestResponseHandler;
import com.mware.web.framework.utils.StringUtils;

import javax.crypto.*;
import javax.crypto.spec.SecretKeySpec;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Base64;
import java.util.Set;

public class SSOHandler implements RequestResponseHandler {
    private static final String SSO_KEY = "U3VwZXJTZWNyZXRTU09LZQ==";
    private static final String DEFAULT_SSO_PASSWORD_FALLBACK = "sso-generated-password-123";

    private final UserRepository userRepository;
    private final LDAPAuthenticator ldapAuthenticator;
    private final AuthorizationRepository authorizationRepository;
    private final UserPropertyPrivilegeRepository privilegeRepository;
    private final Configuration configuration;
    private final String ssoDefaultPassword;

    public SSOHandler() {
        userRepository = InjectHelper.getInstance(UserRepository.class);
        ldapAuthenticator = InjectHelper.getInstance(LDAPAuthenticator.class);
        authorizationRepository = InjectHelper.getInstance(AuthorizationRepository.class);
        privilegeRepository = InjectHelper.getInstance(UserPropertyPrivilegeRepository.class);
        configuration = InjectHelper.getInstance(Configuration.class);

        // Load SSO password from config with fallback
        ssoDefaultPassword = configuration.get("sso.default.password", DEFAULT_SSO_PASSWORD_FALLBACK);
        System.out.println("SSO: Using default password from config: " + (ssoDefaultPassword.equals(DEFAULT_SSO_PASSWORD_FALLBACK) ? "fallback" : "configured"));
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse httpServletResponse, HandlerChain handlerChain) throws Exception {
        String encrypted = request.getParameter("sso");

        if (!StringUtils.isEmpty(encrypted)) {
            try {
                String userName = decrypt(encrypted);

                if (userName != null && !userName.trim().isEmpty()) {
                    User user = findOrCreateUser(userName.trim());
                    if (user != null) {
                        CurrentUser.set(request, user);
                        httpServletResponse.sendRedirect("/");
                        return;
                    } else {
                        httpServletResponse.sendRedirect("/login?error=user_not_found");
                        return;
                    }
                }
            } catch (Exception e) {
                System.err.println("SSO decryption failed: " + e.getMessage());
            }
        }

        handlerChain.next(request, httpServletResponse);
    }

    private User findOrCreateUser(String userName) {
        // First, check if user exists in local database - EXACT match only
        User user = userRepository.findByUsername(userName);
        if (user != null) {
            System.out.println("Found existing local user: " + user.getUsername());
            return user;
        }

        // User not found locally - check if LDAP is enabled and try to create user
        if (ldapAuthenticator.isLdapEnabled()) {
            return createUserFromLdap(userName);
        }

        return null;
    }

    private User createUserFromLdap(String userName) {
        try {
            // Check if user exists in LDAP by getting their group memberships
            Set<String> groups = ldapAuthenticator.getGroupMemberships(userName);

            if (groups != null) {

                // Create user locally with password from config
                User user = userRepository.findOrAddUser(
                        userName,
                        userName,
                        null,
                        ssoDefaultPassword
                );

                // Add roles from LDAP groups
                addRolesFromLdapGroups(user, groups);

                // Set admin privileges if user has admin flag
                if (ldapAuthenticator.hasAdminFlag(userName)) {
                    setAdminPrivileges(user);
                }

                return user;
            } else {
                return null;
            }
        } catch (Exception e) {
            System.err.println("SSO: Failed to check/create LDAP user " + userName + ": " + e.getMessage());
            return null;
        }
    }

    private void addRolesFromLdapGroups(User user, Set<String> groupMemberships) {
        try {
            Set<String> existingRoles = authorizationRepository.getRoleNames(user);
            for (String group : groupMemberships) {
                if (!existingRoles.contains(group)) {
                    authorizationRepository.addRoleToUser(user, group, new SystemUser());
                }
            }
        } catch (Exception e) {
            System.err.println("SSO: Failed to add roles for user " + user.getUsername() + ": " + e.getMessage());
        }
    }

    private void setAdminPrivileges(User user) {
        try {
            String[] adminPrivileges = new String[]{
                    Privilege.READ, Privilege.COMMENT, Privilege.EDIT, Privilege.PUBLISH,
                    Privilege.SEARCH_SAVE_GLOBAL, Privilege.HISTORY_READ,
                    Privilege.ADMIN, Privilege.ONTOLOGY_ADD, Privilege.ONTOLOGY_PUBLISH
            };
            privilegeRepository.setPrivileges(user, ImmutableSet.copyOf(adminPrivileges), new SystemUser());
        } catch (Exception e) {
            System.err.println("SSO: Failed to set admin privileges for user " + user.getUsername() + ": " + e.getMessage());
        }
    }

    private String decrypt(String ciphertext)
            throws InvalidKeyException, NoSuchPaddingException, NoSuchAlgorithmException, IllegalBlockSizeException, BadPaddingException {
        SecretKey secretKey = getSecretKey(SSO_KEY);
        Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(Cipher.DECRYPT_MODE, secretKey);

        byte[] decryptedBytes = cipher.doFinal(Base64.getDecoder().decode(ciphertext));
        String decrypted = new String(decryptedBytes, StandardCharsets.UTF_8);

        // Fix common decryption issue: replace spaces with dots
        String fixed = decrypted.replace(" ", ".");


        return fixed;
    }

    private SecretKey getSecretKey(String secretKey) {
        byte[] decodeSecretKey = Base64.getDecoder().decode(secretKey);
        return new SecretKeySpec(decodeSecretKey, 0, decodeSecretKey.length, "AES");
    }
}