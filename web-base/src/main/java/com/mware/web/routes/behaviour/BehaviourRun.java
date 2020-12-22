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
package com.mware.web.routes.behaviour;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.clientapi.dto.ClientApiElement;
import com.mware.core.user.User;
import com.mware.core.util.ClientApiConverter;
import com.mware.ge.Authorizations;
import com.mware.search.*;
import com.mware.search.behaviour.Behaviour;
import com.mware.search.behaviour.BehaviourRepository;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiElementSearchResponse;
import com.mware.web.model.ClientApiSearch;
import com.mware.web.parameterProviders.ActiveWorkspaceId;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@Singleton
public class BehaviourRun implements ParameterizedHandler {
    private final BehaviourRepository behaviourRepository;
    private final SearchRepository searchRepository;
    private GeObjectSearchRunnerBase searchRunner;

    @Inject
    public BehaviourRun(BehaviourRepository behaviourRepository, SearchRepository searchRepository) {
        this.behaviourRepository = behaviourRepository;
        this.searchRepository = searchRepository;
        this.searchRunner = (GeObjectSearchRunnerBase) searchRepository.findSearchRunnerByUri(VertexSearchRunner.URI);
    }

    @Handle
    public ClientApiElementSearchResponse handle(
            @ActiveWorkspaceId String workspaceId,
            User user,
            @Required(name = "id") String id,
            Authorizations authorizations
    ) throws Exception {
        Behaviour behaviour = behaviourRepository.findById(id);
        if (behaviour == null) {
            throw new BcResourceNotFoundException("behaviour with id="+id+" was not found.");
        }

        ClientApiElementSearchResponse result = new ClientApiElementSearchResponse();
        Map<String, ClientApiElement> tempMap = Collections.synchronizedMap(new HashMap<>());

        behaviour.getQueries().parallelStream().forEach(query -> {
            ClientApiSearch savedSearch = searchRepository.getSavedSearch(query.getSavedSearchId(), user);
            SearchRunner searchRunner = searchRepository.findSearchRunnerByUri(savedSearch.url);
            SearchOptions searchOptions = new SearchOptions(savedSearch.parameters, workspaceId);
            GeObjectsSearchResults searchResults = (GeObjectsSearchResults) searchRunner.run(searchOptions, user, authorizations);

            searchResults.getGeObjects().forEach(geObj -> {
                ClientApiElement apiObj = (ClientApiElement) ClientApiConverter.toClientApi(geObj, workspaceId, authorizations);
                if(tempMap.containsKey(apiObj.getId())) {
                    ClientApiElement oldObj = tempMap.get(apiObj.getId());
                    int newScore = (int) (oldObj.getScore() + query.getScore());
                    oldObj.setScore((double) newScore);
                } else {
                    apiObj.setScore((double) query.getScore());
                    tempMap.put(apiObj.getId(), apiObj);
                }
            });
        });

        result.getElements().addAll(
                tempMap.values().parallelStream()
                    .filter(clientApiElement -> clientApiElement.getScore() >= behaviour.getThreshold())
                    .collect(Collectors.toList())
        );

        return result;
    }
}
