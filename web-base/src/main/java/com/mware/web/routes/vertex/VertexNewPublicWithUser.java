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
package com.mware.web.routes.vertex;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.clientapi.dto.ClientApiSourceInfo;
import com.mware.core.model.clientapi.dto.ClientApiVertex;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.user.AuthorizationContext;
import com.mware.core.model.user.UserNameAuthorizationContext;
import com.mware.core.model.user.UserRepository;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.WorkspaceHelper;
import com.mware.core.security.AuditService;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.web.CurrentUser;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.JustificationText;
import com.mware.web.util.RemoteAddressUtil;

import javax.servlet.http.HttpServletRequest;
import java.util.ResourceBundle;

@Singleton
public class VertexNewPublicWithUser extends VertexNew implements ParameterizedHandler {
    private UserRepository userRepository;
    private AuthorizationRepository authorizationRepository;

    @Inject
    public VertexNewPublicWithUser(
            Graph graph,
            VisibilityTranslator visibilityTranslator,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository,
            SchemaRepository ontologyRepository,
            GraphRepository graphRepository,
            WorkspaceHelper workspaceHelper,
            AuditService auditService) {
        super(graph, visibilityTranslator, workQueueRepository,
                webQueueRepository, ontologyRepository, graphRepository, workspaceHelper, auditService);
    }

    @Handle
    public ClientApiVertex handle(
            @Optional(name = "vertexId", allowEmpty = false) String vertexId,
            @Required(name = "conceptType", allowEmpty = false) String conceptType,
            @Required(name = "visibilitySource") String visibilitySource,
            @Required(name = "title") String vertexTitle,
            @Optional(name = "lat") double latitude,
            @Optional(name = "lon") double longitude,
            @Optional(name = "properties", allowEmpty = false) String propertiesJsonString,
            @Optional(name = "publish", defaultValue = "false") boolean shouldPublish,
            @JustificationText String justificationText,
            ClientApiSourceInfo sourceInfo,
            @Optional(name = "workspaceId") String workspaceId,
            ResourceBundle resourceBundle,
            HttpServletRequest request,
            @Optional(name = "userName") String userName,
            User userBase
    ) throws Exception {
        final User user = userRepository.findOrAddUser(
                userName,
                userName,
                null,
                userName
        );

        // Authenticate user
        AuthorizationContext authorizationContext = new UserNameAuthorizationContext(
                userName,
                RemoteAddressUtil.getClientIpAddr(request)
        );
        userRepository.updateUser(user, authorizationContext);
        CurrentUser.set(request, user);

        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(user);

        return super.handle(vertexId, conceptType, visibilitySource, vertexTitle,
                latitude, longitude, propertiesJsonString, shouldPublish, justificationText, sourceInfo,
                workspaceId, resourceBundle, user, authorizations);
    }

    @Inject
    public void setUserRepository(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Inject
    public void setAuthorizationRepository(AuthorizationRepository authorizationRepository) {
        this.authorizationRepository = authorizationRepository;
    }
}
