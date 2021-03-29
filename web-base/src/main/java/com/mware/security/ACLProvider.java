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
import com.mware.core.exception.BcAccessDeniedException;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.*;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.schema.*;
import com.mware.core.model.user.PrivilegeRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.*;
import com.mware.web.model.ClientApiElementFindRelatedResponse;

import java.util.*;
import java.util.stream.Collectors;

import static com.google.common.base.Preconditions.checkNotNull;
import static com.mware.core.model.user.PrivilegeRepository.hasPrivilege;

public abstract class ACLProvider {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(ACLProvider.class);
    protected final Graph graph;
    protected final UserRepository userRepository;
    protected final SchemaRepository schemaRepository;
    private final PrivilegeRepository privilegeRepository;

    @Inject
    protected ACLProvider(
            Graph graph,
            UserRepository userRepository,
            SchemaRepository schemaRepository,
            PrivilegeRepository privilegeRepository
    ) {
        this.graph = graph;
        this.userRepository = userRepository;
        this.schemaRepository = schemaRepository;
        this.privilegeRepository = privilegeRepository;
    }

    public boolean canDeleteElement(Element element, User user, String workspaceId) {
        SchemaElement ontologyElement = getSchemaElement(element, workspaceId);
        return canDeleteElement(element, ontologyElement, user, workspaceId);
    }

    protected abstract boolean canDeleteElement(Element element, SchemaElement ontologyElement, User user, String workspaceId);

    public boolean canDeleteElement(ClientApiElement clientApiElement, User user, String workspaceId) {
        SchemaElement ontologyElement = getSchemaElement(clientApiElement, workspaceId);
        return canDeleteElement(clientApiElement, ontologyElement, user, workspaceId);
    }

    protected abstract boolean canDeleteElement(ClientApiElement clientApiElement, SchemaElement ontologyElement, User user, String workspaceId);

    public boolean canDeleteProperty(Element element, String propertyKey, String propertyName, User user, String workspaceId) {
        SchemaElement ontologyElement = getSchemaElement(element, workspaceId);
        return canDeleteProperty(element, ontologyElement, propertyKey, propertyName, user, workspaceId);
    }

    protected abstract boolean canDeleteProperty(Element element, SchemaElement ontologyElement, String propertyKey, String propertyName, User user, String workspaceId);

    public boolean canDeleteProperty(ClientApiElement clientApiElement, String propertyKey, String propertyName, User user, String workspaceId) {
        SchemaElement ontologyElement = getSchemaElement(clientApiElement, workspaceId);
        return canDeleteProperty(clientApiElement, ontologyElement, propertyKey, propertyName, user, workspaceId);
    }

    protected abstract boolean canDeleteProperty(ClientApiElement clientApiElement, SchemaElement ontologyElement, String propertyKey, String propertyName, User user, String workspaceId);

    public boolean canUpdateElement(Element element, User user, String workspaceId) {
        SchemaElement ontologyElement = getSchemaElement(element, workspaceId);
        return canUpdateElement(element, ontologyElement, user, workspaceId);
    }

    protected abstract boolean canUpdateElement(Element element, SchemaElement ontologyElement, User user, String workspaceId);

    public boolean canUpdateElement(ClientApiElement clientApiElement, User user, String workspaceId) {
        SchemaElement ontologyElement = getSchemaElement(clientApiElement, workspaceId);
        return canUpdateElement(clientApiElement, ontologyElement, user, workspaceId);
    }

    protected abstract boolean canUpdateElement(ClientApiElement clientApiElement, SchemaElement ontologyElement, User user, String workspaceId);

    public boolean canUpdateProperty(Element element, String propertyKey, String propertyName, User user, String workspaceId) {
        SchemaElement ontologyElement = getSchemaElement(element, workspaceId);
        return canUpdateProperty(element, ontologyElement, propertyKey, propertyName, user, workspaceId);
    }

    protected abstract boolean canUpdateProperty(Element element, SchemaElement ontologyElement, String propertyKey, String propertyName, User user, String workspaceId);

    public boolean canUpdateProperty(ClientApiElement clientApiElement, String propertyKey, String propertyName, User user, String workspaceId) {
        SchemaElement ontologyElement = getSchemaElement(clientApiElement, workspaceId);
        return canUpdateProperty(clientApiElement, ontologyElement, propertyKey, propertyName, user, workspaceId);
    }

    protected abstract boolean canUpdateProperty(ClientApiElement clientApiElement, SchemaElement ontologyElement, String propertyKey, String propertyName, User user, String workspaceId);

    public boolean canAddProperty(Element element, String propertyKey, String propertyName, User user, String workspaceId) {
        SchemaElement ontologyElement = getSchemaElement(element, workspaceId);
        return canAddProperty(element, ontologyElement, propertyKey, propertyName, user, workspaceId);
    }

    protected abstract boolean canAddProperty(Element element, SchemaElement ontologyElement, String propertyKey, String propertyName, User user, String workspaceId);

    public boolean canAddProperty(ClientApiElement clientApiElement, String propertyKey, String propertyName, User user, String workspaceId) {
        SchemaElement ontologyElement = getSchemaElement(clientApiElement, workspaceId);
        return canAddProperty(clientApiElement, ontologyElement, propertyKey, propertyName, user, workspaceId);
    }

    protected abstract boolean canAddProperty(ClientApiElement clientApiElement, SchemaElement ontologyElement, String propertyKey, String propertyName, User user, String workspaceId);

    public final void checkCanAddOrUpdateProperty(Element element, String propertyKey, String propertyName, User user, String workspaceId) {
        Set<String> privileges = privilegeRepository.getPrivileges(user);
        SchemaElement ontologyElement = getSchemaElement(element, workspaceId);
        checkCanAddOrUpdateProperty(element, ontologyElement, propertyKey, propertyName, privileges, user, workspaceId);
    }

    private void checkCanAddOrUpdateProperty(
            Element element,
            SchemaElement ontologyElement,
            String propertyKey,
            String propertyName,
            Set<String> privileges,
            User user,
            String workspaceId
    ) throws BcAccessDeniedException {
        boolean isUpdate = element.getProperty(propertyKey, propertyName) != null;
        boolean canAddOrUpdate = isUpdate
                ? internalCanUpdateProperty(element, ontologyElement, propertyKey, propertyName, privileges, user, workspaceId)
                : internalCanAddProperty(element, ontologyElement, propertyKey, propertyName, privileges, user, workspaceId);

        if (!canAddOrUpdate) {
            throw new BcAccessDeniedException(
                    propertyName + " cannot be added or updated due to ACL restriction", user, element.getId());
        }
    }

    public final void checkCanAddOrUpdateProperty(
            ClientApiElement clientApiElement,
            String propertyKey,
            String propertyName,
            User user,
            String workspaceId
    ) {
        SchemaElement ontologyElement = getSchemaElement(clientApiElement, workspaceId);
        checkCanAddOrUpdateProperty(clientApiElement, ontologyElement, propertyKey, propertyName, user, workspaceId);
    }

    public final void checkCanAddOrUpdateProperty(
            ClientApiElement clientApiElement,
            SchemaElement ontologyElement,
            String propertyKey,
            String propertyName,
            User user,
            String workspaceId
    ) throws BcAccessDeniedException {
        Set<String> privileges = privilegeRepository.getPrivileges(user);
        boolean isUpdate = clientApiElement.getProperty(propertyKey, propertyName) != null;
        boolean canAddOrUpdate = isUpdate
                ? internalCanUpdateProperty(clientApiElement, ontologyElement, propertyKey, propertyName, privileges, user, workspaceId)
                : internalCanAddProperty(clientApiElement, ontologyElement, propertyKey, propertyName, privileges, user, workspaceId);

        if (!canAddOrUpdate) {
            throw new BcAccessDeniedException(
                    propertyName + " cannot be added or updated due to ACL restriction", user, clientApiElement.getId());
        }
    }

    public final void checkCanDeleteProperty(Element element, String propertyKey, String propertyName, User user, String workspaceId) {
        Set<String> privileges = privilegeRepository.getPrivileges(user);
        SchemaElement ontologyElement = getSchemaElement(element, workspaceId);
        checkCanDeleteProperty(element, ontologyElement, propertyKey, propertyName, privileges, user, workspaceId);
    }

    private void checkCanDeleteProperty(
            Element element,
            SchemaElement ontologyElement,
            String propertyKey,
            String propertyName,
            Set<String> privileges,
            User user,
            String workspaceId
    ) throws BcAccessDeniedException {
        boolean canDelete = internalCanDeleteProperty(element, ontologyElement, propertyKey, propertyName, privileges, user, workspaceId);
        if (!canDelete) {
            throw new BcAccessDeniedException(propertyName + " cannot be deleted due to ACL restriction", user, element.getId());
        }
    }

    public final void checkCanDeleteProperty(ClientApiElement clientApiElement, String propertyKey, String propertyName, User user, String workspaceId) {
        Set<String> privileges = privilegeRepository.getPrivileges(user);
        SchemaElement ontologyElement = getSchemaElement(clientApiElement, workspaceId);
        checkCanDeleteProperty(clientApiElement, ontologyElement, propertyKey, propertyName, privileges, user, workspaceId);
    }

    private void checkCanDeleteProperty(
            ClientApiElement clientApiElement,
            SchemaElement ontologyElement,
            String propertyKey,
            String propertyName,
            Set<String> privileges,
            User user,
            String workspaceId
    ) throws BcAccessDeniedException {
        boolean canDelete = internalCanDeleteProperty(clientApiElement, ontologyElement, propertyKey, propertyName, privileges, user, workspaceId);

        if (!canDelete) {
            throw new BcAccessDeniedException(
                    propertyName + " cannot be deleted due to ACL restriction", user, clientApiElement.getId());
        }
    }

    public final ClientApiElementAcl elementACL(ClientApiElement clientApiElement, User user, String workspaceId) {
        Set<String> privileges = privilegeRepository.getPrivileges(user);
        SchemaElement ontologyElement = getSchemaElement(clientApiElement, workspaceId);
        return elementACL(clientApiElement, ontologyElement, privileges, user, workspaceId);
    }

    private ClientApiElementAcl elementACL(
            ClientApiElement clientApiElement,
            SchemaElement ontologyElement,
            Set<String> privileges,
            User user,
            String workspaceId
    ) {
        checkNotNull(clientApiElement, "clientApiElement is required");
        ClientApiElementAcl elementAcl = new ClientApiElementAcl();
        elementAcl.setAddable(true);
        elementAcl.setUpdateable(internalCanUpdateElement(clientApiElement, ontologyElement, privileges, user, workspaceId));
        elementAcl.setDeleteable(internalCanDeleteElement(clientApiElement, ontologyElement, privileges, user, workspaceId));

        List<ClientApiPropertyAcl> propertyAcls = elementAcl.getPropertyAcls();
        if (clientApiElement instanceof ClientApiVertex) {
            String iri = ((ClientApiVertex) clientApiElement).getConceptType();
            while (iri != null) {
                Concept concept = schemaRepository.getConceptByName(iri, workspaceId);
                if (concept == null) {
                    LOGGER.warn("Could not find concept: %s", iri);
                    break;
                }
                populatePropertyAcls(concept, clientApiElement, ontologyElement, privileges, user, workspaceId, propertyAcls);
                iri = concept.getParentConceptName();
            }
        } else if (clientApiElement instanceof ClientApiEdge) {
            String iri = ((ClientApiEdge) clientApiElement).getLabel();
            while (iri != null) {
                Relationship relationship = schemaRepository.getRelationshipByName(iri, workspaceId);
                if (relationship == null) {
                    LOGGER.warn("Could not find relationship: %s", iri);
                    break;
                }
                populatePropertyAcls(relationship, clientApiElement, ontologyElement, privileges, user, workspaceId, propertyAcls);
                iri = relationship.getParentName();
            }
        } else {
            throw new BcException("unsupported ClientApiElement class " + clientApiElement.getClass().getName());
        }
        return elementAcl;
    }

    public final ClientApiObject appendACL(ClientApiObject clientApiObject, User user, String workspaceId) {
        if (user == null) {
            return clientApiObject;
        }
        Set<String> privileges = privilegeRepository.getPrivileges(user);
        return appendACL(clientApiObject, privileges, user, workspaceId);
    }

    private ClientApiObject appendACL(ClientApiObject clientApiObject, Set<String> privileges, User user, String workspaceId) {
        if (clientApiObject instanceof ClientApiElement) {
            appendACL((ClientApiElement) clientApiObject, privileges, user, workspaceId);
        } else if (clientApiObject instanceof ClientApiWorkspaceVertices) {
            appendACL(((ClientApiWorkspaceVertices) clientApiObject).getVertices(), user, workspaceId);
        } else if (clientApiObject instanceof ClientApiVertexMultipleResponse) {
            appendACL(((ClientApiVertexMultipleResponse) clientApiObject).getVertices(), user, workspaceId);
        } else if (clientApiObject instanceof ClientApiEdgeMultipleResponse) {
            appendACL(((ClientApiEdgeMultipleResponse) clientApiObject).getEdges(), user, workspaceId);
        } else if (clientApiObject instanceof ClientApiElementSearchResponse) {
            appendACL(((ClientApiElementSearchResponse) clientApiObject).getElements(), user, workspaceId);
        } else if (clientApiObject instanceof ClientApiEdgeSearchResponse) {
            appendACL(((ClientApiEdgeSearchResponse) clientApiObject).getResults(), user, workspaceId);
        } else if (clientApiObject instanceof ClientApiVertexEdges) {
            ClientApiVertexEdges vertexEdges = (ClientApiVertexEdges) clientApiObject;
            appendACL(vertexEdges, privileges, user, workspaceId);
        } else if (clientApiObject instanceof ClientApiElementFindRelatedResponse) {
            appendACL(((ClientApiElementFindRelatedResponse) clientApiObject).getElements(), user, workspaceId);
        }

        return clientApiObject;
    }

    protected final boolean isComment(String propertyName) {
        return BcSchema.COMMENT.isSameName(propertyName);
    }

    protected final boolean isAuthor(Element element, String propertyKey, String propertyName, User user, String workspaceId) {
        if (element == null) {
            return false;
        }
        Property property = element.getProperty(propertyKey, propertyName);
        if (property != null) {
            String authorUserId = BcSchema.MODIFIED_BY_METADATA.getMetadataValue(property.getMetadata());
            return user.getUserId().equals(authorUserId);
        } else {
            return false;
        }
    }

    protected final boolean isAuthor(ClientApiElement clientApiElement, String propertyKey, String propertyName, User user, String workspaceId) {
        if (clientApiElement == null) {
            return false;
        }
        ClientApiProperty property = clientApiElement.getProperty(propertyKey, propertyName);
        if (property != null) {
            String authorUserId = BcSchema.MODIFIED_BY_METADATA.getMetadataValue(property.getMetadata());
            return user.getUserId().equals(authorUserId);
        } else {
            return false;
        }
    }

    private void appendACL(Collection<? extends ClientApiObject> clientApiObject, User user, String workspaceId) {
        Set<String> privileges = privilegeRepository.getPrivileges(user);
        for (ClientApiObject apiObject : clientApiObject) {
            appendACL(apiObject, privileges, user, workspaceId);
        }
    }

    protected void appendACL(ClientApiElement clientApiElement, Set<String> privileges, User user, String workspaceId) {
        SchemaElement ontologyElement = getSchemaElement(clientApiElement, workspaceId);
        appendACL(clientApiElement, ontologyElement, privileges, user, workspaceId);
    }

    private void appendACL(
            ClientApiElement clientApiElement,
            SchemaElement ontologyElement,
            Set<String> privileges,
            User user,
            String workspaceId
    ) {
        for (ClientApiProperty apiProperty : clientApiElement.getProperties()) {
            String key = apiProperty.getKey();
            String name = apiProperty.getName();
            apiProperty.setUpdateable(internalCanUpdateProperty(clientApiElement, ontologyElement, key, name, privileges, user, workspaceId));
            apiProperty.setDeleteable(internalCanDeleteProperty(clientApiElement, ontologyElement, key, name, privileges, user, workspaceId));
            apiProperty.setAddable(internalCanAddProperty(clientApiElement, ontologyElement, key, name, privileges, user, workspaceId));
        }
        clientApiElement.setUpdateable(internalCanUpdateElement(clientApiElement, ontologyElement, privileges, user, workspaceId));
        clientApiElement.setDeleteable(internalCanDeleteElement(clientApiElement, ontologyElement, privileges, user, workspaceId));

        clientApiElement.setAcl(elementACL(clientApiElement, ontologyElement, privileges, user, workspaceId));

        if (clientApiElement instanceof ClientApiEdgeWithVertexData) {
            appendACL(((ClientApiEdgeWithVertexData) clientApiElement).getSource(), privileges, user, workspaceId);
            appendACL(((ClientApiEdgeWithVertexData) clientApiElement).getTarget(), privileges, user, workspaceId);
        }
    }

    private void appendACL(ClientApiVertexEdges edges, Set<String> privileges, User user, String workspaceId) {
        for (ClientApiVertexEdges.Edge vertexEdge : edges.getRelationships()) {
            appendACL(vertexEdge.getRelationship(), privileges, user, workspaceId);
            appendACL(vertexEdge.getVertex(), privileges, user, workspaceId);
        }
    }

    private void populatePropertyAcls(
            HasSchemaProperties hasSchemaProperties,
            ClientApiElement clientApiElement,
            SchemaElement ontologyElement,
            Set<String> privileges,
            User user,
            String workspaceId,
            List<ClientApiPropertyAcl> propertyAcls
    ) {
        Collection<SchemaProperty> schemaProperties = hasSchemaProperties.getProperties();
        Set<String> addedPropertyNames = new HashSet<>();
        for (SchemaProperty ontologyProperty : schemaProperties) {
            String propertyName = ontologyProperty.getName();
            for (ClientApiProperty property : clientApiElement.getProperties(propertyName)) {
                ClientApiPropertyAcl acl = newClientApiPropertyAcl(
                        clientApiElement,
                        ontologyElement,
                        property.getKey(),
                        propertyName,
                        privileges,
                        user,
                        workspaceId
                );
                ClientApiPropertyAcl defaultAcl = newClientApiPropertyAcl(
                        null,
                        ontologyElement,
                        property.getKey(),
                        propertyName,
                        privileges,
                        user,
                        workspaceId
                );
                if (!acl.equals(defaultAcl)) {
                    propertyAcls.add(acl);
                }
                addedPropertyNames.add(propertyName);
            }
        }

        // for properties that don't exist on the clientApiElement, use the ontology property definition and omit the key.
        propertyAcls.addAll(
                schemaProperties.stream()
                        .filter(ontologyProperty -> !addedPropertyNames.contains(ontologyProperty.getName()))
                        .map(ontologyProperty -> {
                            String propertyName = ontologyProperty.getName();
                            ClientApiPropertyAcl acl = newClientApiPropertyAcl(
                                    clientApiElement,
                                    ontologyElement,
                                    null,
                                    propertyName,
                                    privileges,
                                    user,
                                    workspaceId
                            );
                            ClientApiPropertyAcl defaultAcl = newClientApiPropertyAcl(
                                    null,
                                    ontologyElement,
                                    null,
                                    propertyName,
                                    privileges,
                                    user,
                                    workspaceId
                            );
                            return acl.equals(defaultAcl) ? null : acl;
                        })
                        .filter(acl -> acl != null)
                        .collect(Collectors.toList())
        );
    }

    private ClientApiPropertyAcl newClientApiPropertyAcl(
            ClientApiElement clientApiElement,
            SchemaElement ontologyElement,
            String key,
            String name,
            Set<String> privileges,
            User user,
            String workspaceId
    ) {
        ClientApiPropertyAcl propertyAcl = new ClientApiPropertyAcl();
        propertyAcl.setKey(key);
        propertyAcl.setName(name);
        propertyAcl.setAddable(internalCanAddProperty(clientApiElement, ontologyElement, key, name, privileges, user, workspaceId));
        propertyAcl.setUpdateable(internalCanUpdateProperty(clientApiElement, ontologyElement, key, name, privileges, user, workspaceId));
        propertyAcl.setDeleteable(internalCanDeleteProperty(clientApiElement, ontologyElement, key, name, privileges, user, workspaceId));
        return propertyAcl;
    }

    private boolean internalCanDeleteElement(ClientApiElement clientApiElement, SchemaElement ontologyElement, Set<String> privileges, User user, String workspaceId) {
        return hasPrivilege(privileges, Privilege.EDIT) && canDeleteElement(clientApiElement, ontologyElement, user, workspaceId);
    }

    private boolean internalCanUpdateElement(ClientApiElement clientApiElement, SchemaElement ontologyElement, Set<String> privileges, User user, String workspaceId) {
        return hasPrivilege(privileges, Privilege.EDIT) && canUpdateElement(clientApiElement, ontologyElement, user, workspaceId);
    }

    private boolean internalCanDeleteProperty(
            Element element,
            SchemaElement ontologyElement,
            String propertyKey,
            String propertyName,
            Set<String> privileges,
            User user,
            String workspaceId
    ) {
        boolean canDelete = hasEditOrCommentPrivilege(privileges, propertyName)
                && canDeleteProperty(element, ontologyElement, propertyKey, propertyName, user, workspaceId);
        if (canDelete && isComment(propertyName)) {
            canDelete = hasPrivilege(privileges, Privilege.COMMENT_DELETE_ANY) ||
                    (hasPrivilege(privileges, Privilege.COMMENT) && isAuthor(element, propertyKey, propertyName, user, workspaceId));
        }
        return canDelete;
    }

    private boolean internalCanDeleteProperty(
            ClientApiElement clientApiElement,
            SchemaElement ontologyElement,
            String propertyKey,
            String propertyName,
            Set<String> privileges,
            User user,
            String workspaceId
    ) {
        boolean canDelete = hasEditOrCommentPrivilege(privileges, propertyName)
                && canDeleteProperty(clientApiElement, ontologyElement, propertyKey, propertyName, user, workspaceId);
        if (canDelete && isComment(propertyName)) {
            canDelete = hasPrivilege(privileges, Privilege.COMMENT_DELETE_ANY) ||
                    (hasPrivilege(privileges, Privilege.COMMENT) && isAuthor(clientApiElement, propertyKey, propertyName, user, workspaceId));
        }
        return canDelete;
    }

    private boolean internalCanUpdateProperty(
            Element element,
            SchemaElement ontologyElement,
            String propertyKey,
            String propertyName,
            Set<String> privileges,
            User user,
            String workspaceId
    ) {
        boolean canUpdate = hasEditOrCommentPrivilege(privileges, propertyName)
                && canUpdateProperty(element, ontologyElement, propertyKey, propertyName, user, workspaceId);
        if (canUpdate && isComment(propertyName)) {
            canUpdate = hasPrivilege(privileges, Privilege.COMMENT_EDIT_ANY) ||
                    (hasPrivilege(privileges, Privilege.COMMENT) && isAuthor(element, propertyKey, propertyName, user, workspaceId));
        }
        return canUpdate;
    }

    private boolean internalCanUpdateProperty(
            ClientApiElement clientApiElement,
            SchemaElement ontologyElement,
            String propertyKey,
            String propertyName,
            Set<String> privileges,
            User user,
            String workspaceId
    ) {
        boolean canUpdate = hasEditOrCommentPrivilege(privileges, propertyName)
                && canUpdateProperty(clientApiElement, ontologyElement, propertyKey, propertyName, user, workspaceId);
        if (canUpdate && isComment(propertyName)) {
            canUpdate = hasPrivilege(privileges, Privilege.COMMENT_EDIT_ANY) ||
                    (hasPrivilege(privileges, Privilege.COMMENT) && isAuthor(clientApiElement, propertyKey, propertyName, user, workspaceId));
        }
        return canUpdate;
    }

    private boolean internalCanAddProperty(
            Element element,
            SchemaElement ontologyElement,
            String propertyKey,
            String propertyName,
            Set<String> privileges,
            User user,
            String workspaceId
    ) {
        boolean canAdd = hasEditOrCommentPrivilege(privileges, propertyName)
                && canAddProperty(element, ontologyElement, propertyKey, propertyName, user, workspaceId);
        if (canAdd && isComment(propertyName)) {
            canAdd = hasPrivilege(privileges, Privilege.COMMENT);
        }
        return canAdd;
    }

    private boolean internalCanAddProperty(
            ClientApiElement clientApiElement,
            SchemaElement ontologyElement,
            String propertyKey,
            String propertyName,
            Set<String> privileges,
            User user,
            String workspaceId
    ) {
        boolean canAdd = hasEditOrCommentPrivilege(privileges, propertyName)
                && canAddProperty(clientApiElement, ontologyElement, propertyKey, propertyName, user, workspaceId);
        if (canAdd && isComment(propertyName)) {
            canAdd = hasPrivilege(privileges, Privilege.COMMENT);
        }
        return canAdd;
    }

    private boolean hasEditOrCommentPrivilege(Set<String> privileges, String propertyName) {
        return hasPrivilege(privileges, Privilege.EDIT) || (isComment(propertyName) && hasPrivilege(privileges, Privilege.COMMENT));
    }

    protected SchemaElement getSchemaElement(Element element, String namespace) {
        if (element == null) {
            return null;
        }
        if (element instanceof Edge) {
            return getOntologyRelationshipFromElement((Edge) element, namespace);
        }
        if (element instanceof Vertex) {
            return getOntologyConceptFromElement((Vertex) element, namespace);
        }
        throw new BcException("Unexpected " + Element.class.getName() + " found " + element.getClass().getName());
    }

    protected SchemaElement getSchemaElement(ClientApiElement clientApiElement, String workspaceId) {
        if (clientApiElement == null) {
            return null;
        }
        if (clientApiElement instanceof ClientApiEdge) {
            return getOntologyRelationshipFromElement((ClientApiEdge) clientApiElement, workspaceId);
        }
        if (clientApiElement instanceof ClientApiVertex) {
            return getOntologyConceptFromElement((ClientApiVertex) clientApiElement, workspaceId);
        }
        throw new BcException("Unexpected " + ClientApiVertex.class.getName() + " found " + clientApiElement.getClass().getName());
    }

    private Relationship getOntologyRelationshipFromElement(Edge e, String workspaceId) {
        String label = e.getLabel();
        return getOntologyRelationshipFromElement(label, workspaceId);
    }

    private Relationship getOntologyRelationshipFromElement(ClientApiEdge e, String workspaceId) {
        String label = e.getLabel();
        return getOntologyRelationshipFromElement(label, workspaceId);
    }

    private Relationship getOntologyRelationshipFromElement(String edgeLabel, String workspaceId) {
        checkNotNull(edgeLabel, "Edge label cannot be null");
        Relationship relationship = schemaRepository.getRelationshipByName(edgeLabel, workspaceId);
        checkNotNull(relationship, edgeLabel + " does not exist in ontology");
        return relationship;
    }

    private Concept getOntologyConceptFromElement(Vertex vertex, String workspaceId) {
        String iri = Optional.of(vertex.getConceptType()).orElse(SchemaConstants.CONCEPT_TYPE_THING);
        return getOntologyConcept(iri, workspaceId);
    }

    private Concept getOntologyConceptFromElement(ClientApiVertex vertex, String workspaceId) {
        String iri = Optional.of(vertex.getConceptType()).orElse(SchemaConstants.CONCEPT_TYPE_THING);
        return getOntologyConcept(iri, workspaceId);
    }

    private Concept getOntologyConcept(String conceptType, String workspaceId) {
        if (conceptType == null) {
            return null;
        }
        return schemaRepository.getConceptByName(conceptType, workspaceId);
    }
}
