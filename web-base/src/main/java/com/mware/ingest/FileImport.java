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

import com.google.common.base.Strings;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.core.ingest.FileImportSupportingFileHandler;
import com.mware.core.ingest.MetadataFileImportSupportingFileHandler;
import com.mware.core.ingest.PostFileImportHandler;
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.clientapi.dto.ClientApiImportProperty;
import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.RawObjectSchema;
import com.mware.core.model.properties.types.BcProperty;
import com.mware.core.model.properties.types.BcPropertyUpdate;
import com.mware.core.model.properties.types.PropertyMetadata;
import com.mware.core.model.schema.SchemaConstants;
import com.mware.core.model.schema.SchemaProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.AuditEventType;
import com.mware.core.security.AuditService;
import com.mware.core.security.BcVisibility;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.RowKeyHelper;
import com.mware.core.util.ServiceLoaderUtil;
import com.mware.ge.*;
import com.mware.ge.query.QueryResultsIterable;
import com.mware.ge.values.storable.ByteArray;
import com.mware.ge.values.storable.DefaultStreamingPropertyValue;
import com.mware.ge.values.storable.StreamingPropertyValue;
import com.mware.ge.values.storable.Values;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.text.ParseException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import static com.mware.ge.util.IterableUtils.toList;

@Singleton
public class FileImport {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(FileImport.class);
    public static final String MULTI_VALUE_KEY = FileImport.class.getName();
    private final VisibilityTranslator visibilityTranslator;
    private final Graph graph;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final WorkspaceRepository workspaceRepository;
    private final SchemaRepository schemaRepository;
    private final Configuration configuration;
    private final AuditService auditService;
    private List<FileImportSupportingFileHandler> fileImportSupportingFileHandlers;
    private List<PostFileImportHandler> postFileImportHandlers;

    @Inject
    public FileImport(
            VisibilityTranslator visibilityTranslator,
            Graph graph,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository,
            WorkspaceRepository workspaceRepository,
            SchemaRepository schemaRepository,
            Configuration configuration,
            AuditService auditService
    ) {
        this.visibilityTranslator = visibilityTranslator;
        this.graph = graph;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
        this.workspaceRepository = workspaceRepository;
        this.schemaRepository = schemaRepository;
        this.configuration = configuration;
        this.auditService = auditService;
    }

    public void importDirectory(
            File dataDir,
            boolean queueDuplicates,
            String conceptTypeIRI,
            String visibilitySource,
            Workspace workspace,
            Priority priority,
            User user,
            Authorizations authorizations
    ) throws IOException {
        ensureInitialized();

        LOGGER.debug("Importing files from %s", dataDir);
        File[] files = dataDir.listFiles();
        if (files == null || files.length == 0) {
            return;
        }

        int totalFileCount = files.length;
        int fileCount = 0;
        int importedFileCount = 0;
        try {
            for (File f : files) {
                if (f.getName().startsWith(".") || f.length() == 0) {
                    continue;
                }
                if (isSupportingFile(f)) {
                    continue;
                }

                LOGGER.debug("Importing file (%d/%d): %s", fileCount + 1, totalFileCount, f.getAbsolutePath());
                try {
                    importFile(
                            f,
                            f.getName(),
                            queueDuplicates,
                            conceptTypeIRI,
                            null,
                            visibilitySource,
                            null,
                            workspace,
                            true,
                            priority,
                            user,
                            authorizations
                    );
                    importedFileCount++;
                } catch (Exception ex) {
                    LOGGER.error("Could not import %s", f.getAbsolutePath(), ex);
                }
                fileCount++;
            }
        } finally {
            graph.flush();
        }

        LOGGER.debug(String.format("Imported %d, skipped %d files from %s", importedFileCount, fileCount - importedFileCount, dataDir));
    }

    private boolean isSupportingFile(File f) {
        for (FileImportSupportingFileHandler fileImportSupportingFileHandler : this.fileImportSupportingFileHandlers) {
            if (fileImportSupportingFileHandler.isSupportingFile(f)) {
                return true;
            }
        }
        return false;
    }

    public Vertex importFile(
            File f,
            boolean queueDuplicates,
            String visibilitySource,
            String title,
            Workspace workspace,
            Priority priority,
            User user,
            Authorizations authorizations
    ) throws Exception {
        return importFile(
                f,
                f.getName(),
                queueDuplicates,
                null,
                null,
                visibilitySource,
                title,
                workspace,
                true,
                priority,
                user,
                authorizations
        );
    }

    @Deprecated
    public Vertex importFile(
            File f,
            boolean queueDuplicates,
            String conceptId,
            ClientApiImportProperty[] properties,
            String visibilitySource,
            String title,
            Workspace workspace,
            boolean addToWorkspace,
            boolean findExistingByFileHash,
            Priority priority,
            User user,
            Authorizations authorizations
    ) throws Exception {
        return importFile(
                f,
                f.getName(),
                queueDuplicates,
                conceptId,
                properties,
                visibilitySource,
                title,
                workspace,
                findExistingByFileHash,
                priority,
                user,
                authorizations
        );
    }

    @Deprecated
    public Vertex importFile(
            File f,
            boolean queueDuplicates,
            String conceptId,
            ClientApiImportProperty[] properties,
            String visibilitySource,
            String title,
            Workspace workspace,
            boolean findExistingByFileHash,
            Priority priority,
            User user,
            Authorizations authorizations
    ) throws Exception {
        return importFile(
                f,
                f.getName(),
                queueDuplicates,
                conceptId,
                properties,
                visibilitySource,
                title,
                workspace,
                findExistingByFileHash,
                priority,
                user,
                authorizations
        );
    }

    public Vertex importFile(
            File f,
            String originalFilename,
            boolean queueDuplicates,
            String conceptId,
            ClientApiImportProperty[] properties,
            String visibilitySource,
            String title,
            Workspace workspace,
            boolean findExistingByFileHash,
            Priority priority,
            User user,
            Authorizations authorizations
    ) throws Exception {
        Vertex vertex;
        ensureInitialized();

        String hash = calculateFileHash(f);

        if (findExistingByFileHash) {
            vertex = findExistingVertexWithHash(hash, authorizations);
            if (vertex != null) {
                LOGGER.debug("vertex already exists with hash %s", hash);
                if (queueDuplicates) {
                    LOGGER.debug(
                            "pushing %s on to %s queue",
                            vertex.getId()
                    );
                    if (workspace != null) {
                        workspaceRepository.updateEntityOnWorkspace(
                                workspace,
                                vertex.getId(),
                                user
                        );
                        webQueueRepository.broadcastPropertyChange(
                                vertex,
                                null,
                                null,
                                workspace.getWorkspaceId()
                        );

                        if (webQueueRepository.shouldBroadcast(priority)) {
                            webQueueRepository.broadcastPropertyChange(vertex, MULTI_VALUE_KEY, BcSchema.RAW.getPropertyName(), workspace.getWorkspaceId());
                        }

                        workQueueRepository.pushOnDwQueue(
                                vertex,
                                MULTI_VALUE_KEY,
                                BcSchema.RAW.getPropertyName(),
                                workspace.getWorkspaceId(),
                                visibilitySource,
                                priority,
                                ElementOrPropertyStatus.UPDATE,
                                null
                        );
                    } else {
                        if (webQueueRepository.shouldBroadcast(priority)) {
                            webQueueRepository.broadcastPropertyChange(vertex, MULTI_VALUE_KEY, BcSchema.RAW.getPropertyName(), null);
                        }

                        workQueueRepository.pushOnDwQueue(
                                vertex,
                                MULTI_VALUE_KEY,
                                BcSchema.RAW.getPropertyName(),
                                null,
                                null,
                                priority,
                                ElementOrPropertyStatus.UPDATE,
                                null
                        );
                    }
                }
                return vertex;
            }
        }

        List<FileImportSupportingFileHandler.AddSupportingFilesResult> addSupportingFilesResults = new ArrayList<>();

        try (FileInputStream fileInputStream = new FileInputStream(f)) {
            JSONObject metadataJson = loadMetadataJson(f);
            String predefinedId = null;
            if (metadataJson != null) {
                predefinedId = metadataJson.optString("id", null);
                String metadataVisibilitySource = metadataJson.optString("visibilitySource", null);
                if (metadataVisibilitySource != null) {
                    visibilitySource = metadataVisibilitySource;
                }
            }

            StreamingPropertyValue rawValue = new DefaultStreamingPropertyValue(fileInputStream, ByteArray.class);
            rawValue.searchIndex(false);

            ZonedDateTime modifiedDate = ZonedDateTime.now();

            VisibilityJson visibilityJson = VisibilityJson.updateVisibilitySourceAndAddWorkspaceId(null, visibilitySource, workspace == null ? null : workspace.getWorkspaceId());
            BcVisibility bcVisibility = this.visibilityTranslator.toVisibility(visibilityJson);
            Visibility visibility = bcVisibility.getVisibility();
            PropertyMetadata propertyMetadata = new PropertyMetadata(modifiedDate, user, 0.1, visibilityJson, visibility);

            Visibility defaultVisibility = visibilityTranslator.getDefaultVisibility();
            VisibilityJson defaultVisibilityJson = new VisibilityJson(defaultVisibility.getVisibilityString());
            PropertyMetadata defaultPropertyMetadata = new PropertyMetadata(modifiedDate, user, defaultVisibilityJson, defaultVisibility);

            VertexBuilder vertexBuilder;
            if (predefinedId == null) {
                vertexBuilder = this.graph.prepareVertex(visibility, conceptId != null ? conceptId : SchemaConstants.CONCEPT_TYPE_THING);
            } else {
                vertexBuilder = this.graph.prepareVertex(predefinedId, visibility, conceptId != null ? conceptId : SchemaConstants.CONCEPT_TYPE_THING);
            }
            List<BcPropertyUpdate> changedProperties = new ArrayList<>();
            BcSchema.RAW.updateProperty(changedProperties, null, vertexBuilder, rawValue, defaultPropertyMetadata);
            RawObjectSchema.CONTENT_HASH.updateProperty(changedProperties, null, vertexBuilder, MULTI_VALUE_KEY, hash, defaultPropertyMetadata);

            String fileName = Strings.isNullOrEmpty(originalFilename) ? f.getName() : originalFilename;
            BcSchema.FILE_NAME.updateProperty(changedProperties, null, vertexBuilder, MULTI_VALUE_KEY, fileName, propertyMetadata);
            BcSchema.MODIFIED_DATE.updateProperty(
                    changedProperties,
                    null,
                    vertexBuilder,
                    ZonedDateTime.ofInstant(Instant.ofEpochMilli(f.lastModified()), ZoneOffset.systemDefault()),
                    (Metadata) null,
                    defaultVisibility
            );
            BcSchema.MODIFIED_BY.updateProperty(
                    changedProperties,
                    null,
                    vertexBuilder,
                    user.getUserId(),
                    (Metadata) null,
                    defaultVisibility
            );
            BcSchema.VISIBILITY_JSON.updateProperty(
                    changedProperties,
                    null,
                    vertexBuilder,
                    visibilityJson,
                    (Metadata) null,
                    defaultVisibility
            );
            if (!StringUtils.isEmpty(title)) {
                LOGGER.info("#### Setting title "+title);
                BcSchema.TITLE.updateProperty(
                        changedProperties,
                        null,
                        vertexBuilder,
                        "",
                        title,
                        (Metadata) null,
                        defaultVisibility
                );
            }
            if (properties != null) {
                addProperties(properties, changedProperties, vertexBuilder, visibilityJson, workspace, user);
            }

            for (FileImportSupportingFileHandler fileImportSupportingFileHandler : this.fileImportSupportingFileHandlers) {
                FileImportSupportingFileHandler.AddSupportingFilesResult addSupportingFilesResult = fileImportSupportingFileHandler.addSupportingFiles(vertexBuilder, f, visibility);
                if (addSupportingFilesResult != null) {
                    addSupportingFilesResults.add(addSupportingFilesResult);
                }
            }

            vertex = vertexBuilder.save(authorizations);
            LOGGER.info("#### Reading title after save: "+BcSchema.TITLE.getFirstPropertyValue(vertex));
            graph.flush();

            for (PostFileImportHandler postFileImportHandler : this.postFileImportHandlers) {
                postFileImportHandler.handle(graph, vertex, changedProperties, workspace, propertyMetadata, visibility, user, authorizations);
            }


            String workspaceId = null;
            if (workspace != null) {
                workspaceRepository.updateEntityOnWorkspace(workspace, vertex.getId(), user);
                workspaceId = workspace.getWorkspaceId();
            }

            auditService.auditGenericEvent(user, workspaceId != null ? workspaceId : StringUtils.EMPTY,
                    AuditEventType.UPLOAD_FILE, "params", String.format("{file: %s, vid: %s}", f.getAbsolutePath(), vertex.getId()));

            LOGGER.debug("File %s imported. vertex id: %s", f.getAbsolutePath(), vertex.getId());
            LOGGER.debug("pushing %s on to %s queue", vertex.getId());

            this.webQueueRepository.broadcastPropertyChange(vertex, null, null, workspaceId);
            this.webQueueRepository.broadcastPropertiesChange(vertex, changedProperties, workspace == null ? null : workspace.getWorkspaceId(), priority);
            this.workQueueRepository.pushOnDwQueue(
                    vertex,
                    changedProperties,
                    workspace == null ? null : workspace.getWorkspaceId(),
                    visibilitySource,
                    priority
            );
            return vertex;
        } finally {
            for (FileImportSupportingFileHandler.AddSupportingFilesResult addSupportingFilesResult : addSupportingFilesResults) {
                addSupportingFilesResult.close();
            }
        }
    }

    private void addProperties(ClientApiImportProperty[] properties, List<BcPropertyUpdate> changedProperties, VertexBuilder vertexBuilder, VisibilityJson visibilityJson, Workspace workspace, User user) throws ParseException {
        for (ClientApiImportProperty property : properties) {
            SchemaProperty ontologyProperty = schemaRepository.getPropertyByName(property.getName(), workspace.getWorkspaceId());
            if (ontologyProperty == null) {
                ontologyProperty = schemaRepository.getRequiredPropertyByIntent(property.getName(), workspace.getWorkspaceId());
            }
            Object value = ontologyProperty.convertString(property.getValue());
            BcProperty prop = ontologyProperty.geBcProperty();
            PropertyMetadata propMetadata = new PropertyMetadata(user, visibilityJson, visibilityTranslator.getDefaultVisibility());
            for (Map.Entry<String, Object> metadataEntry : property.getMetadata().entrySet()) {
                propMetadata.add(metadataEntry.getKey(), Values.of(metadataEntry.getValue()), visibilityTranslator.getDefaultVisibility());
            }
            //noinspection unchecked
            prop.updateProperty(changedProperties, null, vertexBuilder, property.getKey(), value, propMetadata);
        }
    }

    public List<Vertex> importVertices(
            Workspace workspace,
            List<FileOptions> files,
            Priority priority,
            boolean addToWorkspace,
            boolean findExistingByFileHash,
            User user,
            Authorizations authorizations
    ) throws Exception {
        ensureInitialized();

        List<Vertex> vertices = new ArrayList<>();
        for (FileOptions file : files) {
            if (isSupportingFile(file.getFile())) {
                LOGGER.debug("Skipping file: %s (supporting file)", file.getFile().getAbsolutePath());
                continue;
            }
            LOGGER.debug("Processing file: %s", file.getFile().getAbsolutePath());
            Vertex vertex = importFile(
                    file.getFile(),
                    file.getOriginalFilename(),
                    true,
                    file.getConceptId(),
                    file.getProperties(),
                    file.getVisibilitySource(),
                    file.getTitle(),
                    workspace,
                    findExistingByFileHash,
                    priority,
                    user,
                    authorizations
            );

            vertices.add(vertex);
        }
        return vertices;
    }

    private JSONObject loadMetadataJson(File f) throws IOException {
        File metadataFile = MetadataFileImportSupportingFileHandler.getMetadataFile(f);
        if (metadataFile.exists()) {
            try (FileInputStream in = new FileInputStream(metadataFile)) {
                String fileContents = IOUtils.toString(in);
                return new JSONObject(fileContents);
            }
        }
        return null;
    }

    private void ensureInitialized() {
        if (fileImportSupportingFileHandlers == null) {
            fileImportSupportingFileHandlers = getFileImportSupportingFileHandlers();
        }

        if (postFileImportHandlers == null) {
            postFileImportHandlers = getPostFileImportHandlers();
        }
    }

    protected List<PostFileImportHandler> getPostFileImportHandlers() {
        return toList(ServiceLoaderUtil.load(PostFileImportHandler.class, this.configuration));
    }

    protected List<FileImportSupportingFileHandler> getFileImportSupportingFileHandlers() {
        return toList(ServiceLoaderUtil.load(FileImportSupportingFileHandler.class, this.configuration));
    }

    private Vertex findExistingVertexWithHash(String hash, Authorizations authorizations) {
        try (
                QueryResultsIterable<Vertex> results = this.graph.query(authorizations)
                        .has(RawObjectSchema.CONTENT_HASH.getPropertyName(), Values.stringValue(hash))
                        .vertices()
        ) {
            Iterator<Vertex> existingVertices = results.iterator();
            if (existingVertices.hasNext()) {
                return existingVertices.next();
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        return null;
    }

    private String calculateFileHash(File f) throws IOException {
        try (FileInputStream fileInputStream = new FileInputStream(f)) {
            return RowKeyHelper.buildSHA256KeyString(fileInputStream);
        }
    }

    public static class FileOptions {
        private File file;
        private String originalFilename;
        private String visibilitySource;
        private String conceptId;
        private String title;
        private ClientApiImportProperty[] properties;

        public File getFile() {
            return file;
        }

        public void setFile(File file) {
            this.file = file;
        }

        public String getOriginalFilename() {
            return originalFilename;
        }

        public void setOriginalFilename(String originalFilename) {
            this.originalFilename = originalFilename;
        }

        public String getConceptId() {
            return conceptId;
        }

        public void setConceptId(String conceptId) {
            this.conceptId = conceptId;
        }

        public String getVisibilitySource() {
            return visibilitySource;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public void setVisibilitySource(String visibilitySource) {
            this.visibilitySource = visibilitySource;
        }

        public void setProperties(ClientApiImportProperty[] properties) {
            this.properties = properties;
        }

        public ClientApiImportProperty[] getProperties() {
            return properties;
        }
    }
}
