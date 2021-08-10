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

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.clientapi.dto.ClientApiElementSearchResponse;
import com.mware.core.model.clientapi.dto.PropertyType;
import com.mware.core.model.schema.SchemaProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.util.ClientApiConverter;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Vertex;
import com.mware.ge.query.GeoCompare;
import com.mware.ge.query.QueryResultsIterable;
import com.mware.ge.query.builder.GeQueryBuilders;
import com.mware.ge.values.storable.Values;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.ActiveWorkspaceId;

@Singleton
public class VertexGeoSearch implements ParameterizedHandler {
    private final Graph graph;
    private final SchemaRepository schemaRepository;

    @Inject
    public VertexGeoSearch(
            final Graph graph,
            final SchemaRepository schemaRepository
    ) {
        this.graph = graph;
        this.schemaRepository = schemaRepository;
    }

    @Handle
    public ClientApiElementSearchResponse handle(
            @Required(name = "lat") double latitude,
            @Required(name = "lon") double longitude,
            @Required(name = "radius") double radius,
            @ActiveWorkspaceId String workspaceId,
            Authorizations authorizations
    ) throws Exception {
        ClientApiElementSearchResponse results = new ClientApiElementSearchResponse();

        for (SchemaProperty property : this.schemaRepository.getProperties(workspaceId)) {
            if (property.getDataType() != PropertyType.GEO_LOCATION) {
                continue;
            }
            QueryResultsIterable<Vertex> vertices = graph.query(
                    GeQueryBuilders.hasFilter(property.getName(), GeoCompare.WITHIN, Values.geoCircleValue(latitude, longitude, radius)),
                    authorizations
            ).vertices();
            for (Vertex vertex : vertices) {
                results.getElements().add(ClientApiConverter.toClientApiVertex(vertex, workspaceId, authorizations));
            }
            vertices.close();
        }

        return results;
    }
}
