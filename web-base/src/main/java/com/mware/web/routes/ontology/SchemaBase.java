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

import com.mware.core.exception.BcException;
import com.mware.core.model.schema.Concept;
import com.mware.core.model.schema.Relationship;
import com.mware.core.model.schema.SchemaProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.ge.util.IterableUtils;
import com.mware.web.framework.ParameterizedHandler;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.stream.Collectors;

abstract class SchemaBase implements ParameterizedHandler {
    private final SchemaRepository schemaRepository;

    SchemaBase(SchemaRepository schemaRepository) {
        this.schemaRepository = schemaRepository;
    }

    List<Concept> ontologyNamesToConcepts(String[] names, String workspaceId) {
        return getOntologyObjects(names, schemaRepository::getConceptsByName, Concept::getName, "concept", workspaceId);
    }

    List<Relationship> ontologyNamesToRelationships(String[] names, String workspaceId) {
        return getOntologyObjects(names, schemaRepository::getRelationshipsByName, Relationship::getName, "relationship", workspaceId);
    }

    List<SchemaProperty> ontologyNamesToProperties(String[] names, String workspaceId) {
        return getOntologyObjects(names, schemaRepository::getPropertiesByName, SchemaProperty::getName, "property", workspaceId);
    }

    List<Concept> ontologyIdsToConcepts(String[] ids, String workspaceId) {
        return getOntologyObjects(ids, schemaRepository::getConcepts, Concept::getName, "concept", workspaceId);
    }

    List<Relationship> ontologyIdsToRelationships(String[] ids, String workspaceId) {
        return getOntologyObjects(ids, schemaRepository::getRelationships, Relationship::getName, "relationship", workspaceId);
    }

    List<SchemaProperty> ontologyIdsToProperties(String[] ids, String workspaceId) {
        return getOntologyObjects(ids, schemaRepository::getProperties, SchemaProperty::getId, "property", workspaceId);
    }

    private <T> List<T> getOntologyObjects(
            String[] iris,
            BiFunction<List<String>, String, Iterable<T>> getAllByIriFunction,
            Function<T, String> getIriFunction,
            String ontologyObjectType,
            String workspaceId
    ) {
        if (iris == null) {
            return new ArrayList<>();
        }

        List<T> ontologyObjects = IterableUtils.toList(getAllByIriFunction.apply(Arrays.asList(iris), workspaceId));
        if (ontologyObjects.size() != iris.length) {
            List<String> foundIris = ontologyObjects.stream().map(getIriFunction).collect(Collectors.toList());
            String missingIris = Arrays.stream(iris).filter(iri -> !foundIris.contains(iri)).collect(Collectors.joining(", "));
            throw new BcException("Unable to load " + ontologyObjectType + " with IRI: " + missingIris);
        }
        return ontologyObjects;
    }
}
