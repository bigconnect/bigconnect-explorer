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
import com.mware.core.model.schema.Concept;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.schema.SchemaRepositoryBase;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.security.VisibilityTranslator;
import com.mware.core.user.User;
import com.mware.ge.Authorizations;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.framework.utils.StringUtils;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import org.apache.commons.io.IOUtils;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

import static com.mware.ge.values.storable.Values.booleanValue;
import static com.mware.ge.values.storable.Values.stringValue;

public class OntologyManagerConceptSave implements ParameterizedHandler {
    private final SchemaRepository schemaRepository;
    private final AuthorizationRepository authorizationRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final WebQueueRepository webQueueRepository;

    @Inject
    public OntologyManagerConceptSave(
            SchemaRepository schemaRepository,
            AuthorizationRepository authorizationRepository,
            VisibilityTranslator visibilityTranslator,
            WebQueueRepository webQueueRepository
    ) {
        this.schemaRepository = schemaRepository;
        this.authorizationRepository = authorizationRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.webQueueRepository = webQueueRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "namespace") String namespace,
            @Required(name = "concept") ClientApiSchema.Concept concept,
            @ActiveWorkspaceId String userWorkspaceId,
            HttpServletRequest request,
            HttpServletResponse response,
            User user
    ) {
        Concept parent = schemaRepository.getConceptByName(concept.getParentConcept(), namespace);
        if(parent != null) {
            Authorizations authorizations = authorizationRepository.getGraphAuthorizations(user);

            Concept newConcept = schemaRepository.getOrCreateConcept(
                    parent, concept.getTitle(), concept.getDisplayName(),
                    user, namespace
            );
            newConcept.setProperty(SchemaProperties.DISPLAY_NAME.getPropertyName(), stringValue(concept.getDisplayName()), user, authorizations);
            newConcept.setProperty(SchemaProperties.USER_VISIBLE.getPropertyName(), booleanValue(concept.getUserVisible()), user, authorizations);
            newConcept.setProperty(SchemaProperties.SEARCHABLE.getPropertyName(), booleanValue(concept.getSearchable()), user, authorizations);
            newConcept.setProperty(SchemaProperties.DELETEABLE.getPropertyName(), booleanValue(concept.getDeleteable()), user, authorizations);
            newConcept.setProperty(SchemaProperties.UPDATEABLE.getPropertyName(), booleanValue(concept.getUpdateable()), user, authorizations);

            newConcept.updateIntents(concept.getIntents().toArray(new String[]{}), user, authorizations);
            newConcept.setProperty(SchemaProperties.DISPLAY_TYPE.getPropertyName(), stringValue(concept.getDisplayType()), user, authorizations);
            newConcept.setProperty(SchemaProperties.COLOR.getPropertyName(), stringValue(concept.getColor()), user, authorizations);

            if(!StringUtils.isEmpty(concept.getGlyphIconHref())) {
                newConcept.setProperty(SchemaProperties.GLYPH_ICON_FILE_NAME.getPropertyName(), stringValue(concept.getGlyphIconHref()), user, authorizations);

                try {
                    InputStream is = request.getServletContext().getResourceAsStream(concept.getGlyphIconHref());
                    ByteArrayOutputStream imgOut = new ByteArrayOutputStream();
                    IOUtils.copy(is, imgOut);
                    byte[] rawImg = imgOut.toByteArray();
                    ((SchemaRepositoryBase) schemaRepository).addEntityGlyphIconToEntityConcept(newConcept, rawImg, true);
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
            } else {
                if(newConcept.getGlyphIcon() == null) {
                    newConcept.setProperty(SchemaProperties.GLYPH_ICON_FILE_NAME.getPropertyName(), stringValue("img/glyphicons/glyphicons_194_circle_question_mark@2x.png"), user, authorizations);
                }
            }

            newConcept.setProperty(SchemaProperties.TITLE_FORMULA.getPropertyName(), stringValue(concept.getTitleFormula()), user, authorizations);
            newConcept.setProperty(SchemaProperties.SUBTITLE_FORMULA.getPropertyName(), stringValue(concept.getSubtitleFormula()), user, authorizations);
            newConcept.setProperty(SchemaProperties.TIME_FORMULA.getPropertyName(), stringValue(concept.getTimeFormula()), user, authorizations);

            schemaRepository.clearCache();
            webQueueRepository.pushOntologyConceptsChange(userWorkspaceId, parent.getId(), newConcept.getId());
        }

        return BcResponse.SUCCESS;
    }
}
