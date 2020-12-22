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
import com.mware.core.model.schema.Relationship;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.user.User;
import com.mware.ge.Authorizations;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;

import java.util.stream.Collectors;

import static com.mware.ge.values.storable.Values.booleanValue;
import static com.mware.ge.values.storable.Values.stringValue;

public class OntologyManagerRelSave implements ParameterizedHandler {
    private final SchemaRepository schemaRepository;
    private final AuthorizationRepository authorizationRepository;
    private final WebQueueRepository webQueueRepository;

    @Inject
    public OntologyManagerRelSave(
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
            @Required(name = "namespace") String namespace,
            @Required(name = "rel") ClientApiSchema.Relationship rel,
            @ActiveWorkspaceId String workspaceId,
            User user
    ) {
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(user);

        Relationship parent = schemaRepository.getOrCreateRootRelationship(authorizations);
        Relationship r = schemaRepository.getOrCreateRelationshipType(
                parent,
                rel.getDomainConceptIris().stream()
                        .map(c -> schemaRepository.getConceptByName(c, namespace))
                        .collect(Collectors.toList()),
                rel.getRangeConceptIris().stream()
                        .map(c -> schemaRepository.getConceptByName(c, namespace))
                        .collect(Collectors.toList()),
                rel.getTitle(),
                true, false,
                user, namespace
        );

        r.setProperty(SchemaProperties.DISPLAY_NAME.getPropertyName(), stringValue(rel.getDisplayName()), user, authorizations);
        r.setProperty(SchemaProperties.USER_VISIBLE.getPropertyName(), booleanValue(rel.getUserVisible()), user, authorizations);
        r.setProperty(SchemaProperties.DELETEABLE.getPropertyName(), booleanValue(rel.getDeleteable()), user, authorizations);
        r.setProperty(SchemaProperties.UPDATEABLE.getPropertyName(), booleanValue(rel.getUpdateable()), user, authorizations);
        r.updateIntents(rel.getIntents().toArray(new String[]{}), user, authorizations);
        r.setProperty(SchemaProperties.COLOR.getPropertyName(), stringValue(rel.getColor()), user, authorizations);
        r.setProperty(SchemaProperties.TITLE_FORMULA.getPropertyName(), stringValue(rel.getTitleFormula()), user, authorizations);
        r.setProperty(SchemaProperties.SUBTITLE_FORMULA.getPropertyName(), stringValue(rel.getSubtitleFormula()), user, authorizations);
        r.setProperty(SchemaProperties.TIME_FORMULA.getPropertyName(), stringValue(rel.getTimeFormula()), user, authorizations);

        if(rel.getInverseOfs() != null) {
            // remove existing inverse relationships
            for(String inverseId : r.getInverseOfNames()) {
                Relationship target = schemaRepository.getRelationshipByName(inverseId, namespace);
                schemaRepository.removeInverseOfRelationship(r, target);
            }

            // add new inverse relationships
            for(ClientApiSchema.Relationship.InverseOf inverse : rel.getInverseOfs()) {
                Relationship target = schemaRepository.getRelationshipByName(inverse.getIri(), namespace);
                schemaRepository.getOrCreateInverseOfRelationship(r, target);
                schemaRepository.clearCache();
                webQueueRepository.pushOntologyRelationshipsChange(workspaceId, target.getId());
            }
        }

        schemaRepository.clearCache();
        webQueueRepository.pushOntologyRelationshipsChange(workspaceId, parent.getId(), r.getId());
        return BcResponse.SUCCESS;
    }
}
