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

import com.google.common.collect.Lists;
import com.google.inject.Inject;
import com.mware.core.exception.BcResourceNotFoundException;
import com.mware.core.ingest.structured.model.ClientApiAnalysis;
import com.mware.core.ingest.structured.model.StructuredIngestParser;
import com.mware.core.ingest.structured.model.StructuredIngestParserFactory;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.user.User;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Vertex;
import com.mware.ge.values.storable.StreamingPropertyValue;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.utils.StringUtils;
import org.apache.commons.io.IOUtils;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.List;

public class Analyze implements ParameterizedHandler {
    private final Graph graph;
    private final StructuredIngestParserFactory structuredIngestParserFactory;

    @Inject
    public Analyze(Graph graph, StructuredIngestParserFactory structuredIngestParserFactory) {
        this.graph = graph;
        this.structuredIngestParserFactory = structuredIngestParserFactory;
    }

    @Handle
    public ClientApiAnalysis handle(
            Authorizations authorizations,
            @Optional(name = "graphVertexId") String graphVertexId,
            @Optional(name = "tmpFilePath") String tmpFilePath,
            User user
    ) throws Exception {
        if(!StringUtils.isEmpty(graphVertexId) && !"null".equals(graphVertexId)) {
            Vertex vertex = graph.getVertex(graphVertexId, authorizations);
            if (vertex == null) {
                throw new BcResourceNotFoundException("Could not find vertex:" + graphVertexId);
            }

            StreamingPropertyValue rawPropertyValue = BcSchema.RAW.getPropertyValue(vertex);
            if (rawPropertyValue == null) {
                throw new BcResourceNotFoundException("Could not find raw property on vertex:" + graphVertexId);
            }

            List<String> mimeTypes = Lists.newArrayList(BcSchema.MIME_TYPE.getPropertyValues(vertex));
            for (String mimeType : mimeTypes) {
                StructuredIngestParser parser = structuredIngestParserFactory.getParser(mimeType);
                if (parser != null) {
                    try (InputStream inputStream = rawPropertyValue.getInputStream()) {
                        return parser.analyze(inputStream, user, authorizations);
                    }
                }
            }
        } else if (!StringUtils.isEmpty(tmpFilePath) && !"null".equals(tmpFilePath)) {
            StructuredIngestParser parser = structuredIngestParserFactory.getParser(AnalyzeFile.guessMimeType(tmpFilePath));
            if (parser != null) {
                FileInputStream is = new FileInputStream(tmpFilePath);
                byte[] fileData = IOUtils.toByteArray(is);
                return parser.analyze(new ByteArrayInputStream(fileData), user, authorizations);
            }
        }

        return null;
    }
}
