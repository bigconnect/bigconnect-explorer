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

import com.google.inject.Singleton;
import com.mware.core.model.schema.SchemaProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Property;
import com.mware.ge.Vertex;
import com.mware.ge.tools.GraphToolBase;
import com.mware.ge.values.storable.DateTimeValue;
import com.mware.ge.values.storable.StreamingPropertyValue;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;

import javax.inject.Inject;
import java.io.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static com.mware.web.routes.vertex.ExportUtils.CHARS_TO_AVOID;

@Singleton
public class ExportToWordHelper {
    public static final String EXPORT_FILE_EXT = ".docx";
    public static final String EXPORT_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    private Graph graph;
    private WebQueueRepository webQueueRepository;
    private final SchemaRepository schemaRepository;

    @Inject
    public ExportToWordHelper(
            Graph graph,
            WebQueueRepository webQueueRepository,
            SchemaRepository schemaRepository
    ) {
        this.graph = graph;
        this.webQueueRepository = webQueueRepository;
        this.schemaRepository = schemaRepository;
    }

    public InputStream export(
            List<String> vertices,
            Authorizations authorizations,
            Optional<String> workspaceId
    ) {
        XWPFDocument document = new XWPFDocument();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        vertices.stream().forEach(vertexId -> {
            Vertex v = graph.getVertex(vertexId, authorizations);

            if (v != null) {
                XWPFParagraph paragraph;
                XWPFRun run;
                try {
                    List<ImmutablePair<String, String>> addToTheEnd = new ArrayList<>();
                    for (SchemaProperty prop : schemaRepository.getProperties(SchemaRepository.PUBLIC)) {
                        if (prop.getUserVisible() && v.getProperty(prop.getName()) != null && v.getProperty(prop.getName()).getValue() != null) {
                            String displayName = prop.getDisplayName();
                            for (String stringToAvoid : CHARS_TO_AVOID) {
                                displayName = displayName.replace(stringToAvoid,"");
                            }

                            if (v.getProperty(prop.getName()).getValue() instanceof StreamingPropertyValue) {
                                StreamingPropertyValue _value = (StreamingPropertyValue)v.getProperty(prop.getName()).getValue();
                                StringWriter stringWriter = new StringWriter();
                                org.apache.commons.io.IOUtils.copy(_value.getInputStream(), stringWriter, "utf-8");
                                String value = stringWriter.toString();
                                addToTheEnd.add(new ImmutablePair<>(displayName, value));
                            } else if (v.getProperty(prop.getName()).getValue() instanceof DateTimeValue) {
                                String value = v.getProperty(prop.getName()).getValue().prettyPrint();
                                addParagraph(document, displayName, value);
                            } else {
                                for (Property p : v.getProperties(prop.getName())) {
                                    addParagraph(document, displayName, p.getValue().prettyPrint());
                                }
                            }
                        }
                    }
                    for (ImmutablePair<String, String> pair : addToTheEnd) {
                        addParagraph(document, pair.getLeft(), pair.getRight());
                    }
                    paragraph = document.createParagraph();
                    run = paragraph.createRun();
                    run.setText("\n\n\n");
                } catch (Exception e) {
                    e.printStackTrace();
                }

                if (workspaceId.isPresent()) {
                    webQueueRepository.broadcastPropertyChange(v, null, null, workspaceId.get());
                }
            }
        });

        try {
            document.write(out);
            out.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
        return new ByteArrayInputStream(out.toByteArray());
    }

    private void addParagraph(XWPFDocument document, String displayName, String value) {
        XWPFParagraph paragraph = document.createParagraph();
        XWPFRun run = paragraph.createRun();
        run.setBold(true);
        run.setFontSize(14);
        run.setText(displayName + ": " + value);
    }

    public static String getExportFileName() {
        return "export_vertex_"
                + LocalDateTime.now().format(GraphToolBase.BACKUP_DATETIME_FORMATTER)
                + EXPORT_FILE_EXT;
    }
}
