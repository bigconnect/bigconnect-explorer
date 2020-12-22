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
package com.mware.web.routes.structuredIngest;

import com.mware.core.exception.BcException;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.clientapi.dto.ClientApiObject;
import com.mware.core.model.longRunningProcess.LongRunningProcessRepository;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.schema.SchemaConstants;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.user.PrivilegeRepository;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.*;
import com.mware.ge.values.storable.ByteArray;
import com.mware.ge.values.storable.DefaultStreamingPropertyValue;
import com.mware.ge.values.storable.StreamingPropertyValue;
import com.mware.ge.values.storable.TextValue;
import com.mware.ingest.structured.mapping.ParseMapping;
import com.mware.ingest.structured.model.*;
import com.mware.ingest.structured.util.BaseStructuredFileParserHandler;
import com.mware.ingest.structured.util.GraphBuilderParserHandler;
import com.mware.ingest.structured.util.ProgressReporter;
import com.mware.ingest.structured.worker.StructuredIngestProcessWorker;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.framework.utils.StringUtils;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.workspace.WorkspaceHelper;
import org.apache.commons.io.IOUtils;
import org.json.JSONArray;
import org.json.JSONObject;

import javax.inject.Inject;
import java.io.*;

public class Ingest implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(Ingest.class);

    private final LongRunningProcessRepository longRunningProcessRepository;
    private final SchemaRepository schemaRepository;
    private final PrivilegeRepository privilegeRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceHelper workspaceHelper;
    private final WebQueueRepository webQueueRepository;
    private final Graph graph;
    private final StructuredIngestParserFactory structuredIngestParserFactory;

    @Inject
    public Ingest(
        LongRunningProcessRepository longRunningProcessRepository,
        SchemaRepository schemaRepository,
        PrivilegeRepository privilegeRepository,
        WorkspaceRepository workspaceRepository,
        WorkspaceHelper workspaceHelper,
        StructuredIngestParserFactory structuredIngestParserFactory,
        WebQueueRepository webQueueRepository,
        VisibilityTranslator visibilityTranslator,
        Graph graph
    ) {
        this.longRunningProcessRepository = longRunningProcessRepository;
        this.schemaRepository = schemaRepository;
        this.privilegeRepository = privilegeRepository;
        this.workspaceHelper = workspaceHelper;
        this.workspaceRepository = workspaceRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.structuredIngestParserFactory = structuredIngestParserFactory;
        this.webQueueRepository = webQueueRepository;
        this.graph = graph;
    }

    @Handle
    public ClientApiObject handle(
            User user,
            @ActiveWorkspaceId String workspaceId,
            Authorizations authorizations,
            @Optional(name = "graphVertexId") String graphVertexId,
            @Optional(name = "tmpFile") String tmpFile,
            @Required(name = "mapping") String mapping,
            @Optional(name = "parseOptions") String optionsJson,
            @Optional(name = "publish", defaultValue = "false") boolean publish,
            @Optional(name = "preview", defaultValue = "true") boolean preview
    ) throws Exception {
        Vertex vertex = null;
        if(!StringUtils.isEmpty(graphVertexId) && !"null".equals(graphVertexId)) {
            vertex = graph.getVertex(graphVertexId, authorizations);
            if (vertex == null) {
                throw new BcResourceNotFoundException("Could not find vertex:" + graphVertexId);
            }
        }

        ParseMapping parseMapping = new ParseMapping(schemaRepository, visibilityTranslator, workspaceId, mapping);
        ClientApiMappingErrors mappingErrors = parseMapping.validate(authorizations);
        if (mappingErrors.mappingErrors.size() > 0) {
            return mappingErrors;
        }

        if (preview) {
            return previewIngest(user, workspaceId, authorizations, optionsJson, publish, vertex, tmpFile != null ? new File(tmpFile) : null, parseMapping);
        } else {
            if(vertex == null) {
                Visibility newVertexVisibility = new Visibility(workspaceId);
                VertexBuilder vb = graph.prepareVertex(newVertexVisibility, SchemaConstants.CONCEPT_TYPE_THING);
                BcSchema.MIME_TYPE.addPropertyValue(vb, "", AnalyzeFile.guessMimeType(tmpFile), newVertexVisibility);
                BcSchema.TITLE.addPropertyValue(vb, "", "File Import "+System.currentTimeMillis(), newVertexVisibility);
                StreamingPropertyValue rawValue = new DefaultStreamingPropertyValue(new FileInputStream(tmpFile), ByteArray.class);
                rawValue.searchIndex(false);
                BcSchema.RAW.setProperty(vb, rawValue, newVertexVisibility);
                vertex = vb.save(authorizations);
                graph.flush();
            }

            return enqueueIngest(user, workspaceId, authorizations, vertex.getId(), mapping, optionsJson, publish);
        }
    }

    private ClientApiObject enqueueIngest(
            User user,
            String workspaceId,
            Authorizations authorizations,
            String graphVertexId,
            String mapping,
            String optionsJson,
            boolean publish
    ) {
        StructuredIngestQueueItem queueItem = new StructuredIngestQueueItem(workspaceId, mapping, user.getUserId(), graphVertexId, StructuredIngestProcessWorker.TYPE, new ParseOptions(optionsJson), publish, authorizations);
        this.longRunningProcessRepository.enqueue(queueItem.toJson(), user, authorizations);
        return BcResponse.SUCCESS;
    }

    private ClientApiObject previewIngest(
            User user,
            String workspaceId,
            Authorizations authorizations,
            String optionsJson,
            boolean publish,
            Vertex vertex,
            File tmpFile,
            ParseMapping parseMapping
    ) throws Exception {
        JSONObject data = new JSONObject();
        JSONObject permissions = new JSONObject();
        JSONArray users = new JSONArray();
        users.put(user.getUserId());
        permissions.put("users", users);

        ProgressReporter reporter = new ProgressReporter() {
            public void finishedRow(long row, long totalRows) {
                if (totalRows != -1) {
                    long total = Math.min(GraphBuilderParserHandler.MAX_DRY_RUN_ROWS, totalRows);
                    data.put("row", row);
                    data.put("total", total);

                    // Broadcast when we get this change in percent
                    int percent = (int) ((double)total * 0.01);

                    if (percent > 0 && row % percent == 0) {
                        JSONObject json = new JSONObject();
                        json.putOpt("permissions", permissions);
                        json.putOpt("data", data);
                        json.put("type", "structuredImportDryrun");
                        webQueueRepository.broadcastJson(json);
                    }
                }
            }
        };

        GraphBuilderParserHandler parserHandler = new GraphBuilderParserHandler(
                graph,
                user,
                visibilityTranslator,
                privilegeRepository,
                authorizations,
                workspaceRepository,
                workspaceHelper,
                workspaceId,
                publish,
                vertex,
                parseMapping,
                reporter,
                schemaRepository);

        parserHandler.dryRun = true;
        ParseOptions parseOptions = new ParseOptions(optionsJson);


        if(vertex != null) {
            StreamingPropertyValue rawPropertyValue = BcSchema.RAW.getPropertyValue(vertex);
            if (rawPropertyValue == null) {
                throw new BcResourceNotFoundException("Could not find raw property on vertex:" + vertex.getId());
            }
            parseUsingVertex(vertex, rawPropertyValue, parseOptions, parserHandler, user);
        } else {
            parseUsingFile(tmpFile, parseOptions, parserHandler, user);
        }


        if (parserHandler.hasErrors()) {
            return parserHandler.parseErrors;
        }
        return parserHandler.clientApiIngestPreview;
    }

    private void parseUsingFile(
            File tmpFile,
            ParseOptions parseOptions,
            BaseStructuredFileParserHandler parserHandler,
            User user) throws Exception
    {
        String mimeType = AnalyzeFile.guessMimeType(tmpFile.getName());
        StructuredIngestParser structuredIngestParser = structuredIngestParserFactory.getParser(mimeType);
        if (structuredIngestParser == null) {
            throw new BcException("No parser registered for mimeType: " + mimeType);
        }

        try {
            FileInputStream is = new FileInputStream(tmpFile);
            byte[] fileData = IOUtils.toByteArray(is);
            structuredIngestParser.ingest(new ByteArrayInputStream(fileData), parseOptions, parserHandler, user);
        } catch (FileNotFoundException e) {
            throw new BcException("The uploaded file was not found: "+tmpFile);
        }
    }

    private void parseUsingVertex(
            Vertex vertex,
            StreamingPropertyValue rawPropertyValue,
            ParseOptions parseOptions,
            BaseStructuredFileParserHandler parserHandler,
            User user
    ) throws Exception
    {
        TextValue mimeType = (TextValue) vertex.getPropertyValue(BcSchema.MIME_TYPE.getPropertyName());
        if (mimeType == null) {
            throw new BcException("No mimeType property found for vertex");
        }

        StructuredIngestParser structuredIngestParser = structuredIngestParserFactory.getParser(mimeType.stringValue());
        if (structuredIngestParser == null) {
            throw new BcException("No parser registered for mimeType: " + mimeType);
        }

        try (InputStream in = rawPropertyValue.getInputStream()) {
            structuredIngestParser.ingest(in, parseOptions, parserHandler, user);
        }
    }
}
