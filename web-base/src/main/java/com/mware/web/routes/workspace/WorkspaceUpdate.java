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
package com.mware.web.routes.workspace;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.clientapi.dto.ClientApiWorkspace;
import com.mware.core.model.clientapi.dto.WorkspaceAccess;
import com.mware.core.model.notification.ExpirationAge;
import com.mware.core.model.notification.ExpirationAgeUnit;
import com.mware.core.model.notification.UserNotificationRepository;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.formula.FormulaEvaluator;
import com.mware.ge.Authorizations;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiWorkspaceDiff;
import com.mware.web.model.ClientApiWorkspaceUpdateData;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.parameterProviders.SourceGuid;
import com.mware.workspace.WorkspaceDiffHelper;
import org.json.JSONObject;

import java.text.MessageFormat;
import java.util.List;
import java.util.ResourceBundle;

@Singleton
public class WorkspaceUpdate implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(WorkspaceUpdate.class);
    private final WorkspaceRepository workspaceRepository;
    private final WebQueueRepository webQueueRepository;
    private final UserNotificationRepository userNotificationRepository;
    private final WorkspaceDiffHelper workspaceDiffHelper;

    @Inject
    public WorkspaceUpdate(
            final WorkspaceRepository workspaceRepository,
            final WebQueueRepository webQueueRepository,
            final UserNotificationRepository userNotificationRepository,
            WorkspaceDiffHelper workspaceDiffHelper
    ) {
        this.workspaceRepository = workspaceRepository;
        this.webQueueRepository = webQueueRepository;
        this.userNotificationRepository = userNotificationRepository;
        this.workspaceDiffHelper = workspaceDiffHelper;
    }

    @Handle
    public ClientApiWorkspace handle(
            @Required(name = "data") ClientApiWorkspaceUpdateData updateData,
            @ActiveWorkspaceId String workspaceId,
            @SourceGuid String sourceGuid,
            ResourceBundle resourceBundle,
            User user,
            Authorizations authorizations,
            FormulaEvaluator.UserContext userContext
    ) throws Exception {
        Workspace workspace = workspaceRepository.findById(workspaceId, user);
        if (workspace == null) {
            throw new BcResourceNotFoundException("Could not find workspace: " + workspaceId);
        }

        if (updateData.getTitle() != null) {
            setTitle(workspace, updateData.getTitle(), user);
        }

        if (updateData.getStaging() != null) {
            setStaging(workspace, updateData.getStaging(), user, userContext);
        }

        updateUsers(workspace, updateData.getUserUpdates(), resourceBundle, user);

        workspace = workspaceRepository.findById(workspaceId, user);
        ClientApiWorkspace clientApiWorkspaceAfterUpdateButBeforeDelete = workspaceRepository.toClientApi(
                workspace,
                user,
                authorizations
        );
        List<ClientApiWorkspace.User> previousUsers = clientApiWorkspaceAfterUpdateButBeforeDelete.getUsers();
        deleteUsers(workspace, updateData.getUserDeletes(), user);

        ClientApiWorkspace clientApiWorkspace = workspaceRepository.toClientApi(workspace, user, authorizations);

        webQueueRepository.broadcastWorkspace(clientApiWorkspace, previousUsers, user.getUserId(), sourceGuid);

        return workspaceRepository.toClientApi(workspace, user, authorizations);
    }

    private void setTitle(Workspace workspace, String title, User authUser) {
        LOGGER.debug("setting title (%s): %s", workspace.getWorkspaceId(), title);
        workspaceRepository.setTitle(workspace, title, authUser);
    }

    private void setStaging(Workspace workspace, Boolean staging, User authUser, FormulaEvaluator.UserContext userContext) {
        LOGGER.debug("setting stating (%s): %s", workspace.getWorkspaceId(), staging);

        if (!staging && workspaceRepository.isStagingEnabled(workspace)) {
            // if staging is being disabled, check any outstanding diffs
            ClientApiWorkspaceDiff diff = workspaceDiffHelper.getDiff(workspace, authUser, userContext);
            if (diff.getDiffs().size() > 0) {
                throw new BcException("Publish your changes to disable staging.");
            }
        }
        workspaceRepository.setStaging(workspace, staging, authUser);
    }

    private void deleteUsers(Workspace workspace, List<String> userDeletes, User authUser) {
        for (String userId : userDeletes) {
            LOGGER.debug("user delete (%s): %s", workspace.getWorkspaceId(), userId);
            workspaceRepository.deleteUserFromWorkspace(workspace, userId, authUser);
            webQueueRepository.pushWorkspaceDelete(workspace.getWorkspaceId(), userId);
        }
    }

    private void updateUsers(
            Workspace workspace,
            List<ClientApiWorkspaceUpdateData.UserUpdate> userUpdates,
            ResourceBundle resourceBundle,
            User authUser
    ) {
        for (ClientApiWorkspaceUpdateData.UserUpdate update : userUpdates) {
            LOGGER.debug("user update (%s): %s", workspace.getWorkspaceId(), update.toString());
            String userId = update.getUserId();
            WorkspaceAccess workspaceAccess = update.getAccess();
            WorkspaceRepository.UpdateUserOnWorkspaceResult updateUserOnWorkspaceResults
                    = workspaceRepository.updateUserOnWorkspace(workspace, userId, workspaceAccess, authUser);

            String title;
            String subtitle;
            switch (updateUserOnWorkspaceResults) {
                case UPDATE:
                    title = resourceBundle.getString("workspaces.notification.shareUpdated.title");
                    subtitle = resourceBundle.getString("workspaces.notification.shareUpdated.subtitle");
                    break;
                default:
                    title = resourceBundle.getString("workspaces.notification.shared.title");
                    subtitle = resourceBundle.getString("workspaces.notification.shared.subtitle");
            }
            String message = MessageFormat.format(subtitle, authUser.getDisplayName(), workspace.getDisplayTitle());
            JSONObject payload = new JSONObject();
            payload.put("workspaceId", workspace.getWorkspaceId());
            userNotificationRepository.createNotification(
                    userId,
                    title,
                    message,
                    "switchWorkspace",
                    payload,
                    new ExpirationAge(7, ExpirationAgeUnit.DAY),
                    authUser
            );
        }
    }

}
