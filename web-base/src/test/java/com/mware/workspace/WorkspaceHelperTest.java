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
package com.mware.workspace;

import com.mware.core.config.Configuration;
import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.termMention.TermMentionRepository;
import com.mware.core.model.user.GraphAuthorizationRepository;
import com.mware.core.model.user.InMemoryGraphAuthorizationRepository;
import com.mware.core.model.user.PrivilegeRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.WorkspaceHelper;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.DirectVisibilityTranslator;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.ge.Authorizations;
import com.mware.ge.Edge;
import com.mware.ge.Vertex;
import com.mware.ge.Visibility;
import com.mware.ge.inmemory.InMemoryGraph;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.runners.MockitoJUnitRunner;

import static com.mware.core.model.schema.SchemaConstants.CONCEPT_TYPE_THING;
import static com.mware.core.model.schema.SchemaRepository.PUBLIC;
import static org.junit.Assert.assertNull;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class WorkspaceHelperTest {
    private static final String WORKSPACE_ID = "WORKSPACE_1234";
    private InMemoryGraph graph;
    private Visibility visibility;
    private Visibility termMentionVisibility;
    private Authorizations authorizations;
    private VisibilityTranslator visibilityTranslator;
    private WorkspaceHelper workspaceHelper;
    private TermMentionRepository termMentionRepository;
    private GraphAuthorizationRepository authorizationsRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WorkQueueRepository workQueueRepository;

    @Mock
    private WebQueueRepository webQueueRepository;

    @Mock
    private SchemaRepository schemaRepository;

    @Mock
    private WorkspaceRepository workspaceRepository;

    @Mock
    private PrivilegeRepository privilegeRepository;

    @Mock
    private AuthorizationRepository authorizationRepository;

    @Mock
    private User user;

    @Mock
    private Configuration configuration;

    @Before
    public void setUp() {
        graph = InMemoryGraph.create();

        visibility = new Visibility("");
        termMentionVisibility = new Visibility(TermMentionRepository.VISIBILITY_STRING);
        authorizations = graph.createAuthorizations(TermMentionRepository.VISIBILITY_STRING, WORKSPACE_ID);
        authorizationsRepository = new InMemoryGraphAuthorizationRepository();
        visibilityTranslator = new DirectVisibilityTranslator();
        termMentionRepository = new TermMentionRepository(graph, authorizationsRepository);

        when(schemaRepository.getRelationshipNameByIntent("entityHasImage", PUBLIC))
                .thenReturn("test#entityHasImage");
        when(schemaRepository.getRelationshipNameByIntent("artifactContainsImageOfEntity", PUBLIC))
                .thenReturn("test#artifactContainsImageOfEntity");

        workspaceHelper = new WorkspaceHelper(
                termMentionRepository,
                workQueueRepository,
                webQueueRepository,
                graph,
                schemaRepository,
                workspaceRepository,
                privilegeRepository,
                authorizationRepository,
                configuration
        );
    }

    @Test
    public void testUnresolveTerm() throws Exception {
        Vertex v1 = graph.addVertex("v1", visibility, authorizations, CONCEPT_TYPE_THING);
        Vertex v1tm1 = graph.addVertex("v1tm1", termMentionVisibility, authorizations, CONCEPT_TYPE_THING);
        BcSchema.TERM_MENTION_RESOLVED_EDGE_ID.setProperty(
                v1tm1,
                "v1_to_v2",
                termMentionVisibility,
                authorizations
        );
        Vertex v2 = graph.addVertex("v2", visibility, authorizations, CONCEPT_TYPE_THING);
        graph.addEdge(
                "v1_to_c1tm1",
                v1,
                v1tm1,
                BcSchema.TERM_MENTION_LABEL_HAS_TERM_MENTION,
                termMentionVisibility,
                authorizations
        );
        graph.addEdge(
                "c1tm1_to_v2",
                v1tm1,
                v2,
                BcSchema.TERM_MENTION_LABEL_RESOLVED_TO,
                termMentionVisibility,
                authorizations
        );
        Edge e = graph.addEdge("v1_to_v2", v1, v2, "link", visibility, authorizations);
        VisibilityJson visibilityJson = new VisibilityJson();
        visibilityJson.addWorkspace(WORKSPACE_ID);
        BcSchema.VISIBILITY_JSON.setProperty(e, visibilityJson, new Visibility(""), authorizations);
        graph.flush();

        workspaceHelper.unresolveTerm(v1tm1, authorizations);
        v1tm1 = graph.getVertex("v1tm1", authorizations);
        assertNull(v1tm1);
    }

    @Test
    public void testDeletePublicVertex() throws Exception {
        Vertex doc = graph.addVertex("doc", visibility, authorizations, CONCEPT_TYPE_THING);
        Vertex v1 = graph.addVertex("v1", visibility, authorizations, CONCEPT_TYPE_THING);
        Vertex tm = graph.addVertex("tm", termMentionVisibility, authorizations, CONCEPT_TYPE_THING);

        BcSchema.TERM_MENTION_RESOLVED_EDGE_ID.setProperty(tm, "doc_to_v1", termMentionVisibility, authorizations);
        graph.addEdge("doc_to_tm", doc, tm, BcSchema.TERM_MENTION_LABEL_HAS_TERM_MENTION, termMentionVisibility, authorizations);
        graph.addEdge("v1_to_tm", tm, v1, BcSchema.TERM_MENTION_LABEL_RESOLVED_TO, termMentionVisibility, authorizations);
        Edge e = graph.addEdge("doc_to_v1", doc, v1, "link", visibility, authorizations);
        VisibilityJson visibilityJson = new VisibilityJson();
        BcSchema.VISIBILITY_JSON.setProperty(e, visibilityJson, new Visibility(""), authorizations);
        graph.flush();
        workspaceHelper.deleteVertex(v1, WORKSPACE_ID, true, Priority.HIGH, authorizations, user);

        v1 = graph.getVertex("v1", authorizations);
        tm = graph.getVertex("tm", authorizations);
        assertNull(v1);
        assertNull(tm);
    }
}
