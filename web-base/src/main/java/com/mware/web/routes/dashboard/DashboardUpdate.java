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
package com.mware.web.routes.dashboard;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.user.User;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.workspace.WebWorkspaceRepository;
import org.json.JSONArray;
import org.json.JSONObject;

@Singleton
public class DashboardUpdate implements ParameterizedHandler {
    private final WebWorkspaceRepository webWorkspaceRepository;

    @Inject
    public DashboardUpdate(WebWorkspaceRepository webWorkspaceRepository) {
        this.webWorkspaceRepository = webWorkspaceRepository;
    }

    @Handle
    public JSONObject handle(
            @Optional(name = "dashboardId") String dashboardId,
            @Optional(name = "title") String title,
            @Optional(name = "items[]") String[] items,
            @ActiveWorkspaceId String workspaceId,
            User user
    ) throws Exception {
        JSONObject json = new JSONObject();
        dashboardId = webWorkspaceRepository.addOrUpdateDashboard(workspaceId, dashboardId, title, user);
        json.put("id", dashboardId);
        if (items != null) {
            JSONArray itemIds = new JSONArray();
            for (String item : items) {
                JSONObject itemJson = new JSONObject(item);
                String itemTitle = itemJson.optString("title");
                String itemConfig = itemJson.optString("configuration");
                String itemExtension = itemJson.getString("extensionId");
                itemIds.put(webWorkspaceRepository.addOrUpdateDashboardItem(workspaceId, dashboardId, null, itemTitle, itemConfig, itemExtension, user));
            }
            json.put("itemIds", itemIds);
        }
        // TODO: change this to a model object
        return json;
    }
}

