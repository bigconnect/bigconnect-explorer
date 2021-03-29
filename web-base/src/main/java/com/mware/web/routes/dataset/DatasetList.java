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
package com.mware.web.routes.dataset;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.clientapi.dto.ClientApiObject;
import com.mware.core.model.clientapi.dto.ClientApiSearch;
import com.mware.core.model.clientapi.dto.ClientApiSearchListResponse;
import com.mware.core.model.search.SearchRepository;
import com.mware.core.user.User;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.routes.search.SearchList;

import java.util.Set;
import java.util.stream.Collectors;

@Singleton
public class DatasetList implements ParameterizedHandler {
    private final SearchRepository searchRepository;

    @Inject
    public DatasetList(SearchRepository searchRepository) {
        this.searchRepository = searchRepository;
    }

    @Handle
    public ClientApiDatasetListResponse handle(
            @Required(name = "pattern") String datasetPattern,
            @Required(name = "scope") ClientApiSearch.Scope scope,
            User user
    ) throws Exception {
        ClientApiSearchListResponse userSearches = new SearchList(searchRepository).handle(user);
        Set<String> savedSearches = userSearches.searches.stream()
                .filter(s -> s.scope.equals(scope))
                .filter(s -> s.name.startsWith(datasetPattern))
                .map(s -> s.name)
                .collect(Collectors.toSet());

        return new ClientApiDatasetListResponse(savedSearches);
    }

    public static class ClientApiDatasetListResponse implements ClientApiObject {

        public ClientApiDatasetListResponse() {
        }

        public ClientApiDatasetListResponse(Set<String> savedSearches) {
            this.savedSearches = savedSearches;
        }

        public Set<String> savedSearches;
    }
}
