package com.mware.web.routes.vertex;

import com.google.common.collect.Lists;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.ClientApiVertex;
import com.mware.core.model.graph.GraphRepository;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.model.workspace.WorkspaceRepository;
import com.mware.core.model.workspace.WorkspaceHelper;
import com.mware.core.security.AuditService;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.core.util.ClientApiConverter;
import com.mware.core.util.SandboxStatusUtil;
import com.mware.ge.Authorizations;
import com.mware.ge.Property;
import com.mware.ge.Vertex;
import com.mware.ge.Visibility;
import com.mware.security.ACLProvider;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.routes.SetPropertyBase;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.model.clientapi.dto.VisibilityJson;

// These imports are needed to mimic the logic from VertexSetProperty.
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.ge.util.IterableUtils;

import javax.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.ResourceBundle;

/**
 * This router fetches all vertices for a given concept (e.g., "facebookPost") that have at least one of
 * the classification properties and removes the following properties from each found vertex:
 * <p>
 * - topicClassification1, topicClassification2, …, topicClassification10
 * - otherRelevantKeywords
 * - otherRelevantBuckets
 * <p>
 * Note: For efficiency, we manually filter vertices by concept by iterating over all vertices available
 * from the graph and then further filtering out those that do not have any of the properties to delete.
 */
@Singleton
public class VertexRemoveClassificationProperties extends SetPropertyBase implements ParameterizedHandler {

    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexRemoveClassificationProperties.class);

    // List of classification-related property names to remove.
    private static final List<String> CLASSIFICATION_PROPS = Arrays.asList(
            // CamelCase versions
            "topicClassification1", "topicClassification2", "topicClassification3",
            "topicClassification4", "topicClassification5", "topicClassification6",
            "topicClassification7", "topicClassification8", "topicClassification9",
            "topicClassification10",
            // Snake_case versions
            "topic_classification_1", "topic_classification_2", "topic_classification_3",
            "topic_classification_4", "topic_classification_5", "topic_classification_6",
            "topic_classification_7", "topic_classification_8", "topic_classification_9",
            "topic_classification_10",
            // The other two properties
            "otherRelevantKeywords", "otherRelevantBuckets"
    );

    private final GraphRepository graphRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;
    private final ACLProvider aclProvider;
    private final WorkspaceHelper workspaceHelper;
    private final AuditService auditService;

    @Inject
    public VertexRemoveClassificationProperties(
            com.mware.ge.Graph graph,
            VisibilityTranslator visibilityTranslator,
            WorkspaceRepository workspaceRepository,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository,
            WorkspaceHelper workspaceHelper,
            GraphRepository graphRepository,
            ACLProvider aclProvider,
            Configuration configuration,
            AuditService auditService
    ) {
        super(graph, visibilityTranslator);
        this.workspaceRepository = workspaceRepository;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
        this.workspaceHelper = workspaceHelper;
        this.graphRepository = graphRepository;
        this.aclProvider = aclProvider;
        this.auditService = auditService;
    }

    /**
     * Removes classification properties from all vertices of the specified concept that have
     * at least one of the classification properties.
     *
     * This endpoint now accepts GET requests.
     *
     * @param request          The HTTP request.
     * @param concept          The entity type/concept to process (e.g., "facebookPost").
     * @param visibilitySource (Optional) A visibility source string.
     * @param workspaceId      The active workspace identifier.
     * @param resourceBundle   A resource bundle.
     * @param user             The current user.
     * @param authorizations   The current authorizations.
     * @return A list of ClientApiVertex objects reflecting the updated vertices.
     * @throws Exception If there is an error during processing.
     */
    @Handle
    public List<ClientApiVertex> handle(
            HttpServletRequest request,
            @Required(name = "concept") String concept,
            @Optional(name = "visibilitySource") String visibilitySource,
            @ActiveWorkspaceId String workspaceId,
            ResourceBundle resourceBundle,
            User user,
            Authorizations authorizations
    ) throws Exception {
        checkRoutePath("vertex", concept, request);

        Visibility defaultVisibility = (visibilitySource != null)
                ? visibilityTranslator.toVisibility(new VisibilityJson(visibilitySource)).getVisibility()
                : new Visibility("");

        List<Vertex> allVertices = new ArrayList<>();
        for (Vertex vertex : graph.getVertices(authorizations)) {
            if (concept.equals(vertex.getConceptType())) {
                allVertices.add(vertex);
            }
        }

        if (allVertices.isEmpty()) {
            throw new BcException("No vertices found for concept: " + concept);
        }

        List<Vertex> vertices = new ArrayList<>();
        for (Vertex vertex : allVertices) {
            boolean hasClassificationProp = false;
            for (Property property : vertex.getProperties()) {
                if (CLASSIFICATION_PROPS.contains(property.getName())) {
                    hasClassificationProp = true;
                    break;
                }
            }
            if (hasClassificationProp) {
                vertices.add(vertex);
            }
        }
        if (vertices.isEmpty()) {
            throw new BcException("No vertices found for concept: " + concept +
                    " that contain any of the classification properties.");
        }

        List<ClientApiVertex> results = new ArrayList<>();
        for (Vertex vertex : vertices) {
            List<Property> props = IterableUtils.toList(vertex.getProperties());
            for (Property property : props) {
                if (CLASSIFICATION_PROPS.contains(property.getName())) {
                    SandboxStatus[] sandboxStatuses = SandboxStatusUtil.getPropertySandboxStatuses(props, workspaceId);
                    boolean isPropertyPublic = sandboxStatuses[props.indexOf(property)] == SandboxStatus.PUBLIC;

                    workspaceHelper.deleteProperty(vertex, property, isPropertyPublic, workspaceId, Priority.HIGH, authorizations, user);
                }
            }
            results.add((ClientApiVertex) ClientApiConverter.toClientApi(vertex, workspaceId, authorizations));
        }

        graph.flush();

        return results;
    }
}
