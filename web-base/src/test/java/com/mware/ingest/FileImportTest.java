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
package com.mware.ingest;

import com.mware.core.config.Configuration;
import com.mware.core.ingest.FileImportSupportingFileHandler;
import com.mware.core.ingest.PostFileImportHandler;
import com.mware.core.model.clientapi.dto.ClientApiImportProperty;
import com.mware.core.model.properties.RawObjectSchema;
import com.mware.core.model.properties.types.IntegerBcProperty;
import com.mware.core.model.schema.SchemaProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.AuditService;
import com.mware.core.security.DirectVisibilityTranslator;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.ge.*;
import com.mware.ge.inmemory.InMemoryGraph;
import com.mware.ge.values.storable.StringValue;
import org.apache.commons.io.FileUtils;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.runners.MockitoJUnitRunner;

import java.io.File;
import java.util.*;

import static com.mware.ge.util.IterableUtils.toList;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class FileImportTest {
    public static final String PROP1_NAME = "prop1";
    private FileImport fileImport;

    private Graph graph;

    private VisibilityTranslator visibilityTranslator;

    @Mock
    private WorkQueueRepository workQueueRepository;

    @Mock
    private WebQueueRepository webQueueRepository;

    @Mock
    private WorkspaceRepository workspaceRepository;

    @Mock
    private SchemaRepository schemaRepository;

    @Mock
    private Configuration configuration;

    @Mock
    private AuditService auditService;

    @Mock
    User user;

    Authorizations authorizations;

    @Mock
    Workspace workspace;

    @Mock
    SchemaProperty schemaProperty;

    @Before
    public void setup() {
        graph = InMemoryGraph.create();
        graph.defineProperty(RawObjectSchema.CONTENT_HASH.getPropertyName())
                .dataType(StringValue.class)
                .textIndexHint(EnumSet.of(TextIndexHint.EXACT_MATCH)).define();

        visibilityTranslator = new DirectVisibilityTranslator();

        String workspaceId = "junit-workspace";
        authorizations = graph.createAuthorizations(workspaceId);

        when(workspace.getWorkspaceId()).thenReturn(workspaceId);

        when(schemaRepository.getRequiredPropertyByIntent(PROP1_NAME, workspaceId)).thenReturn(schemaProperty);
        when(schemaProperty.geBcProperty()).thenReturn(new IntegerBcProperty(PROP1_NAME));

        fileImport = new FileImport(
                visibilityTranslator,
                graph,
                workQueueRepository,
                webQueueRepository,
                workspaceRepository,
                schemaRepository,
                configuration,
                auditService
        ) {
            @Override
            protected List<PostFileImportHandler> getPostFileImportHandlers() {
                return new ArrayList<>();
            }

            @Override
            protected List<FileImportSupportingFileHandler> getFileImportSupportingFileHandlers() {
                return new ArrayList<>();
            }
        };
    }

    @Test
    public void testImportVertices() throws Exception {
        File testFile = File.createTempFile("test", "test");
        try {
            FileUtils.writeStringToFile(testFile, "<html><head><title>Test HTML</title><body>Hello Test</body></html>");

            List<FileImport.FileOptions> files = new ArrayList<>();
            FileImport.FileOptions file = new FileImport.FileOptions();
            file.setConceptId("testConcept");
            file.setFile(testFile);
            ClientApiImportProperty[] properties = new ClientApiImportProperty[1];
            properties[0] = new ClientApiImportProperty();
            properties[0].setKey("k1");
            properties[0].setName(PROP1_NAME);
            properties[0].setVisibilitySource("");
            properties[0].setValue("42");
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("m1", "v1");
            properties[0].setMetadata(metadata);
            file.setProperties(properties);
            file.setVisibilitySource("");
            files.add(file);
            Priority priority = Priority.NORMAL;
            List<Vertex> results = fileImport.importVertices(
                    workspace,
                    files,
                    priority,
                    false,
                    true,
                    user,
                    authorizations
            );
            assertEquals(1, results.size());

            Vertex v1 = graph.getVertex(results.get(0).getId(), authorizations);
            List<Property> foundProperties = toList(v1.getProperties());
            assertEquals(6, foundProperties.size());
            for (int i = 0; i < 6; i++) {
                Property foundProperty = foundProperties.get(i);
                if (foundProperty.getName().equals(PROP1_NAME)) {
                    assertEquals("k1", foundProperty.getKey());
                    assertEquals(42, foundProperty.getValue());
                    assertEquals(1, foundProperty.getMetadata().entrySet().size());
                    assertEquals("v1", foundProperty.getMetadata().getValue("m1"));
                }
            }
        } finally {
            testFile.delete();
        }
    }

    @Test
    public void testImportDuplicateFiles() throws Exception {
        boolean findExistingByFileHash = true;
        ImportTwiceResults results = importFileTwice(findExistingByFileHash);
        assertEquals(results.firstVertexId, results.secondVertexId);
    }

    @Test
    public void testImportDuplicateFilesIgnoreHash() throws Exception {
        boolean findExistingByFileHash = false;
        ImportTwiceResults results = importFileTwice(findExistingByFileHash);
        assertNotEquals(results.firstVertexId, results.secondVertexId);
    }

    private ImportTwiceResults importFileTwice(boolean findExistingByFileHash) throws Exception {
        File testFile = File.createTempFile("test", "test");
        try {
            FileUtils.writeStringToFile(testFile, "Hello World");

            List<FileImport.FileOptions> files = new ArrayList<>();
            FileImport.FileOptions file = new FileImport.FileOptions();
            file.setConceptId("testConcept");
            file.setFile(testFile);
            file.setVisibilitySource("");
            files.add(file);

            Priority priority = Priority.NORMAL;
            List<Vertex> results = fileImport.importVertices(
                    workspace,
                    files,
                    priority,
                    false,
                    findExistingByFileHash,
                    user,
                    authorizations
            );
            assertEquals(1, results.size());
            String firstVertexId = results.get(0).getId();

            results = fileImport.importVertices(
                    workspace,
                    files,
                    priority,
                    false,
                    findExistingByFileHash,
                    user,
                    authorizations
            );
            assertEquals(1, results.size());
            String secondVertexId = results.get(0).getId();

            return new ImportTwiceResults(firstVertexId, secondVertexId);
        } finally {
            testFile.delete();
        }
    }

    private static class ImportTwiceResults {
        public final String firstVertexId;
        public final String secondVertexId;

        public ImportTwiceResults(String firstVertexId, String secondVertexId) {
            this.firstVertexId = firstVertexId;
            this.secondVertexId = secondVertexId;
        }
    }
}
