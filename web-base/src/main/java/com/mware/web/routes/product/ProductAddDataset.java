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
package com.mware.web.routes.product;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.ClientApiGeObject;
import com.mware.core.model.clientapi.dto.ClientApiObject;
import com.mware.core.model.clientapi.dto.ClientApiVertex;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.graph.GraphUpdateContext;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.ge.Authorizations;
import com.mware.ge.GeObject;
import com.mware.ge.Vertex;
import com.mware.product.GetExtendedDataParams;
import com.mware.product.Product;
import com.mware.product.WorkProductService;
import com.mware.product.WorkProductServiceHasElements;
import com.mware.search.*;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiElementSearchResponse;
import com.mware.web.model.ClientApiSearch;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.parameterProviders.SourceGuid;
import com.mware.workspace.WebWorkspaceRepository;
import com.mware.workspace.WorkspaceHelper;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Singleton
public class ProductAddDataset implements ParameterizedHandler {
    private static int MAX_VERTICES_TO_RETURN = 2000;

    private final WebWorkspaceRepository webWorkspaceRepository;
    private final SearchRepository searchRepository;
    private final WorkspaceHelper workspaceHelper;
    private final GraphRepository graphRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final AuthorizationRepository authorizationRepository;

    @Inject
    public ProductAddDataset(
            WebWorkspaceRepository webWorkspaceRepository,
            SearchRepository searchRepository,
            WorkspaceHelper workspaceHelper,
            GraphRepository graphRepository,
            VisibilityTranslator visibilityTranslator,
            AuthorizationRepository authorizationRepository
    ) {
        this.webWorkspaceRepository = webWorkspaceRepository;
        this.searchRepository = searchRepository;
        this.workspaceHelper = workspaceHelper;
        this.graphRepository = graphRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.authorizationRepository = authorizationRepository;
    }

    @Handle
    public ClientApiAddDatasetToProductResponse handle(
            @Required(name = "productId") String productId,
            @Required(name = "searchId") String searchId,
            @ActiveWorkspaceId String workspaceId,
            @SourceGuid String sourceGuid,
            User user,
            Authorizations authorizations
    ) {
        ClientApiSearch savedSearch = this.searchRepository.getSavedSearch(searchId, user);
        Product product = webWorkspaceRepository.findProductById(workspaceId, productId, new GetExtendedDataParams(), false, user);

        if(product != null && savedSearch != null) {
            SearchRunner searchRunner = searchRepository.findSearchRunnerByUri(savedSearch.url);
            savedSearch.parameters.put("size", MAX_VERTICES_TO_RETURN);
            SearchOptions searchOptions = new SearchOptions(savedSearch.parameters, workspaceId);
            SearchResults results = searchRunner.run(searchOptions, user, authorizations);
            if (results instanceof GeObjectsSearchResults) {
                try {
                    GeObjectsSearchResults searchResults = (GeObjectsSearchResults) results;
                    Set<String> updateVertices = new HashSet<>();
                    for (GeObject obj : searchResults.getGeObjects()) {
                        if (!(obj instanceof Vertex))
                            continue;

                        updateVertices.add(obj.getId().toString());
                    }
                    addElementIdsToProduct(product, updateVertices, workspaceId, productId, sourceGuid, user, authorizations);
                    ClientApiAddDatasetToProductResponse response = new ClientApiAddDatasetToProductResponse();
                    response.resultsTruncated = false;
                    return response;
                } catch (Exception ex) {
                    ex.printStackTrace();
                    throw new BcException("Could not get search results for saved search: " + searchId);
                }
            } else if (results instanceof ClientApiElementSearchResponse) {
                ClientApiElementSearchResponse cypherResults = (ClientApiElementSearchResponse) results;
                Set<String> vertexIds = cypherResults.getElements().stream()
                        .filter(e -> e instanceof ClientApiVertex)
                        .map(e -> ((ClientApiVertex) e).getId())
                        .collect(Collectors.toSet());
                addElementIdsToProduct(product, vertexIds, workspaceId, productId, sourceGuid, user, authorizations);
                ClientApiAddDatasetToProductResponse response = new ClientApiAddDatasetToProductResponse();
                response.resultsTruncated = false;
                return response;
            } else
                throw new BcException("I don't know how to handle search results of type: "+results.getClass().getName());
        }

        throw new BcException("Could not find product or saved search");
    }

    private void addElementIdsToProduct(Product product, Set<String> ids, String workspaceId, String productId, String sourceGuid, User user, Authorizations authorizations) {
        Vertex productVertex = webWorkspaceRepository.getProductVertex(workspaceId, productId, user);
        WorkProductService workProductService = webWorkspaceRepository.getWorkProductServiceByKind(product.getKind());
        if(!(workProductService instanceof WorkProductServiceHasElements)) {
            throw new BcException("This product does not support adding elements");
        }

        try (GraphUpdateContext ctx = graphRepository.beginGraphUpdate(Priority.LOW, user, authorizations)) {
            ((WorkProductServiceHasElements) workProductService).addElements(
                    ctx,
                    productVertex,
                    ids,
                    visibilityTranslator.getDefaultVisibility()
            );
        } catch (Exception e) {
            e.printStackTrace();
            throw new BcException("Could not update vertices in product: " + productId);
        }

        workspaceHelper.broadcastWorkProductChange(workspaceId, productId, sourceGuid, user, authorizations);
    }

    static class ClientApiAddDatasetToProductResponse implements ClientApiObject {
        public boolean resultsTruncated = false;
        public int threshold = MAX_VERTICES_TO_RETURN;
    }
}
