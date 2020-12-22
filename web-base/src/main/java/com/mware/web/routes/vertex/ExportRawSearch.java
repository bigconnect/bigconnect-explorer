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
import com.mware.core.model.longRunningProcess.LongRunningProcessRepository;
import com.mware.core.user.User;
import com.mware.ge.Authorizations;
import com.mware.search.SearchOptions;
import com.mware.search.worker.export.SearchExportLRPQueueItem;
import com.mware.search.worker.export.SearchExportLongRunningWorker;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.model.ClientApiLongRunningProcessSubmitResponse;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.routes.search.WebSearchOptionsFactory;

import javax.servlet.http.HttpServletRequest;
import java.util.Map;

@Singleton
public class ExportRawSearch implements ParameterizedHandler {
    private LongRunningProcessRepository longRunningProcessRepository;

    private static final String SIZE = "1000000";

    @Inject
    public ExportRawSearch(LongRunningProcessRepository longRunningProcessRepository) {
        this.longRunningProcessRepository = longRunningProcessRepository;
    }

    @Handle
    public ClientApiLongRunningProcessSubmitResponse handle(
            HttpServletRequest request,
            @ActiveWorkspaceId String workspaceId,
            User user,
            Authorizations authorizations
    ) throws Exception {
        SearchOptions searchOptions = WebSearchOptionsFactory.create(request, workspaceId);
        Map<String, Object> parameters = searchOptions.getParameters();
        if (parameters.containsKey("user.current")) {
            parameters.remove("user.current");
        }
        if (parameters.containsKey("websterMatchedRoute")) {
            parameters.remove("websterMatchedRoute");
        }
        if (parameters.containsKey("websterApp")) {
            parameters.remove("websterApp");
        }
        if (!parameters.containsKey("q")) {
            parameters.put("q", "*");
        }
        parameters.put("size", SIZE);

        SearchExportLRPQueueItem queueItem =
                new SearchExportLRPQueueItem(parameters, workspaceId,
                        authorizations.getAuthorizations(), user.getUserId(), SearchExportLongRunningWorker.TYPE);
        String id = this.longRunningProcessRepository.enqueue(queueItem, user, authorizations);

        return new ClientApiLongRunningProcessSubmitResponse(id);
    }
}
