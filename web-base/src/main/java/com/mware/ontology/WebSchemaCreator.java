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
package com.mware.ontology;

import com.google.common.collect.ImmutableList;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.ingest.database.DataConnectionSchema;
import com.mware.core.ingest.structured.StructuredIngestSchema;
import com.mware.core.model.clientapi.dto.PropertyType;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.SchemaProperties;
import com.mware.core.model.properties.WorkspaceSchema;
import com.mware.core.model.schema.*;
import com.mware.core.model.workspace.WebWorkspaceSchema;
import com.mware.ge.TextIndexHint;

import java.text.MessageFormat;
import java.util.EnumSet;

import static com.mware.ge.values.storable.BooleanValue.FALSE;
import static com.mware.ge.values.storable.Values.stringValue;

/**
 * Create required schema objects for the WebConsole
 */
@Singleton
public class WebSchemaCreator {
    private Concept thingConcept;
    private Relationship topObjectProperty;
    private SchemaFactory schemaFactory;
    private SchemaRepository schemaRepository;

    @Inject
    public WebSchemaCreator(SchemaRepository schemaRepository) {
        this.schemaFactory = new SchemaFactory(schemaRepository);
        this.schemaRepository = schemaRepository;
    }

    public boolean isCreated() {
        return schemaRepository.hasConceptByName(WebWorkspaceSchema.PRODUCT_CONCEPT_NAME, SchemaRepository.PUBLIC);
    }

    public void createOntology() {
        thingConcept = schemaFactory.getOrCreateThingConcept();
        topObjectProperty = schemaFactory.getOrCreateRootRelationship();

        createWorkspaceOntology();
        createCommentOntology();
        createStructuredIngestOntology();
        createDataConnectionOntology();
        createBehaviourOntology();
    }

    private void createWorkspaceOntology() {
        Concept workspace = schemaRepository.getConceptByName(WorkspaceSchema.WORKSPACE_CONCEPT_NAME);

        Concept product = schemaFactory.newConcept()
                .conceptType(WebWorkspaceSchema.PRODUCT_CONCEPT_NAME)
                .parent(thingConcept)
                .displayName("Product")
                .coreConcept(true)
                .property(SchemaProperties.UPDATEABLE.getPropertyName(), FALSE)
                .save();

        Concept compoundNode = schemaFactory.newConcept()
                .conceptType(GraphProductSchema.CONCEPT_TYPE_COMPOUND_NODE)
                .parent(thingConcept)
                .displayName("Graph Product Compound Node")
                .coreConcept(true)
                .property(SchemaProperties.UPDATEABLE.getPropertyName(),FALSE)
                .save();

        Concept dashboard = schemaFactory.newConcept()
                .conceptType(WebWorkspaceSchema.DASHBOARD_CONCEPT_NAME)
                .parent(thingConcept)
                .displayName("Dashboard")
                .coreConcept(true)
                .property(SchemaProperties.UPDATEABLE.getPropertyName(),FALSE)
                .save();

        Concept dashboardItem = schemaFactory.newConcept()
                .conceptType(WebWorkspaceSchema.DASHBOARD_ITEM_CONCEPT_NAME)
                .parent(thingConcept)
                .displayName("Dashboard Item")
                .coreConcept(true)
                .property(SchemaProperties.UPDATEABLE.getPropertyName(),FALSE)
                .save();

        schemaFactory.newRelationship()
                .label(WebWorkspaceSchema.WORKSPACE_TO_PRODUCT_RELATIONSHIP_NAME)
                .parent(topObjectProperty)
                .source(workspace)
                .target(product)
                .property(SchemaProperties.DISPLAY_NAME.getPropertyName(), stringValue("To Product"))
                .coreConcept(true)
                .save();

        Relationship prouctToEntity = schemaFactory.newRelationship()
                .label(WebWorkspaceSchema.PRODUCT_TO_ENTITY_RELATIONSHIP_NAME)
                .parent(topObjectProperty)
                .source(product)
                .target(thingConcept)
                .property(SchemaProperties.DISPLAY_NAME.getPropertyName(), stringValue("To Entity"))
                .coreConcept(true)
                .save();

        schemaFactory.newRelationship()
                .label(WebWorkspaceSchema.WORKSPACE_TO_DASHBOARD_RELATIONSHIP_NAME)
                .parent(topObjectProperty)
                .source(workspace)
                .target(dashboard)
                .property(SchemaProperties.DISPLAY_NAME.getPropertyName(), stringValue("To Dashboard"))
                .coreConcept(true)
                .save();

        schemaFactory.newRelationship()
                .label(WebWorkspaceSchema.DASHBOARD_TO_DASHBOARD_ITEM_RELATIONSHIP_NAME)
                .parent(topObjectProperty)
                .source(dashboard)
                .target(dashboardItem)
                .property(SchemaProperties.DISPLAY_NAME.getPropertyName(), stringValue("To Dashboard Item"))
                .coreConcept(true)
                .save();

        // properties
        schemaFactory.newConceptProperty()
                .concepts(dashboardItem)
                .name(WebWorkspaceSchema.DASHBOARD_ITEM_CONFIGURATION.getPropertyName())
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dashboardItem)
                .name(WebWorkspaceSchema.DASHBOARD_ITEM_EXTENSION_ID.getPropertyName())
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(product)
                .name(WebWorkspaceSchema.PRODUCT_DATA.getPropertyName())
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(product)
                .name(WebWorkspaceSchema.PRODUCT_EXTENDED_DATA.getPropertyName())
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(product)
                .name(WebWorkspaceSchema.PRODUCT_KIND.getPropertyName())
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(product)
                .name(WebWorkspaceSchema.PRODUCT_PREVIEW_DATA_URL.getPropertyName())
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(thingConcept)
                .name(GraphProductSchema.ENTITY_POSITION.getPropertyName())
                .type(PropertyType.STRING)
                .userVisible(false)
                .forRelationships(prouctToEntity)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(thingConcept)
                .name(GraphProductSchema.PARENT_NODE.getPropertyName())
                .type(PropertyType.STRING)
                .userVisible(false)
                .forRelationships(prouctToEntity)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(thingConcept)
                .name(GraphProductSchema.NODE_CHILDREN.getPropertyName())
                .type(PropertyType.STRING)
                .userVisible(false)
                .forRelationships(prouctToEntity)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(thingConcept)
                .name(GraphProductSchema.NODE_TITLE.getPropertyName())
                .type(PropertyType.STRING)
                .userVisible(false)
                .forRelationships(prouctToEntity)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(thingConcept)
                .name(WebWorkspaceSchema.PRODUCT_TO_ENTITY_IS_ANCILLARY.getPropertyName())
                .type(PropertyType.BOOLEAN)
                .forRelationships(prouctToEntity)
                .userVisible(false)
                .save();
    }

    private void createCommentOntology() {
        schemaFactory.newConceptProperty()
                .concepts(thingConcept)
                .name(BcSchema.COMMENT.getPropertyName())
                .displayName("Comment")
                .type(PropertyType.STRING)
                .textIndexHints(EnumSet.of(TextIndexHint.FULL_TEXT))
                .userVisible(false)
                .forRelationships(topObjectProperty)
                .save();
    }

    private void createStructuredIngestOntology() {
        // relations
        schemaFactory.newRelationship()
                .label(StructuredIngestSchema.ELEMENT_HAS_SOURCE_NAME)
                .parent(topObjectProperty)
                .source(thingConcept)
                .target(thingConcept)
                .property(SchemaProperties.DISPLAY_NAME.getPropertyName(), stringValue("Has File Source"))
                .coreConcept(true)
                .save();

        // properties
        String displayFormula = MessageFormat.format("_.compact([ dependentProp('%s'), dependentProp('%s')]).join(',')",
                StructuredIngestSchema.TARGET_PROPERTY.getPropertyName(),
                StructuredIngestSchema.ERROR_MESSAGE_PROPERTY.getPropertyName());

        schemaFactory.newConceptProperty()
                .concepts(thingConcept)
                .name(StructuredIngestSchema.ERROR_MESSAGE_PROPERTY.getPropertyName())
                .displayName("Error Message")
                .type(PropertyType.STRING)
                .addable(false)
                .updatable(false)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(thingConcept)
                .name(StructuredIngestSchema.TARGET_PROPERTY.getPropertyName())
                .displayName("Target Property")
                .type(PropertyType.STRING)
                .addable(false)
                .updatable(false)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(thingConcept)
                .name(StructuredIngestSchema.RAW_CELL_VALUE_PROPERTY.getPropertyName())
                .displayName("Raw Value")
                .type(PropertyType.STRING)
                .addable(false)
                .updatable(false)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(thingConcept)
                .name(StructuredIngestSchema.SHEET_PROPERTY.getPropertyName())
                .displayName("Sheet")
                .type(PropertyType.STRING)
                .addable(false)
                .updatable(false)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(thingConcept)
                .name(StructuredIngestSchema.ROW_PROPERTY.getPropertyName())
                .displayName("Row")
                .type(PropertyType.STRING)
                .addable(false)
                .updatable(false)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(thingConcept)
                .name(StructuredIngestSchema.MAPPING_PROPERTY.getPropertyName())
                .displayName("Mapping")
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(thingConcept)
                .name(StructuredIngestSchema.PARSING_ERROR_PROPERTY.getPropertyName())
                .displayName("Parsing Error")
                .type(PropertyType.STRING)
                .displayFormula(displayFormula)
                .dependentPropertyNames(ImmutableList.of(
                        StructuredIngestSchema.ERROR_MESSAGE_PROPERTY.getPropertyName(),
                        StructuredIngestSchema.TARGET_PROPERTY.getPropertyName(),
                        StructuredIngestSchema.RAW_CELL_VALUE_PROPERTY.getPropertyName(),
                        StructuredIngestSchema.SHEET_PROPERTY.getPropertyName(),
                        StructuredIngestSchema.ROW_PROPERTY.getPropertyName()
                ))
                .addable(false)
                .updatable(false)
                .save();
    }

    private void createDataConnectionOntology() {
        //concepts
        Concept dataConnection = schemaFactory.newConcept()
                .conceptType(DataConnectionSchema.DATA_CONNECTION_CONCEPT_NAME)
                .parent(thingConcept)
                .displayName("Data Connection")
                .coreConcept(true)
                .property(SchemaProperties.UPDATEABLE.getPropertyName(),FALSE)
                .save();

        Concept dataSource = schemaFactory.newConcept()
                .conceptType(DataConnectionSchema.DATA_SOURCE_CONCEPT_NAME)
                .parent(thingConcept)
                .displayName("Data Source")
                .coreConcept(true)
                .property(SchemaProperties.UPDATEABLE.getPropertyName(),FALSE)
                .save();

        // relations
        schemaFactory.newRelationship()
                .label(DataConnectionSchema.DATA_CONNECTION_TO_DATA_SOURCE_EDGE_NAME)
                .parent(topObjectProperty)
                .source(dataConnection)
                .target(dataSource)
                .coreConcept(true)
                .save();

        // properties
        schemaFactory.newConceptProperty()
                .concepts(dataConnection)
                .name(DataConnectionSchema.DC_NAME.getPropertyName())
                .displayName("DC Name")
                .type(PropertyType.STRING)
                .textIndexHints(TextIndexHint.ALL)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataConnection)
                .name(DataConnectionSchema.DC_DESCRIPTION.getPropertyName())
                .displayName("DC Description")
                .type(PropertyType.STRING)
                .textIndexHints(TextIndexHint.ALL)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataConnection)
                .name(DataConnectionSchema.DC_DRIVER_CLASS.getPropertyName())
                .displayName("DC Driver Class")
                .type(PropertyType.STRING)
                .textIndexHints(TextIndexHint.ALL)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataConnection)
                .name(DataConnectionSchema.DC_JDBC_URL.getPropertyName())
                .displayName("DC JDBC URL")
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataConnection)
                .name(DataConnectionSchema.DC_DRIVER_PROPS.getPropertyName())
                .displayName("DC JDBC Driver Properties")
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataConnection)
                .name(DataConnectionSchema.DC_USERNAME.getPropertyName())
                .displayName("DC JDBC User")
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataConnection)
                .name(DataConnectionSchema.DC_PASSWORD.getPropertyName())
                .displayName("DC JDBC Password")
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataSource)
                .name(DataConnectionSchema.DS_NAME.getPropertyName())
                .displayName("DS Name")
                .type(PropertyType.STRING)
                .textIndexHints(TextIndexHint.ALL)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataSource)
                .name(DataConnectionSchema.DS_DESCRIPTION.getPropertyName())
                .displayName("DS Description")
                .type(PropertyType.STRING)
                .textIndexHints(TextIndexHint.ALL)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataSource)
                .name(DataConnectionSchema.DS_MAX_RECORDS.getPropertyName())
                .displayName("DS Max Records")
                .type(PropertyType.INTEGER)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataSource)
                .name(DataConnectionSchema.DS_SQL.getPropertyName())
                .displayName("DS Select Statement")
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataSource)
                .name(DataConnectionSchema.DS_ENTITY_MAPPING.getPropertyName())
                .displayName("DS Entity Mapping JSON")
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataSource)
                .name(DataConnectionSchema.DS_RELATIONSHIP_MAPPING.getPropertyName())
                .displayName("DS Relationship Mapping JSON")
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataSource)
                .name(DataConnectionSchema.DS_IMPORT_CONFIG.getPropertyName())
                .displayName("DS Import Params JSON")
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataSource)
                .name(DataConnectionSchema.DS_LAST_IMPORT_DATE.getPropertyName())
                .displayName("Last Import Run")
                .type(PropertyType.DATE)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(dataSource)
                .name(DataConnectionSchema.DS_IMPORT_RUNNING.getPropertyName())
                .displayName("Import is Running")
                .type(PropertyType.BOOLEAN)
                .save();
    }

    private void createBehaviourOntology() {
        Concept behaviour = schemaFactory.newConcept()
                .conceptType(BehaviourSchema.BEHAVIOUR_CONCEPT_NAME)
                .parent(thingConcept)
                .displayName("Behaviour")
                .coreConcept(true)
                .property(SchemaProperties.UPDATEABLE.getPropertyName(),FALSE)
                .save();

        Concept behaviourQuery = schemaFactory.newConcept()
                .conceptType(BehaviourSchema.BEHAVIOUR_QUERY_CONCEPT_NAME)
                .parent(thingConcept)
                .displayName("Behaviour Query")
                .coreConcept(true)
                .property(SchemaProperties.UPDATEABLE.getPropertyName(),FALSE)
                .save();

        schemaFactory.newRelationship()
                .label(BehaviourSchema.BEHAVIOUR_TO_BEHAVIOUR_QUERY_EDGE_NAME)
                .parent(topObjectProperty)
                .source(behaviour)
                .target(behaviourQuery)
                .coreConcept(true)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(behaviour)
                .name(BehaviourSchema.BH_NAME.getPropertyName())
                .displayName("BH Name")
                .type(PropertyType.STRING)
                .textIndexHints(TextIndexHint.ALL)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(behaviour)
                .name(BehaviourSchema.BH_DESCRIPTION.getPropertyName())
                .displayName("BH Description")
                .type(PropertyType.STRING)
                .textIndexHints(TextIndexHint.ALL)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(behaviour)
                .name(BehaviourSchema.BH_THRESHOLD.getPropertyName())
                .displayName("BH Threshold")
                .type(PropertyType.INTEGER)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(behaviourQuery)
                .name(BehaviourSchema.BHQ_SAVED_SEARCH_ID.getPropertyName())
                .displayName("BHQ Saved Search Id")
                .type(PropertyType.STRING)
                .save();

        schemaFactory.newConceptProperty()
                .concepts(behaviour)
                .name(BehaviourSchema.BHQ_SCORE.getPropertyName())
                .displayName("BHQ Score")
                .type(PropertyType.INTEGER)
                .save();
    }
}
