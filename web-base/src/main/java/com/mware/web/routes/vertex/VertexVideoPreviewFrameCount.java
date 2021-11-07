package com.mware.web.routes.vertex;

import com.google.inject.Inject;
import com.mware.core.model.properties.MediaBcSchema;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.*;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;

public class VertexVideoPreviewFrameCount implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexVideoPreviewImage.class);
    private static final int DEFAULT_PREVIEW_FRAMES = 20;

    private final Graph graph;

    @Inject
    public VertexVideoPreviewFrameCount(final Graph graph) {
        this.graph = graph;
    }

    @Handle
    public long handle(
            @Required(name = "graphVertexId") String graphVertexId,
            Authorizations authorizations
    ) throws Exception {
        Vertex artifactVertex = graph.getVertex(graphVertexId, FetchHints.PROPERTIES_AND_METADATA, authorizations);
        if (artifactVertex == null) {
            LOGGER.warn("Could not find vertex with id: " + graphVertexId);
            return DEFAULT_PREVIEW_FRAMES;
        }

        Property property = MediaBcSchema.VIDEO_PREVIEW_IMAGE.getProperty(artifactVertex);
        if (property != null) {
            Long frameCount = MediaBcSchema.METADATA_VIDEO_PREVIEW_FRAMES.getMetadataValue(property);
            return frameCount != null ? frameCount : DEFAULT_PREVIEW_FRAMES;
        }

        return DEFAULT_PREVIEW_FRAMES;
    }
}
