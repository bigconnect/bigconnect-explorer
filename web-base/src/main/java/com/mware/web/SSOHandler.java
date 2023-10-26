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
        if (!StringUtils.isEmpty(encrypted)) {
            String userName = decrypt(encrypted);
            User user = userRepository.findByUsername(userName);
            if (user != null) {
                CurrentUser.set(request, user);
            }
        }
        httpServletResponse.sendRedirect("/");
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
