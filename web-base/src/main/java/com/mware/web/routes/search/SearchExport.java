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
package com.mware.web.routes.search;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.user.User;
import com.mware.core.util.ClientApiConverter;
import com.mware.ge.Authorizations;
import com.mware.search.SearchHelper;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSearch;
import com.mware.web.routes.vertex.ExportToPdfHelper;
import com.mware.web.routes.vertex.ExportToWordHelper;
import com.mware.web.routes.vertex.ExportToXlsHelper;
import com.mware.web.routes.vertex.ExportToXmlHelper;
import org.json.JSONObject;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Singleton
public class SearchExport implements ParameterizedHandler {
    private final SearchHelper searchHelper;
    private final ExportToXlsHelper exportToXlsHelper;
    private final ExportToWordHelper exportToWordHelper;
    private final ExportToXmlHelper exportToXmlHelper;
    private final ExportToPdfHelper exportToPdfHelper;

    @Inject
    public SearchExport(SearchHelper searchHelper,
                        ExportToXlsHelper exportToXlsHelper,
                        ExportToWordHelper exportToWordHelper,
                        ExportToXmlHelper exportToXmlHelper,
                        ExportToPdfHelper exportToPdfHelper) {
        this.searchHelper = searchHelper;
        this.exportToXlsHelper = exportToXlsHelper;
        this.exportToWordHelper = exportToWordHelper;
        this.exportToXmlHelper = exportToXmlHelper;
        this.exportToPdfHelper = exportToPdfHelper;
    }

    @Handle
    public InputStream handle(
                @Required(name = "type") String exportType,
                @Required(name = "url") String url,
                @Required(name = "parameters") JSONObject searchParameters,
                User user,
                Authorizations authorizations,
                BcResponse response
            ) throws Exception {
        if (!SearchHelper.isVertexRunner(url) && !SearchHelper.isCypherRunner(url)) {
            throw new BcException("Only vertex exports are supported!");
        }

        ClientApiSearch search = new ClientApiSearch();
        search.id = "exportSearch_" + exportType;
        search.name = "exportSearch_" + exportType;
        search.url = url;
        search.parameters = ClientApiConverter.toClientApiValue(searchParameters);

        List<String> vertexIds = new ArrayList();

        if (SearchHelper.isVertexRunner(url)) {
            vertexIds.addAll(searchHelper.search(search, user, authorizations, false).stream()
                    .map(v -> v.getId())
                    .collect(Collectors.toList()));
        } else if (SearchHelper.isCypherRunner(url)) {
            vertexIds.addAll(searchHelper.searchCypher(search, user, authorizations));
        }

        InputStream results;
        switch (exportType) {
            case "word":
                results = exportToWordHelper.export(vertexIds, authorizations, Optional.empty());
                response.setContentType(ExportToWordHelper.EXPORT_MIME_TYPE);
                response.addHeader("Content-Disposition", "attachment; filename=\"" + ExportToWordHelper.getExportFileName() + "\"");
                break;
            case "xls":
                results = exportToXlsHelper.export(vertexIds, authorizations);
                response.setContentType(ExportToXlsHelper.EXPORT_MIME_TYPE);
                response.addHeader("Content-Disposition", "attachment; filename=\"" + ExportToXlsHelper.getExportFileName() + "\"");
                break;
            case "xml":
                results = exportToXmlHelper.export(vertexIds, authorizations);
                response.setContentType(ExportToXmlHelper.EXPORT_MIME_TYPE);
                response.addHeader("Content-Disposition", "attachment; filename=\"" + ExportToXmlHelper.getExportFileName() + "\"");
                break;
            case "pdf":
                results = exportToPdfHelper.export(vertexIds, authorizations);
                response.setContentType(ExportToPdfHelper.EXPORT_MIME_TYPE);
                response.addHeader("Content-Disposition", "attachment; filename=\"" + ExportToPdfHelper.getExportFileName() + "\"");
                break;
            default:
                throw new BcException(String.format("Unknown export type %s", exportType));
        }
        return results;
    }
}
