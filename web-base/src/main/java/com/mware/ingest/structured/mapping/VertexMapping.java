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
package com.mware.ingest.structured.mapping;

import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.security.VisibilityTranslator;
import com.mware.ge.Authorizations;
import com.mware.ge.Visibility;
import com.mware.ingest.structured.model.ClientApiMappingErrors;
import com.mware.web.model.ClientApiDataSource;
import org.apache.commons.lang.StringUtils;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class VertexMapping {
    public static final String CONCEPT_TYPE = "conceptType";
    public static final String PROPERTY_MAPPING_AUTOMAP_KEY = "automap";
    public static final String PROPERTY_MAPPING_PROPERTIES_KEY = "properties";
    public static final String PROPERTY_MAPPING_VISIBILITY_KEY = "visibilitySource";

    public List<PropertyMapping> propertyMappings = new ArrayList<>();
    public VisibilityJson visibilityJson;
    public Visibility visibility;
    public String entityId;
    public boolean automap;

    public VertexMapping() {
    }

    public VertexMapping(SchemaRepository schemaRepository, VisibilityTranslator visibilityTranslator, String workspaceId, JSONObject vertexMapping) {
        String visibilitySource = vertexMapping.optString(PROPERTY_MAPPING_VISIBILITY_KEY);
        if(!StringUtils.isBlank(visibilitySource)) {
            visibilityJson = new VisibilityJson(visibilitySource);
            visibilityJson.addWorkspace(workspaceId);
            visibility = visibilityTranslator.toVisibility(visibilityJson).getVisibility();
        }

        automap = vertexMapping.optBoolean(PROPERTY_MAPPING_AUTOMAP_KEY, false);
        JSONArray jsonPropertyMappings = vertexMapping.getJSONArray(PROPERTY_MAPPING_PROPERTIES_KEY);
        for (int i = 0; i < jsonPropertyMappings.length(); i++) {
            propertyMappings.add(PropertyMapping.fromJSON(schemaRepository, visibilityTranslator, workspaceId, jsonPropertyMappings.getJSONObject(i)));
        }
    }

    public static VertexMapping fromDataSourceImport(SchemaRepository schemaRepository, VisibilityTranslator visibilityTranslator, String workspaceId, String entityId, List<ClientApiDataSource.EntityMapping> mappings) {
        VertexMapping v = new VertexMapping();
        String visibilitySource = mappings.get(0).getColEntityVisibility();
        String conceptTypeValue = mappings.get(0).getColConcept();
        if(!StringUtils.isBlank(visibilitySource)) {
            v.visibilityJson = new VisibilityJson(visibilitySource);
            v.visibility = visibilityTranslator.toVisibility(v.visibilityJson).getVisibility();
        }

        v.entityId = entityId;

        // add concept type mapping
        PropertyMapping pmConceptyType = new PropertyMapping();
        pmConceptyType.name = CONCEPT_TYPE;
        pmConceptyType.value = conceptTypeValue;
        pmConceptyType.key = "";
        v.propertyMappings.add(pmConceptyType);

        for(ClientApiDataSource.EntityMapping em : mappings) {
            v.propertyMappings.add(PropertyMapping.fromDataSourceImport(schemaRepository, visibilityTranslator, workspaceId, em));
        }

        return v;
    }

    public ClientApiMappingErrors validate(Authorizations authorizations) {
        ClientApiMappingErrors errors = new ClientApiMappingErrors();

        if(visibility != null && !authorizations.canRead(visibility)) {
            ClientApiMappingErrors.MappingError mappingError = new ClientApiMappingErrors.MappingError();
            mappingError.vertexMapping = this;
            mappingError.attribute = PROPERTY_MAPPING_VISIBILITY_KEY;
            mappingError.message = "Invalid visibility specified.";
            errors.mappingErrors.add(mappingError);
        }

        for (PropertyMapping propertyMapping : propertyMappings) {
            ClientApiMappingErrors propertyMappingErrors = propertyMapping.validate(authorizations);
            errors.mappingErrors.addAll(propertyMappingErrors.mappingErrors);
        }

        return errors;
    }
}
