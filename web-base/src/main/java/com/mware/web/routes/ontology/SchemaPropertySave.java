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

import com.google.common.collect.Sets;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.ClientApiSchema;
import com.mware.core.model.clientapi.dto.PropertyType;
import com.mware.core.model.schema.*;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.user.User;
import com.mware.ge.TextIndexHint;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.ActiveWorkspaceId;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.stream.Collectors;

@Singleton
public class SchemaPropertySave extends SchemaBase {
    private final SchemaRepository schemaRepository;
    private final WebQueueRepository webQueueRepository;

    @Inject
    public SchemaPropertySave(
            final SchemaRepository schemaRepository,
            final WebQueueRepository webQueueRepository
    ) {
        super(schemaRepository);
        this.schemaRepository = schemaRepository;
        this.webQueueRepository = webQueueRepository;
    }

    @Handle
    public ClientApiSchema.Property handle(
            @Required(name = "displayName", allowEmpty = false) String displayName,
            @Required(name = "dataType", allowEmpty = false) String dataType,
            @Optional(name = "displayType", allowEmpty = false) String displayType,
            @Optional(name = "propertyIri", allowEmpty = false) String propertyIri,
            @Optional(name = "conceptIris[]") String[] conceptIris,
            @Optional(name = "relationshipIris[]") String[] relationshipIris,
            @ActiveWorkspaceId String workspaceId,
            User user) {

        List<Concept> concepts = ontologyNamesToConcepts(conceptIris, workspaceId);
        List<Relationship> relationships = ontologyNamesToRelationships(relationshipIris, workspaceId);

        PropertyType type = PropertyType.convert(dataType, null);
        if (type == null) {
            throw new BcException("Unknown property type: " + dataType);
        }

        if (propertyIri == null) {
            String prefix = conceptIris != null ? conceptIris[0] : relationshipIris[0];
            propertyIri = schemaRepository.generatePropertyDynamicName(SchemaProperty.class, displayName, workspaceId, prefix);
        }

        SchemaProperty property = schemaRepository.getPropertyByName(propertyIri, workspaceId);
        if (property == null) {
            SchemaPropertyDefinition def = new SchemaPropertyDefinition(concepts, relationships, propertyIri, displayName, type);
            def.setAddable(true);
            def.setDeleteable(true);
            def.setSearchable(true);
            def.setSortable(true);
            def.setUserVisible(true);
            def.setUpdateable(true);
            if (displayType != null) {
                def.setDisplayType(displayType);
            }
            if (type.equals(PropertyType.STRING)) {
                def.setTextIndexHints(TextIndexHint.ALL);
            }

            property = schemaRepository.getOrCreateProperty(def, user, workspaceId);
        } else {
            HashSet<String> domainNames = Sets.newHashSet(property.getConceptNames());
            domainNames.addAll(property.getRelationshipNames());
            if (conceptIris != null && conceptIris.length > 0) {
                Collections.addAll(domainNames, conceptIris);
            }
            if (relationshipIris != null && relationshipIris.length > 0) {
                Collections.addAll(domainNames, relationshipIris);
            }
            schemaRepository.updatePropertyDomainNames(property, domainNames, user, workspaceId);
        }

        schemaRepository.clearCache(workspaceId);

        Iterable<String> conceptIds = concepts.stream().map(Concept::getId).collect(Collectors.toList());
        Iterable<String> relationshipIds = relationships.stream().map(Relationship::getId).collect(Collectors.toList());
        webQueueRepository.pushOntologyChange(
                workspaceId,
                WebQueueRepository.SchemaAction.Update,
                conceptIds,
                relationshipIds,
                Collections.singletonList(property.getId())
        );
        return property.toClientApi();
    }
}
