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
import com.mware.core.model.schema.SchemaProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.user.User;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.framework.utils.StringUtils;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;

import java.util.HashSet;
import java.util.Set;

public class OntologyManagerPropertyRemoveExisting implements ParameterizedHandler {
    private final SchemaRepository schemaRepository;
    private final WebQueueRepository webQueueRepository;

    @Inject
    public OntologyManagerPropertyRemoveExisting(SchemaRepository schemaRepository, WebQueueRepository webQueueRepository) {
        this.schemaRepository = schemaRepository;
        this.webQueueRepository = webQueueRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "property") String propertyName,
            @Optional(name = "conceptId") String conceptId,
            @Optional(name = "relId") String relId,
            @Required(name = "namespace") String namespace,
            @ActiveWorkspaceId String workspaceId,
            User user
    ) {
        SchemaProperty op = schemaRepository.getPropertyByName(propertyName, namespace);

        Set<String> domains = new HashSet();
        domains.addAll(op.getConceptNames());
        domains.addAll(op.getRelationshipNames());

        if(!StringUtils.isEmpty(conceptId)) {
            domains.remove(conceptId);
        } else if(!StringUtils.isEmpty(relId)) {
            domains.remove(relId);
        } else {
            throw new IllegalStateException("No conceptId or relId supplied");
        }

        schemaRepository.updatePropertyDomainNames(op, domains, user, namespace);
        schemaRepository.clearCache();

        if (!StringUtils.isEmpty(conceptId))
            webQueueRepository.pushOntologyConceptsChange(workspaceId, conceptId);
        if (!StringUtils.isEmpty(relId))
            webQueueRepository.pushOntologyRelationshipsChange(workspaceId, relId);

        return BcResponse.SUCCESS;
    }
}

