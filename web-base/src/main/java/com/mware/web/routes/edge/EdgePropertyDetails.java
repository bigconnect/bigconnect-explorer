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
package com.mware.web.routes.edge;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.clientapi.dto.ClientApiSourceInfo;
import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.termMention.TermMentionRepository;
import com.mware.core.security.BcVisibility;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.*;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiEdgePropertyDetails;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.util.VisibilityValidator;

import java.util.ResourceBundle;

@Singleton
public class EdgePropertyDetails implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(EdgePropertyDetails.class);
    private final Graph graph;
    private final TermMentionRepository termMentionRepository;
    private final VisibilityTranslator visibilityTranslator;

    @Inject
    public EdgePropertyDetails(
            Graph graph,
            TermMentionRepository termMentionRepository,
            VisibilityTranslator visibilityTranslator
    ) {
        this.graph = graph;
        this.termMentionRepository = termMentionRepository;
        this.visibilityTranslator = visibilityTranslator;
    }

    @Handle
    public ClientApiEdgePropertyDetails handle(
            @Required(name = "edgeId") String edgeId,
            @Optional(name = "propertyKey") String propertyKey,
            @Required(name = "propertyName") String propertyName,
            @Required(name = "visibilitySource") String visibilitySource,
            @ActiveWorkspaceId String workspaceId,
            ResourceBundle resourceBundle,
            User user,
            Authorizations authorizations
    ) throws Exception {
        Visibility visibility = VisibilityValidator.validate(
                graph,
                visibilityTranslator,
                resourceBundle,
                visibilitySource,
                user,
                authorizations
        );

        Edge edge = this.graph.getEdge(edgeId, authorizations);
        if (edge == null) {
            throw new BcResourceNotFoundException("Could not find edge with id: " + edgeId, edgeId);
        }

        Property property = edge.getProperty(propertyKey, propertyName, visibility);
        if (property == null) {
            VisibilityJson visibilityJson = new VisibilityJson();
            visibilityJson.setSource(visibilitySource);
            visibilityJson.addWorkspace(workspaceId);
            BcVisibility v2 = visibilityTranslator.toVisibility(visibilityJson);
            property = edge.getProperty(propertyKey, propertyName, v2.getVisibility());
            if (property == null) {
                throw new BcResourceNotFoundException("Could not find property " + propertyKey + ":" + propertyName + ":" + visibility + " on edge with id: " + edgeId, edgeId);
            }
        }

        ClientApiSourceInfo sourceInfo = termMentionRepository.getSourceInfoForEdgeProperty(edge, property, authorizations);

        ClientApiEdgePropertyDetails result = new ClientApiEdgePropertyDetails();
        result.setSourceInfo(sourceInfo);
        return result;
    }
}
