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
package com.mware.security;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.clientapi.dto.ClientApiEdgeWithVertexData;
import com.mware.core.model.clientapi.dto.ClientApiElement;
import com.mware.core.model.clientapi.dto.ClientApiElementAcl;
import com.mware.core.model.clientapi.dto.ClientApiProperty;
import com.mware.core.model.schema.SchemaElement;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.user.PrivilegeRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.ge.Element;
import com.mware.ge.Graph;

import java.util.Set;

@Singleton
public class AllowAllAclProvider extends ACLProvider {
    @Inject
    public AllowAllAclProvider(
            Graph graph,
            UserRepository userRepository,
            SchemaRepository schemaRepository,
            PrivilegeRepository privilegeRepository
    ) {
        super(graph, userRepository, schemaRepository, privilegeRepository);
    }

    @Override
    public boolean canDeleteElement(Element element, SchemaElement schemaElement, User user, String workspaceId) {
        return true;
    }

    @Override
    public boolean canDeleteElement(ClientApiElement clientApiElement, SchemaElement schemaElement, User user, String workspaceId) {
        return true;
    }

    @Override
    public boolean canDeleteProperty(Element element, SchemaElement schemaElement, String propertyKey, String propertyName, User user, String workspaceId) {
        return true;
    }

    @Override
    public boolean canDeleteProperty(ClientApiElement clientApiElement, SchemaElement schemaElement, String propertyKey, String propertyName, User user, String workspaceId) {
        return true;
    }

    @Override
    public boolean canUpdateElement(Element element, SchemaElement schemaElement, User user, String workspaceId) {
        return true;
    }

    @Override
    public boolean canUpdateElement(ClientApiElement clientApiElement, SchemaElement schemaElement, User user, String workspaceId) {
        return true;
    }

    @Override
    public boolean canUpdateProperty(Element element, SchemaElement schemaElement, String propertyKey, String propertyName, User user, String workspaceId) {
        return true;
    }

    @Override
    public boolean canUpdateProperty(ClientApiElement clientApiElement, SchemaElement schemaElement, String propertyKey, String propertyName, User user, String workspaceId) {
        return true;
    }

    @Override
    public boolean canAddProperty(Element element, SchemaElement schemaElement, String propertyKey, String propertyName, User user, String workspaceId) {
        return true;
    }

    @Override
    public boolean canAddProperty(ClientApiElement clientApiElement, SchemaElement schemaElement, String propertyKey, String propertyName, User user, String workspaceId) {
        return true;
    }

    @Override
    protected void appendACL(ClientApiElement clientApiElement, Set<String> privileges, User user, String workspaceId) {
        for (ClientApiProperty apiProperty : clientApiElement.getProperties()) {
            apiProperty.setUpdateable(true);
            apiProperty.setDeleteable(true);
            apiProperty.setAddable(true);
        }
        clientApiElement.setUpdateable(true);
        clientApiElement.setDeleteable(true);

        ClientApiElementAcl elementAcl = new ClientApiElementAcl();
        elementAcl.setAddable(true);
        elementAcl.setUpdateable(true);
        elementAcl.setDeleteable(true);
        clientApiElement.setAcl(elementAcl);

        if (clientApiElement instanceof ClientApiEdgeWithVertexData) {
            appendACL(((ClientApiEdgeWithVertexData) clientApiElement).getSource(), privileges, user, workspaceId);
            appendACL(((ClientApiEdgeWithVertexData) clientApiElement).getTarget(), privileges, user, workspaceId);
        }
    }
}
