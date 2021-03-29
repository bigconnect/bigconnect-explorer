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

import com.mware.core.model.schema.SchemaConstants;
import com.mware.core.model.search.EdgeSearchRunner;
import com.mware.core.model.search.QueryResultsIterableSearchResults;
import com.mware.core.model.search.SearchOptions;
import com.mware.ge.Vertex;
import org.json.JSONArray;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.runners.MockitoJUnitRunner;

import java.util.HashMap;
import java.util.Map;

import static com.google.common.collect.Iterables.size;
import static com.mware.core.model.schema.SchemaConstants.CONCEPT_TYPE_THING;
import static com.mware.ge.values.storable.Values.stringValue;
import static org.junit.Assert.assertEquals;

@RunWith(MockitoJUnitRunner.class)
public class EdgeSearchRunnerTest extends SearchRunnerTestBase {
    private EdgeSearchRunner edgeSearchRunner;

    @Before
    public void before() {
        super.before();

        edgeSearchRunner = new EdgeSearchRunner(
                schemaRepository,
                graph,
                configuration
        );
    }

    @Test
    public void testSearch() throws Exception {
        Vertex v1 = graph.addVertex("v1", visibility, authorizations, CONCEPT_TYPE_THING);
        Vertex v2 = graph.addVertex("v2", visibility, authorizations, CONCEPT_TYPE_THING);
        Vertex v3 = graph.addVertex("v3", visibility, authorizations, CONCEPT_TYPE_THING);
        graph.prepareEdge("e1", v1, v2, "label1", visibility)
                .addPropertyValue("k1", "name", stringValue("Joe"), visibility)
                .save(authorizations);
        graph.prepareEdge("e2", v1, v3, "label1", visibility)
                .addPropertyValue("k1", "name", stringValue("Bob"), visibility)
                .save(authorizations);
        graph.flush();

        Map<String, Object> parameters = new HashMap<>();
        parameters.put("q", "*");
        parameters.put("filter", new JSONArray());
        SearchOptions searchOptions = new SearchOptions(parameters, "workspace1");

        QueryResultsIterableSearchResults results = edgeSearchRunner.run(searchOptions, user, authorizations);
        assertEquals(2, size(results.getGeObjects()));
    }
}
