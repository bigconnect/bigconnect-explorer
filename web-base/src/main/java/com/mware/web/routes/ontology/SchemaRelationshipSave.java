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
import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.ClientApiSchema;
import com.mware.core.model.properties.SchemaProperties;
import com.mware.core.model.schema.Concept;
import com.mware.core.model.schema.Relationship;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.user.User;
import com.mware.ge.Authorizations;
import com.mware.ge.values.storable.Values;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.parameterProviders.ActiveWorkspaceId;

import java.util.List;
import java.util.stream.Collectors;

@Singleton
public class SchemaRelationshipSave extends SchemaBase {
    private final SchemaRepository schemaRepository;
    private final WebQueueRepository webQueueRepository;

    @Inject
    public SchemaRelationshipSave(
            final SchemaRepository schemaRepository,
            final WebQueueRepository webQueueRepository
    ) {
        super(schemaRepository);
        this.schemaRepository = schemaRepository;
        this.webQueueRepository = webQueueRepository;
    }

    @Handle
    public ClientApiSchema.Relationship handle(
            @Required(name = "displayName", allowEmpty = false) String displayName,
            @Required(name = "sourceIris[]", allowEmpty = false) String[] sourceNames,
            @Required(name = "targetIris[]", allowEmpty = false) String[] targetNames,
            @Optional(name = "parentIri", allowEmpty = false) String parentName,
            @Optional(name = "iri", allowEmpty = false) String relationshipName,
            @ActiveWorkspaceId String workspaceId,
            Authorizations authorizations,
            User user) {


        List<Concept> domainConcepts = ontologyNamesToConcepts(sourceNames, workspaceId);
        List<Concept> rangeConcepts = ontologyNamesToConcepts(targetNames, workspaceId);

        if (relationshipName == null) {
            if (parentName != null) {
                relationshipName = schemaRepository.generateDynamicName(Relationship.class, displayName, workspaceId, parentName);
            } else {
                relationshipName = schemaRepository.generateDynamicName(Relationship.class, displayName, workspaceId);
            }
        }

        Relationship parent = null;
        if (parentName != null) {
            parent = schemaRepository.getRelationshipByName(parentName, workspaceId);
            if (parent == null) {
                throw new BcException("Unable to load parent relationship with IRI: " + parentName);
            }
        }

        Relationship relationship = schemaRepository.getRelationshipByName(relationshipName, workspaceId);
        if (relationship == null) {
            relationship = schemaRepository.getOrCreateRelationshipType(parent, domainConcepts, rangeConcepts, relationshipName, displayName, false, false, user, workspaceId);
        } else {
            List<String> foundDomainIris = domainConcepts.stream().map(Concept::getName).collect(Collectors.toList());
            List<String> foundRangeIris = rangeConcepts.stream().map(Concept::getName).collect(Collectors.toList());
            schemaRepository.addDomainConceptsToRelationshipType(relationshipName, foundDomainIris, user, workspaceId);
            schemaRepository.addRangeConceptsToRelationshipType(relationshipName, foundRangeIris, user, workspaceId);
        }
        relationship.setProperty(SchemaProperties.DISPLAY_NAME.getPropertyName(), Values.stringValue(displayName), user, authorizations);

        schemaRepository.clearCache(workspaceId);
        webQueueRepository.pushOntologyRelationshipsChange(workspaceId, relationship.getId());

        return schemaRepository.getRelationshipByName(relationshipName, workspaceId).toClientApi();
    }
}
