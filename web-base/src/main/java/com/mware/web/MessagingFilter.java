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

import com.google.inject.Inject;
import com.mware.core.bootstrap.InjectHelper;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.JSONUtil;
import org.atmosphere.cpr.AtmosphereResource;
import org.atmosphere.cpr.PerRequestBroadcastFilter;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import javax.servlet.http.HttpServletRequest;

import static com.google.common.base.Preconditions.checkNotNull;

public class MessagingFilter implements PerRequestBroadcastFilter {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(MessagingFilter.class);

    public static final String TYPE_SET_ACTIVE_WORKSPACE = "setActiveWorkspace";
    public static final String TYPE_SET_ACTIVE_PRODUCT = "setActiveProduct";
    private UserRepository userRepository;

    @Override
    public BroadcastAction filter(String broadcasterId, Object originalMessage, Object message) {
        return new BroadcastAction(message);
    }

    @Override
    public BroadcastAction filter(String broadcasterId, AtmosphereResource r, Object originalMessage, Object message) {
        ensureInitialized();

        try {
            if (message == null || r.isCancelled()) {
                return new BroadcastAction(BroadcastAction.ACTION.ABORT, null);
            }
            JSONObject json = new JSONObject(message.toString());

            if (shouldSendMessage(json, r.getRequest())) {
                return new BroadcastAction(message);
            } else {
                return new BroadcastAction(BroadcastAction.ACTION.ABORT, message);
            }
        } catch (JSONException e) {
            LOGGER.error("Failed to filter message:\n" + originalMessage, e);
            return new BroadcastAction(BroadcastAction.ACTION.ABORT, message);
        }
    }

    boolean shouldSendMessage(JSONObject json, HttpServletRequest request) {
        String type = json.optString("type", null);
        if (TYPE_SET_ACTIVE_WORKSPACE.equals(type) || TYPE_SET_ACTIVE_PRODUCT.equals(type)) {
            return false;
        }

        if (request == null) {
            return false;
        }

        return shouldSendMessageByPermissions(json, request);
    }

    private boolean shouldSendMessageByPermissions(JSONObject json, HttpServletRequest request) {
        JSONObject permissionsJson = json.optJSONObject("permissions");
        if (permissionsJson != null) {
            if (shouldRejectMessageByUsers(permissionsJson, request)) {
                return false;
            }

            if (shouldRejectMessageToWorkspaces(permissionsJson, request)) {
                return false;
            }
        }
        return true;
    }

    private boolean shouldRejectMessageToWorkspaces(JSONObject permissionsJson, HttpServletRequest request) {
        JSONArray workspaces = permissionsJson.optJSONArray("workspaces");
        if (workspaces != null) {
            User currentUser = CurrentUser.get(request);
            if (currentUser == null) {
                return true;
            }

            String currentWorkspaceId = userRepository.getCurrentWorkspaceId(currentUser.getUserId());
            if (currentWorkspaceId == null) {
                return true;
            }

            if (!JSONUtil.isInArray(workspaces, currentWorkspaceId)) {
                return true;
            }
        }
        return false;
    }

    private boolean shouldRejectMessageByUsers(JSONObject permissionsJson, HttpServletRequest request) {
        JSONArray users = permissionsJson.optJSONArray("users");
        if (users != null) {
            User currentUser = CurrentUser.get(request);
            if (currentUser != null && currentUser.getUserId() != null && !JSONUtil.isInArray(users, currentUser.getUserId())) {
                return true;
            }
        }
        return false;
    }

    public void ensureInitialized() {
        if (userRepository == null) {
            InjectHelper.inject(this);
            if (userRepository == null) {
                LOGGER.error("userRepository cannot be null");
                checkNotNull(userRepository, "userRepository cannot be null");
            }
        }
    }

    @Inject
    public void setUserRepository(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

}
