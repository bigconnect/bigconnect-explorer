package com.mware.web;

import com.mware.core.bootstrap.InjectHelper;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.web.framework.HandlerChain;
import com.mware.web.framework.RequestResponseHandler;
import com.mware.web.framework.utils.StringUtils;

import javax.crypto.*;
import javax.crypto.spec.SecretKeySpec;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

public class SSOHandler implements RequestResponseHandler {
    private static final String SSO_KEY = "U3VwZXJTZWNyZXRTU09LZQ==";

    private final UserRepository userRepository;

    public SSOHandler() {
        userRepository = InjectHelper.getInstance(UserRepository.class);
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse httpServletResponse, HandlerChain handlerChain) throws Exception {
        String encrypted = request.getParameter("sso");

        // Only process SSO if parameter exists
        if (!StringUtils.isEmpty(encrypted)) {
            try {
                String userName = decrypt(encrypted);
                System.out.println("Decrypted username from SSO: '" + userName + "'");

                if (userName != null) {
                    // Only check if user exists, don't create
                    User user = findExistingUser(userName);
                    if (user != null) {
                        // User exists, set them as current user
                        CurrentUser.set(request, user);
                        System.out.println("SSO: Set existing user in session: " + user.getUsername());
                        httpServletResponse.sendRedirect("/");
                        return;
                    } else {
                        // User doesn't exist locally, redirect to login with SSO username
                        // The login handler will create the user via LDAP
                        System.out.println("SSO: User not found locally, redirecting to login for LDAP creation: " + userName);
                        httpServletResponse.sendRedirect("/login?sso_username=" + userName);
                        return;
                    }
                }
            } catch (Exception e) {
                System.err.println("SSO decryption failed: " + e.getMessage());
            }
        }

        // Continue to next handler for all non-SSO requests or failed SSO
        handlerChain.next(request, httpServletResponse);
    }

    private User findExistingUser(String userName) {
        // Try different variations to find the existing user
        String[] variations = {
                userName,
                userName.trim(),
                userName.toLowerCase(),
                userName.replace(" ", ""),
                userName.replace(" ", "."),
                getFirstWord(userName)
        };

        for (String variation : variations) {
            if (variation != null && !variation.isEmpty()) {
                User user = userRepository.findByUsername(variation);
                if (user != null) {
                    System.out.println("Found existing user: " + user.getUsername() + " using variation: " + variation);
                    return user;
                }
            }
        }
        return null;
    }

    private String getFirstWord(String text) {
        if (text == null || text.trim().isEmpty()) return null;
        String[] words = text.trim().split("\\s+");
        return words.length > 0 ? words[0] : null;
    }

    private String decrypt(String ciphertext)
            throws InvalidKeyException, NoSuchPaddingException, NoSuchAlgorithmException, IllegalBlockSizeException, BadPaddingException {
        SecretKey secretKey = getSecretKey(SSO_KEY);
        Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(Cipher.DECRYPT_MODE, secretKey);
        return new String(cipher.doFinal(Base64.getDecoder().decode(ciphertext)));
    }

    private SecretKey getSecretKey(String secretKey) {
        byte[] decodeSecretKey = Base64.getDecoder().decode(secretKey);
        return new SecretKeySpec(decodeSecretKey, 0, decodeSecretKey.length, "AES");
    }
}