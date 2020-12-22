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
import com.mware.core.ingest.video.VideoTranscript;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.MediaBcSchema;
import com.mware.core.model.termMention.TermMentionRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Vertex;
import com.mware.ge.values.storable.StreamingPropertyValue;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.textHighlighting.EntityHighlighter;
import com.mware.web.util.JsonSerializer;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;


@Singleton
public class VertexHighlightedText implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(VertexHighlightedText.class);
    private final Graph graph;
    private final EntityHighlighter entityHighlighter;
    private final TermMentionRepository termMentionRepository;

    @Inject
    public VertexHighlightedText(
            final Graph graph,
            final EntityHighlighter entityHighlighter,
            final TermMentionRepository termMentionRepository
    ) {
        this.graph = graph;
        this.entityHighlighter = entityHighlighter;
        this.termMentionRepository = termMentionRepository;
    }

    @Handle
    public void handle(
            @Required(name = "graphVertexId") String graphVertexId,
            @Required(name = "propertyKey") String propertyKey,
            @Optional(name = "propertyName") String propertyName,
            @ActiveWorkspaceId String workspaceId,
            User user,
            Authorizations authorizations,
            BcResponse response
    ) throws Exception {
        Authorizations authorizationsWithTermMention = termMentionRepository.getAuthorizations(authorizations);

        Vertex artifactVertex = graph.getVertex(graphVertexId, authorizations);
        if (artifactVertex == null) {
             LOGGER.warn("Could not find vertex with id: " + graphVertexId);
             return;
        }

        if (Strings.isNullOrEmpty(propertyName)) {
            propertyName = BcSchema.TEXT.getPropertyName();
        }

        Object textPropertyValue = artifactVertex.getPropertyValue(propertyKey, propertyName);
        if (textPropertyValue != null) {
            response.setContentType("text/html");

            LOGGER.debug("returning text for vertexId:%s property:%s", artifactVertex.getId(), propertyKey);
            InputStream inputStream = null;
            if (textPropertyValue instanceof StreamingPropertyValue) {
                inputStream = ((StreamingPropertyValue)textPropertyValue).getInputStream();
            } else if (textPropertyValue instanceof String) {
                inputStream = new ByteArrayInputStream(((String) textPropertyValue).getBytes(StandardCharsets.UTF_8));
            }

            if (inputStream == null) {
                response.respondWithHtml("");
            } else {
                Iterable<Vertex> termMentions = termMentionRepository.findByOutVertexAndProperty(artifactVertex.getId(), propertyKey, propertyName, authorizationsWithTermMention);
                entityHighlighter.transformHighlightedText(inputStream, response.getOutputStream(), termMentions, workspaceId, authorizationsWithTermMention);
            }
        }

        VideoTranscript videoTranscript = MediaBcSchema.VIDEO_TRANSCRIPT.getPropertyValue(artifactVertex, propertyKey);
        if (videoTranscript != null) {
            LOGGER.debug("returning video transcript for vertexId:%s property:%s", artifactVertex.getId(), propertyKey);
            Iterable<Vertex> termMentions = termMentionRepository.findByOutVertexAndProperty(artifactVertex.getId(), propertyKey, propertyName, authorizations);
            VideoTranscript highlightedVideoTranscript = entityHighlighter.getHighlightedVideoTranscript(videoTranscript, termMentions, workspaceId, authorizations);
            response.setContentType("application/json");
            response.respondWithJson(highlightedVideoTranscript.toJson());
        }

        videoTranscript = JsonSerializer.getSynthesisedVideoTranscription(artifactVertex, propertyKey);
        if (videoTranscript != null) {
            LOGGER.debug("returning synthesised video transcript for vertexId:%s property:%s", artifactVertex.getId(), propertyKey);
            Iterable<Vertex> termMentions = termMentionRepository.findByOutVertexAndProperty(artifactVertex.getId(), propertyKey, propertyName, authorizations);
            VideoTranscript highlightedVideoTranscript = entityHighlighter.getHighlightedVideoTranscript(videoTranscript, termMentions, workspaceId, authorizationsWithTermMention);
            response.setContentType("application/json");
            response.respondWithJson(highlightedVideoTranscript.toJson());
        }
    }
}
