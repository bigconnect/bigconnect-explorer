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
package com.mware.web.routes.vertex;

import com.google.common.base.Strings;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.ClientApiImportProperty;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workspace.Workspace;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.ClientApiConverter;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Vertex;
import com.mware.ge.Visibility;
import com.mware.ingest.FileImport;
import com.mware.web.BadRequestException;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.model.ClientApiArtifactImportResponse;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.util.HttpPartUtil;
import com.mware.workspace.WorkspaceHelper;
import org.apache.commons.fileupload.FileUploadBase;
import org.apache.commons.fileupload.ParameterParser;
import org.apache.commons.fileupload.servlet.ServletFileUpload;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.IOUtils;
import org.json.JSONArray;
import org.json.JSONException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.Part;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.ResourceBundle;
import java.util.concurrent.atomic.AtomicInteger;

@Singleton
public class VertexImport implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexImport.class);
    private static final String PARAMS_FILENAME = "filename";
    private static final String UNKNOWN_FILENAME = "unknown_filename";
    private static final String TEMP_DIR_CONFIG = VertexImport.class.getName() + ".tempDir";
    private final Graph graph;
    private final FileImport fileImport;
    private final WorkspaceRepository workspaceRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final WorkspaceHelper workspaceHelper;
    private Path uploadTempDir;
    private Authorizations authorizations;
    private final boolean autoPublish;
    public static final String WORKSPACE_AUTO_PUBLISH_KEY = "workspace.autopublish";

    @Inject
    public VertexImport(
            Graph graph,
            FileImport fileImport,
            WorkspaceRepository workspaceRepository,
            VisibilityTranslator visibilityTranslator,
            WorkspaceHelper workspaceHelper,
            Configuration configuration
    ) {
        this.graph = graph;
        this.fileImport = fileImport;
        this.workspaceRepository = workspaceRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.workspaceHelper = workspaceHelper;
        this.autoPublish = configuration.getBoolean(WORKSPACE_AUTO_PUBLISH_KEY, false);

        try {
            String configuredTempDir = configuration.get(TEMP_DIR_CONFIG, null);
            if (Strings.isNullOrEmpty(configuredTempDir)) {
                uploadTempDir = Files.createTempDirectory("VertexImport-");
                //uploadTempDir.toFile().deleteOnExit();
            } else {
                uploadTempDir = Paths.get(configuredTempDir);
                if (!Files.exists(uploadTempDir)) {
                    Files.createDirectories(uploadTempDir);
                }
            }
        } catch (IOException ioe) {
            throw new BcException("Unable to create temporary directory.", ioe);
        }
    }

    protected String getOriginalFilename(Part part) {
        ParameterParser parser = new ParameterParser();
        parser.setLowerCaseNames(true);

        final Map params = parser.parse(part.getHeader(FileUploadBase.CONTENT_DISPOSITION), ';');
        if (params.containsKey(PARAMS_FILENAME)) {
            String name = (String) params.get(PARAMS_FILENAME);
            if (!Strings.isNullOrEmpty(name)) {
                return name;
            }
        }

        return UNKNOWN_FILENAME;
    }

    @Handle
    public ClientApiArtifactImportResponse handle(
            @Optional(name = "publish", defaultValue = "false") boolean shouldPublish,
            @Optional(name = "addToWorkspace", defaultValue = "false") boolean addToWorkspace,
            @Optional(name = "findExistingByFileHash", defaultValue = "true") boolean findExistingByFileHash,
            @ActiveWorkspaceId String workspaceId,
            Authorizations authorizations,
            User user,
            ResourceBundle resourceBundle,
            HttpServletRequest request
    ) throws Exception {
        if (!ServletFileUpload.isMultipartContent(request)) {
            throw new BadRequestException("file", "Could not process request without multi-part content");
        }

        workspaceId = workspaceHelper.getWorkspaceIdOrNullIfPublish(workspaceId, shouldPublish, user);

        this.authorizations = authorizations;

        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory(uploadTempDir, "upload-");
            List<FileImport.FileOptions> files = getFiles(request, tempDir, resourceBundle, authorizations, user);
            if (files == null) {
                throw new BadRequestException("file", "Could not process request without files");
            }

            Workspace workspace = null;

            if (!autoPublish) {
                workspace = workspaceRepository.findById(workspaceId, user);
            }
            List<Vertex> vertices = fileImport.importVertices(
                    workspace,
                    files,
                    Priority.HIGH,
                    addToWorkspace,
                    findExistingByFileHash,
                    user,
                    authorizations
            );

            return toArtifactImportResponse(vertices);
        } finally {
            if (tempDir != null) {
                FileUtils.deleteDirectory(tempDir.toFile());
            }
        }
    }

    protected ClientApiArtifactImportResponse toArtifactImportResponse(List<Vertex> vertices) {
        ClientApiArtifactImportResponse response = new ClientApiArtifactImportResponse();
        for (Vertex vertex : vertices) {
            response.getVertexIds().add(vertex.getId());
        }
        return response;
    }

    protected List<FileImport.FileOptions> getFiles(
            HttpServletRequest request,
            Path tempDir,
            ResourceBundle resourceBundle,
            Authorizations authorizations,
            User user
    ) throws Exception {
        List<String> invalidVisibilities = new ArrayList<>();
        List<FileImport.FileOptions> files = new ArrayList<>();
        AtomicInteger visibilitySourceIndex = new AtomicInteger(0);
        AtomicInteger conceptIndex = new AtomicInteger(0);
        AtomicInteger fileIndex = new AtomicInteger(0);
        AtomicInteger propertiesIndex = new AtomicInteger(0);
        AtomicInteger titleIndex = new AtomicInteger(0);
        for (Part part : request.getParts()) {
            if (part.getName().equals("file")) {
                String originalFileName = getOriginalFilename(part);
                File outFile = Files.createTempFile(tempDir, null, null).toFile();
                HttpPartUtil.copyPartToFile(part, outFile);
                addFileToFilesList(files, fileIndex.getAndIncrement(), outFile, originalFileName);
            } else if (part.getName().equals("conceptId")) {
                String conceptId = IOUtils.toString(part.getInputStream(), "UTF8");
                addConceptIdToFilesList(files, conceptIndex.getAndIncrement(), conceptId);
            } else if (part.getName().equals("properties")) {
                String propertiesString = IOUtils.toString(part.getInputStream(), "UTF8");
                ClientApiImportProperty[] properties = convertPropertiesStringToClientApiImportProperties(
                        propertiesString);
                addPropertiesToFilesList(files, propertiesIndex.getAndIncrement(), properties);
            } else if (part.getName().equals("visibilitySource")) {
                String visibilitySource = IOUtils.toString(part.getInputStream(), "UTF8");
                Visibility visibility = visibilityTranslator.toVisibility(visibilitySource).getVisibility();
                if (!graph.isVisibilityValid(visibility, authorizations)) {
                    invalidVisibilities.add(visibilitySource);
                }
                addVisibilityToFilesList(files, visibilitySourceIndex.getAndIncrement(), visibilitySource);
            } else if(part.getName().equals("title")) {
                String title = IOUtils.toString(part.getInputStream(), "UTF8");
                addTitleToFilesList(files, titleIndex.getAndIncrement(), title);
            }
        }

        if (invalidVisibilities.size() > 0) {
            LOGGER.warn(
                    "%s is not a valid visibility for %s user",
                    invalidVisibilities.toString(),
                    user.getDisplayName()
            );
            throw new BadRequestException(
                    "visibilitySource",
                    resourceBundle.getString("visibility.invalid"),
                    invalidVisibilities
            );
        }

        return files;
    }

    protected ClientApiImportProperty[] convertPropertiesStringToClientApiImportProperties(String propertiesString) throws Exception {
        JSONArray properties = new JSONArray(propertiesString);
        ClientApiImportProperty[] clientApiProperties = new ClientApiImportProperty[properties.length()];
        for (int i = 0; i < properties.length(); i++) {
            String propertyString;
            try {
                propertyString = properties.getJSONObject(i).toString();
            } catch (JSONException e) {
                throw new BcException("Could not parse properties json", e);
            }
            clientApiProperties[i] = ClientApiConverter.toClientApi(propertyString, ClientApiImportProperty.class);
        }
        return clientApiProperties;
    }

    protected void addPropertiesToFilesList(
            List<FileImport.FileOptions> files,
            int index,
            ClientApiImportProperty[] properties
    ) {
        ensureFilesSize(files, index);
        if (properties != null && properties.length > 0) {
            files.get(index).setProperties(properties);
        }
    }

    protected void addConceptIdToFilesList(List<FileImport.FileOptions> files, int index, String conceptId) {
        ensureFilesSize(files, index);
        if (conceptId != null && conceptId.length() > 0) {
            files.get(index).setConceptId(conceptId);
        }
    }

    protected void addVisibilityToFilesList(List<FileImport.FileOptions> files, int index, String visibilitySource) {
        ensureFilesSize(files, index);
        files.get(index).setVisibilitySource(visibilitySource);
    }

    protected void addTitleToFilesList(List<FileImport.FileOptions> files, int index, String title) {
        ensureFilesSize(files, index);
        files.get(index).setTitle(title);
    }

    protected void addFileToFilesList(List<FileImport.FileOptions> files, int index, File file, String originalFilename) {
        ensureFilesSize(files, index);
        FileImport.FileOptions fileOptions = files.get(index);
        fileOptions.setFile(file);
        fileOptions.setOriginalFilename(originalFilename);
    }

    private void ensureFilesSize(List<FileImport.FileOptions> files, int index) {
        while (files.size() <= index) {
            files.add(new FileImport.FileOptions());
        }
    }

    public Graph getGraph() {
        return graph;
    }

    protected Authorizations getAuthorizations() {
        return authorizations;
    }
}
