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
import com.mware.core.model.clientapi.dto.ClientApiVertex;
import com.mware.core.model.search.SearchOptions;
import com.mware.core.model.search.SearchRepository;
import com.mware.core.model.search.VertexFindRelatedSearchResults;
import com.mware.core.model.search.VertexFindRelatedSearchRunner;
import com.mware.core.user.User;
import com.mware.core.util.ClientApiConverter;
import com.mware.ge.Authorizations;
import com.mware.ge.Element;
import com.mware.ge.Vertex;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.model.ClientApiElementFindRelatedResponse;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.routes.search.WebSearchOptionsFactory;

import javax.servlet.http.HttpServletRequest;

@Singleton
public class VertexFindRelated implements ParameterizedHandler {
    private final VertexFindRelatedSearchRunner searchRunner;

    @Inject
    public VertexFindRelated(SearchRepository searchRepository) {
        this.searchRunner =
                (VertexFindRelatedSearchRunner) searchRepository.findSearchRunnerByUri(VertexFindRelatedSearchRunner.URI);
    }

    @Handle
    public ClientApiElementFindRelatedResponse handle(
            HttpServletRequest request,
            @ActiveWorkspaceId String workspaceId,
            User user,
            Authorizations authorizations
    ) throws Exception {
        SearchOptions searchOptions = WebSearchOptionsFactory.create(request, workspaceId);
        return getVertices(searchOptions, user, authorizations);
    }

    /**
     * This is overridable so web plugins can modify the resulting set of vertices.
     */
    protected ClientApiElementFindRelatedResponse getVertices(
            SearchOptions searchOptions,
            User user,
            Authorizations authorizations
    ) {
        VertexFindRelatedSearchResults results = this.searchRunner.run(searchOptions, user, authorizations);
        ClientApiElementFindRelatedResponse response = new ClientApiElementFindRelatedResponse();
        for (Element element : results.getGeObjects()) {
            Vertex vertex = (Vertex) element;
            ClientApiVertex clientApiVertex = ClientApiConverter.toClientApiVertex(vertex, searchOptions.getWorkspaceId(), authorizations);
            response.getElements().add(clientApiVertex);
        }
        response.setCount(results.getCount());
        return response;
    }

}

