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
package com.mware.web.routes.vertex;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.schema.SchemaProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Property;
import com.mware.ge.Vertex;
import com.mware.ge.collection.Pair;
import com.mware.ge.tools.GraphToolBase;
import com.mware.ge.values.storable.DateTimeValue;
import com.mware.ge.values.storable.StreamingPropertyValue;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static com.mware.ge.collection.Pair.pair;
import static com.mware.web.routes.vertex.ExportUtils.CHARS_TO_AVOID;

@Singleton
public class ExportToXmlHelper {
    private static final String EXPORT_FILE_EXT = ".xml";
    public static final String EXPORT_MIME_TYPE = "application/xml";

    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(ExportToXmlHelper.class);

    private final Graph graph;
    private final SchemaRepository ontologyRepository;


    @Inject
    public ExportToXmlHelper(Graph graph, SchemaRepository ontologyRepository) {
        this.graph = graph;
        this.ontologyRepository = ontologyRepository;
    }

    public InputStream export(List<String> vertices, Authorizations authorizations) throws ParserConfigurationException {
        Document doc = DocumentBuilderFactory.newInstance().newDocumentBuilder().newDocument();
        Element base = doc.createElement("Entities");
        doc.appendChild(base);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            vertices.forEach(vertexId -> {
                Vertex v = graph.getVertex(vertexId, authorizations);
                Element vertexElement = doc.createElement("Entity");
                boolean vertexPropWritten = false;
                if (v != null) {
                    List<Pair<String, String>> addToTheEnd = new ArrayList<>();
                    for (SchemaProperty prop : ontologyRepository.getProperties()) {
                        try {
                            if (prop.getUserVisible() && v.getProperty(prop.getName()) != null && v.getProperty(prop.getName()).getValue() != null) {
                                String displayName = prop.getDisplayName();
                                for (String stringToAvoid : CHARS_TO_AVOID) {
                                    displayName = displayName.replace(stringToAvoid, "");
                                }
                                if (v.getProperty(prop.getName()).getValue() instanceof StreamingPropertyValue) {
                                    String value = ((StreamingPropertyValue) v.getProperty(prop.getName()).getValue()).readToString();
                                    addToTheEnd.add(pair(displayName, value));
                                } else if (v.getProperty(prop.getName()).getValue() instanceof DateTimeValue) {
                                    String value = v.getProperty(prop.getName()).getValue().prettyPrint();
                                    addElement(doc, vertexElement, displayName, value);
                                    vertexPropWritten = true;
                                } else {
                                    for (Property p : v.getProperties(prop.getName())) {
                                        addElement(doc, vertexElement, displayName, p.getValue().prettyPrint());
                                        vertexPropWritten = true;
                                    }
                                }
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                    for (Pair<String, String> pair : addToTheEnd) {
                        addElement(doc, vertexElement, pair.first(), pair.other());
                        vertexPropWritten = true;
                    }
                }
                if (vertexPropWritten) {
                    base.appendChild(vertexElement);
                }
            });

            TransformerFactory transformerFactory = TransformerFactory.newInstance();
            transformerFactory.setAttribute("indent-number", 2);
            Transformer transformer = transformerFactory.newTransformer();
            transformer.setOutputProperty(OutputKeys.INDENT, "yes");
            transformer.transform(new DOMSource(doc), new StreamResult(out));
        } catch (Exception e) {
            LOGGER.error(e.getMessage(), e);
        }

        return new ByteArrayInputStream(out.toByteArray());
    }

    private void addElement(Document doc, Element vertexElement, String displayName, String value) {
        Element elementProperty = doc.createElement(displayName);
        elementProperty.appendChild(doc.createTextNode(value));
        vertexElement.appendChild(elementProperty);
    }

    public static String getExportFileName() {
        return "export_vertex_"
                + LocalDateTime.now().format(GraphToolBase.BACKUP_DATETIME_FORMATTER)
                + EXPORT_FILE_EXT;
    }

}

