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
import com.mware.ge.Vertex;
import com.mware.ge.tools.GraphToolBase;
import com.mware.ge.values.storable.DateTimeValue;
import com.mware.ge.values.storable.StreamingPropertyValue;
import com.mware.ge.values.storable.Value;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Singleton
public class ExportToXlsHelper {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(ExportToXlsHelper.class);
    public static final String EXPORT_FILE_EXT = ".xlsx";
    public static final String EXPORT_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private Graph graph;
    private final SchemaRepository ontologyRepository;

    @Inject
    public ExportToXlsHelper(Graph graph, SchemaRepository ontologyRepository) {
        this.graph = graph;
        this.ontologyRepository = ontologyRepository;
    }

    public InputStream export(List<String> vertices, Authorizations authorizations) {
        Workbook wb = new XSSFWorkbook();
        XSSFSheet sheet = (XSSFSheet) wb.createSheet();

        short rowIndex = 0;

        Map<String, String> uniqueColumns = new HashMap<>();
        for (SchemaProperty prop : ontologyRepository.getProperties(SchemaRepository.PUBLIC)) {
            if (prop.getUserVisible()) {
                if (!uniqueColumns.containsKey(prop.getName()))
                    uniqueColumns.put(prop.getName(), prop.getDisplayName());
            }
        }
        uniqueColumns = sortByValue(uniqueColumns);

        Row headerRow = sheet.createRow(rowIndex++);
        int cellIndex = 0;
        for (Map.Entry<String, String> prop : uniqueColumns.entrySet()) {
            headerRow.createCell(cellIndex++).setCellValue(prop.getValue());
        }

        appendVertices(sheet, rowIndex, vertices, authorizations, uniqueColumns);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            wb.write(out);
            out.close();
        } catch (IOException e) {
            e.printStackTrace();
        }

        return new ByteArrayInputStream(out.toByteArray());
    }

    private void appendVertices(XSSFSheet sheet, short rowIndex, List<String> vertices, Authorizations authorizations, Map<String, String> uniqueColumns) {
        for (String vertexId : vertices) {
            Vertex v = graph.getVertex(vertexId, authorizations);
            if (v != null) {
                Row row = sheet.createRow(rowIndex++);

                int cellIndex = 0;
                for (Map.Entry<String, String> entry : uniqueColumns.entrySet()) {
                    String propIRI = entry.getKey();
                    if (v.getProperty(propIRI) == null || v.getProperty(propIRI).getValue() == null) {
                        cellIndex++;
                        continue;
                    }

                    String value = "";
                    try {
                        if (v.getProperty(propIRI).getValue() instanceof StreamingPropertyValue) {
                            value = ((StreamingPropertyValue) v.getProperty(propIRI).getValue()).readToString();
                        } else if (v.getProperty(propIRI).getValue() instanceof DateTimeValue) {
                            value = v.getProperty(propIRI).getValue().prettyPrint();
                        } else {
                            Iterable<Value> propValue = v.getPropertyValues(propIRI);
                            if (propValue != null) {
                                for (Value val : propValue) {
                                    if (val != null)
                                        value += val.prettyPrint() + ",";
                                }

                                if (value.endsWith(","))
                                    value = value.substring(0, value.length() - 1);
                            }
                        }

                        if (value.length() > 30000) value = value.substring(0, 30000);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }

                    row.createCell(cellIndex).setCellValue(value);
                    cellIndex++;
                }
            }
        }
    }

    public <K, V extends Comparable<? super V>> Map<K, V> sortByValue(Map<K, V> map) {
        return map.entrySet()
                .stream()
                .sorted(Map.Entry.comparingByValue(/*Collections.reverseOrder()*/))
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (e1, e2) -> e1,
                        LinkedHashMap::new
                ));
    }

    public static String getExportFileName() {
        return "export_vertex_"
                + LocalDateTime.now().format(GraphToolBase.BACKUP_DATETIME_FORMATTER)
                + EXPORT_FILE_EXT;
    }

}


