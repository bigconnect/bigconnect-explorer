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
package com.mware.search;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.core.model.clientapi.dto.ClientApiElementSearchResponse;
import com.mware.core.model.clientapi.dto.ClientApiGeObject;
import com.mware.core.model.clientapi.dto.ClientApiSearchResponse;
import com.mware.core.model.search.SearchOptions;
import com.mware.core.model.search.SearchRunner;
import com.mware.core.user.User;
import com.mware.core.util.ClientApiConverter;
import com.mware.ge.Authorizations;
import com.mware.ge.Edge;
import com.mware.ge.Vertex;
import com.mware.ge.cypher.GeCypherExecutionEngine;
import com.mware.ge.cypher.Result;
import com.mware.web.model.ClientApiTabularSearchResponse;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

@Singleton
public class CypherSearchRunner extends SearchRunner {
    public static final String URI = "/search/advanced/cypher";
    protected long defaultSearchResultCount;
    private GeCypherExecutionEngine executionEngine;

    @Inject
    public CypherSearchRunner(Configuration configuration, GeCypherExecutionEngine executionEngine) {
        this.defaultSearchResultCount = configuration.getInt(Configuration.DEFAULT_SEARCH_RESULT_COUNT, 100);
        this.executionEngine = executionEngine;
    }

    @Override
    public ClientApiSearchResponse run(
            SearchOptions searchOptions,
            User user,
            Authorizations authorizations
    ) {
        String queryString = searchOptions.getRequiredParameter("query", String.class);
        long startQueryTime = System.currentTimeMillis();
        Result cypherResult = executionEngine.executeQuery(queryString, authorizations);

        Long offset = searchOptions.getOptionalParameter("offset", 0L);
        Long size = searchOptions.getOptionalParameter("size", defaultSearchResultCount);

        ClientApiElementSearchResponse elementResults = new ClientApiElementSearchResponse();
        ClientApiTabularSearchResponse tabularResults = new ClientApiTabularSearchResponse();
        tabularResults.getColumns().addAll(cypherResult.columns());

        AtomicBoolean resultHasElements = new AtomicBoolean(false);
        AtomicBoolean resultHasTable = new AtomicBoolean(false);
        AtomicLong totalCount = new AtomicLong(0);

        while (cypherResult.hasNext()) {
            if (offset > 0 && offset <= totalCount.get()) {
                cypherResult.next();
                continue;
            }

            if (totalCount.get() > (size + offset))
                break;

            Map<String, Object> row = cypherResult.next();
            Map<String, String> tableRow = new HashMap<>();
            totalCount.incrementAndGet();

            cypherResult.columns().forEach(column -> {
                Object value = row.get(column);
                if (value instanceof Vertex) {
                    ClientApiGeObject vo = ClientApiConverter.toClientApiVertex((Vertex) value, searchOptions.getWorkspaceId(), authorizations);
                    elementResults.getElements().add(vo);
                    resultHasElements.set(true);
                } else if (value instanceof Edge) {
                    ClientApiGeObject vo = ClientApiConverter.toClientApiEdge((Edge) value, searchOptions.getWorkspaceId());
                    elementResults.getElements().add(vo);
                    resultHasElements.set(true);
                } else {
                    String strValue = value == null ? "" : value.toString();
                    if (!tabularResults.getColumnTypes().containsKey(column)) {
                        tabularResults.getColumnTypes().put(column, value != null ? value.getClass().getName() : null);
                    } else if (tabularResults.getColumnTypes().containsKey(column) && tabularResults.getColumnTypes().get(column) == null && value != null) {
                        tabularResults.getColumnTypes().put(column, value.getClass().getName());
                    }

                    tableRow.put(column, strValue);
                    resultHasTable.set(true);
                }
            });

            if (!tableRow.isEmpty())
                tabularResults.getRows().add(tableRow);
        }

        ClientApiSearchResponse result = null;

        if (!resultHasElements.get() && !resultHasTable.get()) {
            // no results returned from query, default to element results
            result = elementResults;
        }

        result = resultHasElements.get() ? elementResults : tabularResults;
        long queryRetrivalTime = System.currentTimeMillis() - startQueryTime;

        result.setTotalTime(queryRetrivalTime);

        return result;
    }

    @Override
    public String getUri() {
        return URI;
    }
}
