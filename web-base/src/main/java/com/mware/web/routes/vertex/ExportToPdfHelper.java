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
import com.itextpdf.text.Document;
import com.itextpdf.text.DocumentException;
import com.itextpdf.text.Font;
import com.itextpdf.text.Paragraph;
import com.itextpdf.text.pdf.BaseFont;
import com.itextpdf.text.pdf.FontSelector;
import com.itextpdf.text.pdf.PdfWriter;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcException;
import com.mware.core.model.schema.SchemaProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Property;
import com.mware.ge.Vertex;
import com.mware.ge.tools.GraphToolBase;
import com.mware.ge.values.storable.DateTimeValue;
import com.mware.ge.values.storable.StreamingPropertyValue;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.joda.time.DateTime;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static com.mware.web.routes.vertex.ExportUtils.CHARS_TO_AVOID;
import static com.mware.web.routes.vertex.ExportUtils.DATE_FORMAT;

@Singleton
public class ExportToPdfHelper {
    public static final String EXPORT_FILE_EXT = ".pdf";
    public static final String EXPORT_MIME_TYPE = "application/pdf";

    private final Configuration configuration;
    private final Graph graph;
    private final SchemaRepository schemaRepository;

    @Inject
    public ExportToPdfHelper(Graph graph, SchemaRepository schemaRepository, Configuration configuration) {
        this.graph = graph;
        this.schemaRepository = schemaRepository;
        this.configuration = configuration;
    }

    public InputStream export(List<String> vertices, Authorizations authorizations) {
        Document document = new Document();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter pdfWriter = PdfWriter.getInstance(document, out);
            String fontFilePath = configuration.get("fontfile.path",null);
            if (fontFilePath == null) {
                throw new BcException("No font configured, use fontfile.path config property!");
            }
            File fontFile = new File(fontFilePath);
            pdfWriter.getAcroForm().setNeedAppearances(true);
            BaseFont unicode = BaseFont.createFont(fontFile.getAbsolutePath(), BaseFont.IDENTITY_H, BaseFont.EMBEDDED);

            FontSelector fs = new FontSelector();
            fs.addFont(new Font(unicode));

            document.open();
            vertices.stream().forEach(vertexId -> {
                Vertex v = graph.getVertex(vertexId, authorizations);

                if (v != null) {
                    boolean vertexPropWritten = false;
                    List<ImmutablePair<String, String>> addToTheEnd = new ArrayList<>();
                    try {
                        for (SchemaProperty prop : schemaRepository.getProperties()) {
                            if (prop.getUserVisible() && v.getProperty(prop.getName()) != null && v.getProperty(prop.getName()).getValue() != null) {
                                String displayName = prop.getDisplayName();
                                for (String stringToAvoid : CHARS_TO_AVOID) {
                                    displayName = displayName.replace(stringToAvoid,"");
                                }
                                if (v.getProperty(prop.getName()).getValue() instanceof StreamingPropertyValue) {
                                    String value = ((StreamingPropertyValue)v.getProperty(prop.getName()).getValue()).readToString();
                                    addToTheEnd.add(new ImmutablePair<>(displayName, value));
                                } else if (v.getProperty(prop.getName()).getValue() instanceof DateTimeValue) {
                                    String value = v.getProperty(prop.getName()).getValue().prettyPrint();
                                    addParagraph(document, fs, displayName, value);
                                    vertexPropWritten = true;
                                } else {
                                    for (Property p : v.getProperties(prop.getName())) {
                                        addParagraph(document, fs, displayName, p.getValue().prettyPrint());
                                        vertexPropWritten = true;
                                    }
                                }
                            }
                        }
                        for (ImmutablePair<String, String> pair: addToTheEnd) {
                            addParagraph(document, fs, pair.getLeft(), pair.getRight());
                            vertexPropWritten = true;
                        }
                        // if we wrote at least one prop, add new line
                        if (vertexPropWritten) {
                            document.add(new Paragraph(fs.process(" ")));
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
            document.close();
            pdfWriter.close();
        } catch (Exception e) {
            e.printStackTrace();
        }

        return new ByteArrayInputStream(out.toByteArray());
    }

    private void addParagraph(Document document, FontSelector fs, String displayName, String value) throws DocumentException {
        document.add(new Paragraph(fs.process(displayName + ": " + value)));
    }

    public static String getExportFileName() {
        return "export_vertex_"
                + LocalDateTime.now().format(GraphToolBase.BACKUP_DATETIME_FORMATTER)
                + EXPORT_FILE_EXT;
    }
}
