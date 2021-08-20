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
import com.mware.core.model.search.QueryResultsIterableSearchResults;
import com.mware.core.model.search.SearchOptions;
import com.mware.core.model.search.VertexSearchRunner;
import com.mware.ge.ElementBuilder;
import com.mware.ge.Vertex;
import org.json.JSONArray;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.runners.MockitoJUnitRunner;

import java.util.HashMap;
import java.util.Map;

import static com.google.common.collect.Iterables.size;
import static com.mware.ge.values.storable.Values.stringValue;
import static org.junit.Assert.assertEquals;

@RunWith(MockitoJUnitRunner.class)
public class VertexSearchRunnerTest extends SearchRunnerTestBase {
    private VertexSearchRunner vertexSearchRunner;

    @Before
    public void before() {
        super.before();

        vertexSearchRunner = new VertexSearchRunner(
                schemaRepository,
                graph,
                configuration
        );
    }

    @Test
    public void testSearchRelated() {
        Vertex v1 = graph.prepareVertex("v1", visibility, "testConcept")
                .save(authorizations);
        Vertex v2 = graph.prepareVertex("v2", visibility, "testConcept")
                .save(authorizations);
        Vertex v3 = graph.prepareVertex("v3", visibility,"testConcept")
                .save(authorizations);
        graph.addEdge("v1v2", v1, v2, "label1", visibility, authorizations);
        graph.addEdge("v1v3", v1, v3, "label1", visibility, authorizations);
        graph.flush();

        Map<String, Object> parameters = new HashMap<>();
        parameters.put("relatedToVertexIds[]", new String[]{"v1"});
        parameters.put("filter", new JSONArray());
        SearchOptions searchOptions = new SearchOptions(parameters, "workspace1");

        QueryResultsIterableSearchResults results = vertexSearchRunner.run(searchOptions, user, authorizations);
        assertEquals(2, size(results.getGeObjects()));
    }

    @Test
    public void testSearch() {
        graph.prepareVertex("v1", visibility, SchemaConstants.CONCEPT_TYPE_THING)
                .addPropertyValue("k1", "name", stringValue("Joe"), visibility)
                .save(authorizations);
        graph.prepareVertex("v2", visibility, SchemaConstants.CONCEPT_TYPE_THING)
                .addPropertyValue("k1", "name", stringValue("Bob"), visibility)
                .save(authorizations);
        graph.flush();

        Map<String, Object> parameters = new HashMap<>();
        parameters.put("q", "*");
        parameters.put("filter", new JSONArray());
        SearchOptions searchOptions = new SearchOptions(parameters, "workspace1");

        QueryResultsIterableSearchResults results = vertexSearchRunner.run(searchOptions, user, authorizations);
        assertEquals(2, size(results.getGeObjects()));
    }
}
