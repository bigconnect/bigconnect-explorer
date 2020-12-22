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
package com.mware.termsOfUse;

import com.google.inject.Inject;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import org.apache.commons.codec.binary.Hex;
import org.json.JSONObject;

import javax.servlet.http.HttpServletRequest;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;

public class TermsOfUse implements ParameterizedHandler {
    public static final String TITLE_PROPERTY = "termsOfUse.title";
    public static final String DEFAULT_TITLE = "termsOfUse.title config propert";
    public static final String HTML_PROPERTY = "termsOfUse.html";
    public static final String DEFAULT_HTML = "termsOfUse.html config property";
    public static final String DATE_PROPERTY = "termsOfUse.date";
    public static final String DATE_PROPERTY_FORMAT = "yyyy-MM-dd";
    private static final String UI_PREFERENCE_KEY = "termsOfUse";
    private static final String UI_PREFERENCE_HASH_SUBKEY = "hash";
    private static final String UI_PREFERENCE_DATE_SUBKEY = "date";
    private JSONObject termsJson;
    private String termsHash;
    private UserRepository userRepository;

    @Inject
    protected TermsOfUse(Configuration configuration,
                         UserRepository userRepository) {
        this.userRepository = userRepository;
        String title = configuration.get(TITLE_PROPERTY, DEFAULT_TITLE);
        String html = configuration.get(HTML_PROPERTY, DEFAULT_HTML);
        termsHash = hash(html);
        Date date = null;
        String dateString = configuration.get(DATE_PROPERTY, null);
        if (dateString != null) {
            SimpleDateFormat sdf = new SimpleDateFormat(DATE_PROPERTY_FORMAT);
            try {
                date = sdf.parse(dateString);
            } catch (ParseException e) {
                throw new BcException("unable to parse " + DATE_PROPERTY + " property with format " + DATE_PROPERTY_FORMAT, e);
            }
        }

        termsJson = new JSONObject();
        termsJson.put("title", title);
        termsJson.put("html", html);
        termsJson.put("hash", termsHash);
        if (date != null) {
            termsJson.put("date", date);
        }
    }

    @Handle
    public JSONObject handle(
            @Optional(name = "hash") String hash,
            HttpServletRequest request,
            User user
    ) throws Exception {
        if (request.getMethod().equals("POST")) {
            recordAcceptance(user, hash);
            JSONObject successJson = new JSONObject();
            successJson.put("success", true);
            successJson.put("message", "Terms of Use accepted.");
            return successJson;
        }
        JSONObject termsAndStatus = new JSONObject();
        termsAndStatus.put("terms", termsJson);
        termsAndStatus.put("status", getStatus(user));
        return termsAndStatus;
    }

    private String hash(String s) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            byte[] md5 = digest.digest(s.getBytes());
            return Hex.encodeHexString(md5);
        } catch (NoSuchAlgorithmException e) {
            throw new BcException("Could not find MD5", e);
        }
    }

    private JSONObject getUiPreferences(User user) {
        JSONObject uiPreferences = user.getUiPreferences();
        return uiPreferences != null ? uiPreferences : new JSONObject();
    }

    private void recordAcceptance(User user, String hash) {
        JSONObject uiPreferences = getUiPreferences(user);

        JSONObject touJson = new JSONObject();
        touJson.put(UI_PREFERENCE_HASH_SUBKEY, hash);
        touJson.put(UI_PREFERENCE_DATE_SUBKEY, new Date());
        uiPreferences.put(UI_PREFERENCE_KEY, touJson);
        userRepository.setUiPreferences(user, uiPreferences);
    }

    private JSONObject getStatus(User user) {
        JSONObject uiPreferences = getUiPreferences(user);
        JSONObject touJson = uiPreferences.optJSONObject(UI_PREFERENCE_KEY);

        JSONObject statusJson = new JSONObject();
        statusJson.put("current", false);

        if (touJson != null) {
            if (touJson.getString(UI_PREFERENCE_HASH_SUBKEY).equals(termsHash)) {
                statusJson.put("current", true);
                statusJson.put("accepted", touJson.getString(UI_PREFERENCE_DATE_SUBKEY));
            }
        }

        return statusJson;
    }
}
