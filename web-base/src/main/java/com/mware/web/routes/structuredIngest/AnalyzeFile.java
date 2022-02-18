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
package com.mware.web.routes.structuredIngest;

import com.google.common.collect.Lists;
import com.google.inject.Inject;
import com.mware.core.exception.BcException;
import com.mware.core.ingest.structured.model.ClientApiAnalysis;
import com.mware.core.ingest.structured.model.StructuredIngestParser;
import com.mware.core.ingest.structured.model.StructuredIngestParserFactory;
import com.mware.core.user.User;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.utils.StringUtils;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.IOUtils;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.Part;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.util.List;

public class AnalyzeFile implements ParameterizedHandler {
    private final Graph graph;
    private final StructuredIngestParserFactory structuredIngestParserFactory;

    @Inject
    public AnalyzeFile(Graph graph, StructuredIngestParserFactory structuredIngestParserFactory) {
        this.graph = graph;
        this.structuredIngestParserFactory = structuredIngestParserFactory;
    }

    @Handle
    public ClientApiAnalysis handle(
            Authorizations authorizations,
            HttpServletRequest request,
            @ActiveWorkspaceId String workspaceId,
            User user
    ) throws Exception {
        final List<Part> files = Lists.newArrayList(request.getParts());
        if (files.size() != 1) {
            throw new RuntimeException("Wrong number of uploaded files. Expected 1 got " + files.size());
        }

        final Part file = files.get(0);
        byte[] fileData = IOUtils.toByteArray(file.getInputStream());

        File tmpFile = File.createTempFile(workspaceId, "."+FilenameUtils.getExtension(file.getSubmittedFileName()));
        tmpFile.deleteOnExit();
        IOUtils.copy(new ByteArrayInputStream(fileData), new FileOutputStream(tmpFile));
        String mimeType = guessMimeType(file.getSubmittedFileName());

        StructuredIngestParser parser = structuredIngestParserFactory.getParser(mimeType);
        if (parser != null) {
            ClientApiAnalysis analysis = parser.analyze(new ByteArrayInputStream(fileData), user, authorizations);
            analysis.tmpFile = tmpFile.getAbsolutePath();
            return analysis;
        }

        throw new BcException("Could not find a parser for the uploaded file.");
    }

    public static String guessMimeType(String submittedFileName) {
        String fileExt = FilenameUtils.getExtension(submittedFileName);
        if (!StringUtils.isEmpty(fileExt)) {
            switch (fileExt) {
                case "csv":
                    return "text/csv";
                case "xls":
                case "xlsx":
                    return "application/xls";
            }
        }

        return "application/octet-stream";
    }
}

