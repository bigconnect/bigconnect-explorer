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
package com.mware.web.routes.ontology;

import com.google.inject.Inject;
import com.mware.core.model.clientapi.dto.ClientApiSchema;
import com.mware.core.model.properties.SchemaProperties;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.schema.*;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.user.User;
import com.mware.core.util.JSONUtil;
import com.mware.ge.Authorizations;
import com.mware.ge.TextIndexHint;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import org.apache.commons.lang.StringUtils;

import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;

import static com.mware.ge.values.storable.Values.*;

public class OntologyManagerPropertySave implements ParameterizedHandler {
    private final SchemaRepository schemaRepository;
    private final AuthorizationRepository authorizationRepository;
    private final WebQueueRepository webQueueRepository;

    @Inject
    public OntologyManagerPropertySave(
            SchemaRepository schemaRepository,
            AuthorizationRepository authorizationRepository,
            WebQueueRepository webQueueRepository
    ) {
        this.schemaRepository = schemaRepository;
        this.authorizationRepository = authorizationRepository;
        this.webQueueRepository = webQueueRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "property") ClientApiSchema.Property property,
            @Optional(name = "conceptId") String conceptId,
            @Optional(name = "relId") String relId,
            @Required(name = "namespace") String namespace,
            @ActiveWorkspaceId String workspaceId,
            User user
    ) {
        SchemaProperty prop = schemaRepository.getPropertyByName(property.getTitle(), namespace);
        if(prop == null) {
            Concept concept = null;
            Relationship relationship = null;

            if(!StringUtils.isEmpty(conceptId)) {
                concept = schemaRepository.getConceptByName(conceptId, namespace);
            } else if(!StringUtils.isEmpty(relId)) {
                concept = schemaRepository.getConceptByName(SchemaConstants.CONCEPT_TYPE_THING, namespace);
                relationship = schemaRepository.getRelationshipByName(relId, namespace);
            } else {
                throw new IllegalStateException("No conceptId or relId supplied");
            }
            SchemaPropertyDefinition def = new SchemaPropertyDefinition(Collections.singletonList(concept), property.getTitle(), property.getDisplayName(), property.getDataType());
            def.setUserVisible(property.getUserVisible());
            def.setSearchable(property.getSearchable());
            def.setSearchFacet(property.getSearchFacet());
            Collection<TextIndexHint> textIndexHints = new HashSet<>();
            property.getTextIndexHints().forEach(st -> textIndexHints.addAll(TextIndexHint.parse(st)));
            def.setTextIndexHints(textIndexHints);
            def.setDeleteable(property.getDeleteable());
            def.setAddable(property.getAddable());
            def.setUpdateable(property.getUpdateable());
            def.setIntents(property.getIntents().toArray(new String[]{}));
            def.setAggType(property.getAggType());
            def.setAggInterval(property.getAggInterval());
            def.setAggMinDocumentCount(property.getAggMinDocumentCount());
            def.setAggCalendarField(property.getAggCalendarField());
            def.setAggTimeZone(property.getAggTimeZone());
            def.setAggPrecision(property.getAggPrecision());
            def.setDisplayType(property.getDisplayType());
            def.setPropertyGroup(property.getPropertyGroup());
            def.setPossibleValues(property.getPossibleValues());
            def.setDisplayFormula(property.getDisplayFormula());
            def.setValidationFormula(property.getValidationFormula());

            if(relationship != null) {
                def.getRelationships().add(relationship);
            }

            SchemaProperty savedProp = schemaRepository.getOrCreateProperty(def, user, namespace);
            schemaRepository.clearCache();

            webQueueRepository.pushOntologyPropertiesChange(workspaceId, savedProp.getId());
            if (concept != null)
                webQueueRepository.pushOntologyConceptsChange(workspaceId, concept.getId());
            if (relationship != null)
                webQueueRepository.pushOntologyConceptsChange(workspaceId, relationship.getId());
        } else {
            Authorizations authorizations = authorizationRepository.getGraphAuthorizations(user);
            prop.setProperty(SchemaProperties.TITLE.getPropertyName(), stringValue(property.getTitle()), user, authorizations);
            prop.setProperty(SchemaProperties.DISPLAY_NAME.getPropertyName(), stringValue(property.getDisplayName()), user, authorizations);
            prop.setProperty(SchemaProperties.DATA_TYPE.getPropertyName(), stringValue(property.getDataType().toString()), user, authorizations);
            prop.setProperty(SchemaProperties.USER_VISIBLE.getPropertyName(), booleanValue(property.getUserVisible()), user, authorizations);
            prop.setProperty(SchemaProperties.SEARCHABLE.getPropertyName(), booleanValue(property.getSearchable()), user, authorizations);
            prop.setProperty(SchemaProperties.SEARCH_FACET.getPropertyName(), booleanValue(property.getSearchFacet()), user, authorizations);
            prop.setProperty(SchemaProperties.TEXT_INDEX_HINTS.getPropertyName(), stringValue(property.getTextIndexHints().toString()), user, authorizations);
            prop.setProperty(SchemaProperties.DELETEABLE.getPropertyName(), booleanValue(property.getDeleteable()), user, authorizations);
            prop.setProperty(SchemaProperties.ADDABLE.getPropertyName(), booleanValue(property.getAddable()), user, authorizations);
            prop.setProperty(SchemaProperties.UPDATEABLE.getPropertyName(), booleanValue(property.getUpdateable()), user, authorizations);
            prop.updateIntents(property.getIntents().toArray(new String[]{}), authorizations);
            prop.setProperty(SchemaProperties.AGG_TYPE.getPropertyName(), stringValue(property.getAggType()), user, authorizations);
            prop.setProperty(SchemaProperties.AGG_INTERVAL.getPropertyName(), stringValue(property.getAggInterval()), user, authorizations);
            prop.setProperty(SchemaProperties.AGG_MIN_DOCUMENT_COUNT.getPropertyName(), longValue(property.getAggMinDocumentCount()), user, authorizations);
            prop.setProperty(SchemaProperties.AGG_CALENDAR_FIELD.getPropertyName(), stringValue(property.getAggCalendarField()), user, authorizations);
            prop.setProperty(SchemaProperties.AGG_TIMEZONE.getPropertyName(), stringValue(property.getAggTimeZone()), user, authorizations);
            prop.setProperty(SchemaProperties.AGG_PRECISION.getPropertyName(), intValue(property.getAggPrecision()), user, authorizations);
            prop.setProperty(SchemaProperties.DISPLAY_TYPE.getPropertyName(), stringValue(property.getDisplayType()), user, authorizations);
            prop.setProperty(SchemaProperties.PROPERTY_GROUP.getPropertyName(), stringValue(property.getPropertyGroup()), user, authorizations);
            prop.setProperty(SchemaProperties.POSSIBLE_VALUES.getPropertyName(), stringValue(JSONUtil.toJson(property.getPossibleValues()).toString()), user, authorizations);
            prop.setProperty(SchemaProperties.DISPLAY_FORMULA.getPropertyName(), stringValue(property.getDisplayFormula()), user, authorizations);
            prop.setProperty(SchemaProperties.VALIDATION_FORMULA.getPropertyName(), stringValue(property.getValidationFormula()), user, authorizations);
            schemaRepository.clearCache();
            webQueueRepository.pushOntologyPropertiesChange(workspaceId, prop.getId());
        }

        return BcResponse.SUCCESS;
    }
}
