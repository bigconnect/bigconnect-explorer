package com.mware.web.routes.vertex;

import com.google.inject.Inject;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.termMention.TermMentionRepository;
import com.mware.core.model.workspace.WorkspaceHelper;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.Authorizations;
import com.mware.ge.Direction;
import com.mware.ge.Graph;
import com.mware.ge.Vertex;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;

import static com.mware.ge.util.IterableUtils.singleOrDefault;

public class DeleteTermEntity implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(UnresolveTermEntity.class);
    private final TermMentionRepository termMentionRepository;
    private final Graph graph;
    private final WorkspaceHelper workspaceHelper;

    @Inject
    public DeleteTermEntity(
            final TermMentionRepository termMentionRepository,
            final Graph graph,
            final WorkspaceHelper workspaceHelper
    ) {
        this.termMentionRepository = termMentionRepository;
        this.graph = graph;
        this.workspaceHelper = workspaceHelper;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "termMentionId") String termMentionId,
            @ActiveWorkspaceId String workspaceId,
            Authorizations authorizations
    ) throws Exception {
        LOGGER.debug("DeleteTermEntity (termMentionId: %s)", termMentionId);

        Vertex termMention = termMentionRepository.findById(termMentionId, authorizations);
        if (termMention == null) {
            throw new BcResourceNotFoundException("Could not find term mention with id: " + termMentionId);
        }

        Authorizations authorizationsWithTermMention = termMentionRepository.getAuthorizations(authorizations);
        Vertex resolvedVertex = singleOrDefault(termMention.getVertices(Direction.OUT, BcSchema.TERM_MENTION_LABEL_RESOLVED_TO, authorizationsWithTermMention), null);
        if (resolvedVertex == null) {
            throw new BcResourceNotFoundException("Could not find resolved vertex from term mention: " + termMentionId);
        }

        workspaceHelper.unresolveTerm(termMention, authorizations);
        graph.deleteVertex(resolvedVertex, authorizations);
        graph.flush();

        return BcResponse.SUCCESS;
    }
}

