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
package com.mware.web;

import com.google.common.collect.Lists;
import com.google.inject.Inject;
import com.google.inject.Injector;
import com.mware.core.bootstrap.InjectHelper;
import com.mware.core.config.Configuration;
import com.mware.core.exception.BcAccessDeniedException;
import com.mware.core.exception.BcException;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.ServiceLoaderUtil;
import com.mware.geocoder.DefaultGeocoderRepository;
import com.mware.geocoder.GeocoderRepository;
import com.mware.web.framework.Handler;
import com.mware.web.framework.handlers.CLStaticHttpHandler;
import com.mware.web.framework.handlers.StaticResourceHandler;
import com.mware.web.privilegeFilters.*;
import com.mware.web.routes.Download;
import com.mware.web.routes.Index;
import com.mware.web.routes.admin.AdminList;
import com.mware.web.routes.admin.DeleteElements;
import com.mware.web.routes.admin.PluginList;
import com.mware.web.routes.admin.RestoreElements;
import com.mware.web.routes.behaviour.*;
import com.mware.web.routes.dashboard.*;
import com.mware.web.routes.dataload.*;
import com.mware.web.routes.dataset.DatasetList;
import com.mware.web.routes.dataset.ProcessedDataset;
import com.mware.web.routes.dataset.ReadDataset;
import com.mware.web.routes.edge.*;
import com.mware.web.routes.element.ElementSearch;
import com.mware.web.routes.extendedData.ExtendedDataGet;
import com.mware.web.routes.extendedData.ExtendedDataSearch;
import com.mware.web.routes.longRunningProcess.LongRunningProcessById;
import com.mware.web.routes.longRunningProcess.LongRunningProcessCancel;
import com.mware.web.routes.longRunningProcess.LongRunningProcessDelete;
import com.mware.web.routes.map.GetGeocoder;
import com.mware.web.routes.notification.Notifications;
import com.mware.web.routes.notification.SystemNotificationDelete;
import com.mware.web.routes.notification.SystemNotificationSave;
import com.mware.web.routes.notification.UserNotificationMarkRead;
import com.mware.web.routes.ontology.*;
import com.mware.web.routes.ping.Ping;
import com.mware.web.routes.ping.PingStats;
import com.mware.web.routes.product.*;
import com.mware.web.routes.regex.*;
import com.mware.web.routes.resource.MapMarkerImage;
import com.mware.web.routes.resource.ResourceExternalGet;
import com.mware.web.routes.resource.ResourceGet;
import com.mware.web.routes.role.*;
import com.mware.web.routes.search.*;
import com.mware.web.routes.security.ContentSecurityPolicyReport;
import com.mware.web.routes.structuredIngest.Analyze;
import com.mware.web.routes.structuredIngest.AnalyzeFile;
import com.mware.web.routes.structuredIngest.Ingest;
import com.mware.web.routes.structuredIngest.MimeTypes;
import com.mware.web.routes.user.*;
import com.mware.web.routes.vertex.*;
import com.mware.web.routes.watchList.CreateWatch;
import com.mware.web.routes.watchList.DeleteWatch;
import com.mware.web.routes.watchList.ListWatches;
import com.mware.web.routes.workspace.*;
import com.mware.web.webEventListeners.WebEventListener;

import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

import static com.mware.ge.util.IterableUtils.toList;

public class Router extends HttpServlet {
    private static final long serialVersionUID = 4689515508877380905L;
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(Router.class);

    private WebApp app;
    private Configuration configuration;
    private GeocoderRepository geocoderRepository;
    private List<WebEventListener> webEventListeners;
    private List<WebEventListener> webEventListenersReverse;

    @SuppressWarnings("unchecked")
    public Router(ServletContext servletContext) {
        try {
            final Injector injector = (Injector) servletContext.getAttribute(Injector.class.getName());
            injector.injectMembers(this);

            app = new WebApp(servletContext, injector);

            AuthenticationHandler authenticatorInstance = new AuthenticationHandler();
            Class<? extends Handler> authenticator = AuthenticationHandler.class;

            Class<? extends Handler> csrfProtector = BcCsrfHandler.class;

            app.get("/", UserAgentFilter.class, csrfProtector, Index.class);
            app.get("/configuration", csrfProtector, com.mware.web.routes.config.Configuration.class);
            app.post("/logout", csrfProtector, Logout.class);
            app.post("/download", authenticator, csrfProtector, EditPrivilegeFilter.class, Download.class);

            app.get("/ontology", authenticator, csrfProtector, ReadPrivilegeFilter.class, Schema.class);
            app.get("/ontology/concept-details", authenticator, csrfProtector, ReadPrivilegeFilter.class, OntologyConceptDetails.class);
            app.get("/ontology/public", authenticator, csrfProtector, ReadPrivilegeFilter.class, SchemaPublic.class);
            app.get("/ontology/workspace", authenticator, csrfProtector, ReadPrivilegeFilter.class, WorkspaceSchema.class);
            app.get("/ontology/segment", authenticator, csrfProtector, ReadPrivilegeFilter.class, SchemaGet.class);
            app.post("/ontology/concept", authenticator, csrfProtector, OntologyAddPrivilegeFilter.class, OntologyConceptSave.class);
            app.post("/ontology/property", authenticator, csrfProtector, OntologyAddPrivilegeFilter.class, SchemaPropertySave.class);
            app.post("/ontology/relationship", authenticator, csrfProtector, OntologyAddPrivilegeFilter.class, SchemaRelationshipSave.class);

            app.get("/notification/all", authenticator, csrfProtector, ReadPrivilegeFilter.class, Notifications.class);
            app.post("/notification/mark-read", authenticator, csrfProtector, ReadPrivilegeFilter.class, UserNotificationMarkRead.class);
            app.post("/notification/system", authenticator, csrfProtector, AdminPrivilegeFilter.class, SystemNotificationSave.class);
            app.delete("/notification/system", authenticator, csrfProtector, AdminPrivilegeFilter.class, SystemNotificationDelete.class);

            app.get("/resource", authenticator, csrfProtector, ReadPrivilegeFilter.class, ResourceGet.class);
            app.get("/resource/external", authenticator, csrfProtector, ReadPrivilegeFilter.class, ResourceExternalGet.class);
            app.get("/map/marker/image", csrfProtector, MapMarkerImage.class);  // TODO combine with /resource

            if (!(geocoderRepository instanceof DefaultGeocoderRepository)) {
                configuration.set(Configuration.WEB_GEOCODER_ENABLED, true);
                app.get("/map/geocode", authenticator, GetGeocoder.class);
            }

            app.post("/search/save", authenticator, csrfProtector, SearchSave.class);
            app.get("/search/all", authenticator, csrfProtector, SearchList.class);
            app.get("/search", authenticator, csrfProtector, SearchGet.class);
            app.get("/search/run", authenticator, csrfProtector, SearchRun.class);
            app.post("/search/run", authenticator, csrfProtector, SearchRun.class);
            app.post("/search/cypher", authenticator, csrfProtector, SearchCypher.class);
            app.get("/search/advanced/cypher", authenticator, csrfProtector, RunSavedSearchCypher.class);
            app.post("/search/advanced/cypher", authenticator, csrfProtector, RunSavedSearchCypher.class);
            app.delete("/search", authenticator, csrfProtector, SearchDelete.class);
            app.post("/search/export", authenticator, csrfProtector, SearchExport.class);

            app.get("/dataset", authenticator, csrfProtector, ReadDataset.class);
            app.get("/process-dataset", authenticator, csrfProtector, ProcessedDataset.class);
            app.get("/find-dataset", authenticator, csrfProtector, DatasetList.class);

            app.get("/element/search", authenticator, csrfProtector, ReadPrivilegeFilter.class, ElementSearch.class);
            app.post("/element/search", authenticator, csrfProtector, ReadPrivilegeFilter.class, ElementSearch.class);

            app.delete("/vertex", authenticator, csrfProtector, EditPrivilegeFilter.class, VertexRemove.class);
            app.get("/vertex/highlighted-text", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexHighlightedText.class);
            app.get("/vertex/raw", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexRaw.class);
            app.get("/vertex/exists", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexExists.class);
            app.post("/vertex/exists", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexExists.class);
            app.get("/vertex/thumbnail", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexThumbnail.class);
            app.get("/vertex/thumbnail-public", VertexThumbnailPublic.class);
            app.get("/vertex/poster-frame", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexPosterFrame.class);
            app.get("/vertex/video-preview", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexVideoPreviewImage.class);
            app.get("/vertex/details", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexDetails.class);
            app.get("/vertex/history", authenticator, csrfProtector, HistoryReadPrivilegeFilter.class, VertexGetHistory.class);
            app.get("/vertex/property/details", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexPropertyDetails.class);
            app.post("/vertex/import", authenticator, csrfProtector, EditPrivilegeFilter.class, VertexImport.class);
            app.post("/vertex/resolve-term", authenticator, csrfProtector, EditPrivilegeFilter.class, ResolveTermEntity.class);
            app.get("/vertex/text", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexGetText.class);
            app.post("/vertex/edit-text", authenticator, csrfProtector, EditPrivilegeFilter.class, EditTextEntity.class);
            app.post("/vertex/export-word", authenticator, csrfProtector, EditPrivilegeFilter.class, ExportToWord.class);
            app.post("/vertex/export-pdf", authenticator, csrfProtector, EditPrivilegeFilter.class, ExportToPdf.class);
            app.post("/vertex/export-xml", authenticator, csrfProtector, EditPrivilegeFilter.class, ExportToXml.class);
            app.post("/vertex/export-xls", authenticator, csrfProtector, EditPrivilegeFilter.class, ExportToXls.class);
            app.post("/vertex/export-raw-search", authenticator, csrfProtector, EditPrivilegeFilter.class, ExportRawSearch.class);

            app.post("/vertex/unresolve-term", authenticator, csrfProtector, UnresolvePrivilegeFilter.class, UnresolveTermEntity.class);
            app.post("/vertex/unresolve-all-terms", authenticator, csrfProtector, UnresolvePrivilegeFilter.class, VertexUnresolveTermMentions.class);
            app.post("/vertex/resolve-detected-object", authenticator, csrfProtector, EditPrivilegeFilter.class, ResolveDetectedObject.class);
            app.post("/vertex/unresolve-detected-object", authenticator, csrfProtector, UnresolvePrivilegeFilter.class, UnresolveDetectedObject.class);
            app.get("/vertex/detected-objects", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexGetDetectedObjects.class);
            app.get("/vertex/property", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexGetPropertyValue.class);
            app.get("/vertex/property/history", authenticator, csrfProtector, HistoryReadPrivilegeFilter.class, VertexGetPropertyHistory.class);
            app.post("/vertex/property", authenticator, csrfProtector, EditPrivilegeFilter.class, VertexSetProperty.class);
            app.post("/vertex/property/visibility", authenticator, csrfProtector, EditPrivilegeFilter.class, VertexSetPropertyVisibility.class);
            app.post("/vertex/comment", authenticator, csrfProtector, CommentPrivilegeFilter.class, VertexSetProperty.class);
            app.delete("/vertex/property", authenticator, csrfProtector, EditPrivilegeFilter.class, VertexDeleteProperty.class);
            app.delete("/vertex/comment", authenticator, csrfProtector, CommentPrivilegeFilter.class, VertexDeleteProperty.class);
            app.get("/vertex/term-mentions", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexGetTermMentions.class);
            app.get("/vertex/resolved-to", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexGetResolvedTo.class);
            app.post("/vertex/visibility", authenticator, csrfProtector, EditPrivilegeFilter.class, VertexSetVisibility.class);
            app.get("/vertex/properties", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexProperties.class);
            app.get("/vertex/edges", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexEdges.class);
            app.post("/vertex/multiple", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexMultiple.class); // this is a post method to allow large data (ie data larger than would fit in the URL)
            app.post("/vertex/new", authenticator, csrfProtector, EditPrivilegeFilter.class, VertexNew.class);
            app.post("/vertex/new-public", VertexNewPublic.class);

            app.get("/vertex/search", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexSearch.class);
            app.post("/vertex/search", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexSearch.class);
            app.post("/vertex/search-public", VertexSearchPublic.class);
            app.get("/vertex/geo-search", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexGeoSearch.class);
            app.post("/vertex/upload-image", authenticator, csrfProtector, EditPrivilegeFilter.class, VertexUploadImage.class);
            app.get("/vertex/find-path", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexFindPath.class);
            app.post("/vertex/find-related", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexFindRelated.class);
            app.get("/vertex/counts-by-concept-type", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexGetCountsByConceptType.class);
            app.get("/vertex/count", authenticator, csrfProtector, ReadPrivilegeFilter.class, VertexGetCount.class);
            app.get("/vertex/requeue", authenticator, csrfProtector, EditPrivilegeFilter.class, VertexRequeue.class);
            app.get("/vertex/requeue-many", authenticator, csrfProtector, EditPrivilegeFilter.class, MultiVertexRequeue.class);

            app.post("/edge/property", authenticator, csrfProtector, EditPrivilegeFilter.class, EdgeSetProperty.class);
            app.post("/edge/property/visibility", authenticator, csrfProtector, EditPrivilegeFilter.class, EdgeSetPropertyVisibility.class);
            app.post("/edge/comment", authenticator, csrfProtector, CommentPrivilegeFilter.class, EdgeSetProperty.class);
            app.delete("/edge", authenticator, csrfProtector, EditPrivilegeFilter.class, EdgeDelete.class);
            app.delete("/edge/property", authenticator, csrfProtector, EditPrivilegeFilter.class, EdgeDeleteProperty.class);
            app.delete("/edge/comment", authenticator, csrfProtector, CommentPrivilegeFilter.class, EdgeDeleteProperty.class);
            app.get("/edge/history", authenticator, csrfProtector, HistoryReadPrivilegeFilter.class, EdgeGetHistory.class);
            app.get("/edge/property/history", authenticator, csrfProtector, HistoryReadPrivilegeFilter.class, EdgeGetPropertyHistory.class);
            app.get("/edge/exists", authenticator, csrfProtector, ReadPrivilegeFilter.class, EdgeExists.class);
            app.post("/edge/exists", authenticator, csrfProtector, ReadPrivilegeFilter.class, EdgeExists.class);
            app.post("/edge/multiple", authenticator, csrfProtector, ReadPrivilegeFilter.class, EdgeMultiple.class);
            app.post("/edge/create", authenticator, csrfProtector, EditPrivilegeFilter.class, EdgeCreate.class);
            app.get("/edge/properties", authenticator, csrfProtector, ReadPrivilegeFilter.class, EdgeProperties.class);
            app.post("/edge/visibility", authenticator, csrfProtector, EditPrivilegeFilter.class, EdgeSetVisibility.class);
            app.get("/edge/property/details", authenticator, csrfProtector, ReadPrivilegeFilter.class, EdgePropertyDetails.class);
            app.get("/edge/details", authenticator, csrfProtector, ReadPrivilegeFilter.class, EdgeDetails.class);
            app.get("/edge/count", authenticator, csrfProtector, ReadPrivilegeFilter.class, EdgeGetCount.class);
            app.get("/edge/search", authenticator, csrfProtector, ReadPrivilegeFilter.class, EdgeSearch.class);
            app.post("/edge/search", authenticator, csrfProtector, ReadPrivilegeFilter.class, EdgeSearch.class);
            app.get("/edge/requeue", authenticator, csrfProtector, EditPrivilegeFilter.class, EdgeRequeue.class);

            app.get("/extended-data", authenticator, csrfProtector, ReadPrivilegeFilter.class, ExtendedDataGet.class);
            app.get("/extended-data/search", authenticator, csrfProtector, ReadPrivilegeFilter.class, ExtendedDataSearch.class);
            app.post("/extended-data/search", authenticator, csrfProtector, ReadPrivilegeFilter.class, ExtendedDataSearch.class);

            app.get("/workspace/all", authenticator, csrfProtector, ReadPrivilegeFilter.class, WorkspaceList.class);
            app.post("/workspace/create", authenticator, csrfProtector, ReadPrivilegeFilter.class, WorkspaceCreate.class);
            app.get("/workspace/diff", authenticator, csrfProtector, ReadPrivilegeFilter.class, WorkspaceDiff.class);
            app.post("/workspace/update", authenticator, csrfProtector, ReadPrivilegeFilter.class, WorkspaceUpdate.class);
            app.get("/workspace", authenticator, csrfProtector, ReadPrivilegeFilter.class, WorkspaceById.class);
            app.delete("/workspace", authenticator, csrfProtector, ReadPrivilegeFilter.class, WorkspaceDelete.class);
            app.post("/workspace/publish", authenticator, csrfProtector, PublishPrivilegeFilter.class, WorkspacePublish.class);
            app.post("/workspace/undo", authenticator, csrfProtector, EditPrivilegeFilter.class, WorkspaceUndo.class);

            app.get("/dashboard/all", authenticator, csrfProtector, ReadPrivilegeFilter.class, DashboardAll.class);
            app.post("/dashboard", authenticator, csrfProtector, ReadPrivilegeFilter.class, DashboardUpdate.class);
            app.delete("/dashboard", authenticator, csrfProtector, ReadPrivilegeFilter.class, DashboardDelete.class);
            app.post("/dashboard/item", authenticator, csrfProtector, ReadPrivilegeFilter.class, DashboardItemUpdate.class);
            app.delete("/dashboard/item", authenticator, csrfProtector, ReadPrivilegeFilter.class, DashboardItemDelete.class);

            app.get("/product/all", authenticator, csrfProtector, ReadPrivilegeFilter.class, ProductAll.class);
            app.get("/product", authenticator, csrfProtector, ReadPrivilegeFilter.class, ProductGet.class);
            app.get("/product/preview", authenticator, csrfProtector, ReadPrivilegeFilter.class, ProductPreview.class);
            app.post("/product", authenticator, csrfProtector, EditPrivilegeFilter.class, ProductUpdate.class);
            app.delete("/product", authenticator, csrfProtector, EditPrivilegeFilter.class, ProductDelete.class);
            app.post("/product/import", authenticator, csrfProtector, EditPrivilegeFilter.class, ProductImport.class);
            app.post("/product/dataset", authenticator, csrfProtector, EditPrivilegeFilter.class, ProductAddDataset.class);

            app.get("/user/me", authenticator, csrfProtector, MeGet.class);
            app.get("/user/heartbeat", authenticator, csrfProtector, Heartbeat.class);
            app.post("/user/ui-preferences", authenticator, csrfProtector, UserSetUiPreferences.class);
            app.get("/user/all", authenticator, csrfProtector, UserList.class);
            app.post("/user/all", authenticator, csrfProtector, UserList.class);
            app.get("/user/table", authenticator, csrfProtector, AdminPrivilegeFilter.class, UserTable.class);
            app.post("/user/delete1", authenticator, csrfProtector, AdminPrivilegeFilter.class, UserDelete.class);
            app.get("/user", authenticator, csrfProtector, AdminPrivilegeFilter.class, UserGet.class);
            app.get("/user/id", authenticator, csrfProtector, AdminPrivilegeFilter.class, UserGetById.class);
            app.post("/user/addOrEdit", authenticator, csrfProtector, AdminPrivilegeFilter.class, UserAddOrEdit.class);
            app.post("/user/changeProfile", authenticator, csrfProtector, ReadPrivilegeFilter.class, ChangeProfile.class);

            app.get("/role/table", authenticator, csrfProtector, AdminPrivilegeFilter.class, RoleTable.class);
            app.get("/role/all", authenticator, csrfProtector, AdminPrivilegeFilter.class, RoleAll.class);
            app.post("/role/delete", authenticator, csrfProtector, AdminPrivilegeFilter.class, RoleDelete.class);
            app.get("/role/id", authenticator, csrfProtector, AdminPrivilegeFilter.class, RoleGetById.class);
            app.post("/role/addOrEdit", authenticator, csrfProtector, AdminPrivilegeFilter.class, RoleAddOrEdit.class);

            app.get("/regex/table", authenticator, csrfProtector, AdminPrivilegeFilter.class, RegexTable.class);
            app.get("/regex/all", authenticator, csrfProtector, AdminPrivilegeFilter.class, RegexAll.class);
            app.post("/regex/addOrEdit", authenticator, csrfProtector, AdminPrivilegeFilter.class, RegexAddOrEdit.class);
            app.get("/regex/id", authenticator, csrfProtector, AdminPrivilegeFilter.class, RegexGetById.class);
            app.post("/regex/delete", authenticator, csrfProtector, AdminPrivilegeFilter.class, RegexDelete.class);

            app.get("/long-running-process", authenticator, csrfProtector, LongRunningProcessById.class);
            app.delete("/long-running-process", authenticator, csrfProtector, LongRunningProcessDelete.class);
            app.post("/long-running-process/cancel", authenticator, csrfProtector, LongRunningProcessCancel.class);

            app.get("/admin/all", authenticator, csrfProtector, AdminPrivilegeFilter.class, AdminList.class);
            app.get("/admin/plugins", authenticator, csrfProtector, AdminPrivilegeFilter.class, PluginList.class);
            app.post("/admin/ontologyPropertySave", authenticator, csrfProtector, AdminPrivilegeFilter.class, OntologyManagerPropertySave.class);
            app.post("/admin/ontologyPropertyDelete", authenticator, csrfProtector, AdminPrivilegeFilter.class, OntologyManagerPropertyDelete.class);
            app.post("/admin/ontologyProperyAddExisting", authenticator, csrfProtector, AdminPrivilegeFilter.class, OntologyManagerPropertyAddExisting.class);
            app.post("/admin/ontologyProperyRemoveExisting", authenticator, csrfProtector, AdminPrivilegeFilter.class, OntologyManagerPropertyRemoveExisting.class);
            app.post("/admin/ontologyConceptSave", authenticator, csrfProtector, AdminPrivilegeFilter.class, OntologyManagerConceptSave.class);
            app.post("/admin/ontologyConceptDelete", authenticator, csrfProtector, AdminPrivilegeFilter.class, OntologyManagerConceptDelete.class);
            app.post("/admin/ontologyRelSave", authenticator, csrfProtector, AdminPrivilegeFilter.class, OntologyManagerRelSave.class);
            app.post("/admin/ontologyRelDelete", authenticator, csrfProtector, AdminPrivilegeFilter.class, OntologyManagerRelDelete.class);
            app.delete("/admin/deleteElements", authenticator, csrfProtector, AdminPrivilegeFilter.class, DeleteElements.class);
            app.post("/admin/restoreElements", authenticator, csrfProtector, AdminPrivilegeFilter.class, RestoreElements.class);

            app.get("/ping", RateLimitFilter.class, Ping.class);
            app.get("/ping/stats", authenticator, AdminPrivilegeFilter.class, PingStats.class);

            app.get("/structured-ingest/mimeTypes", authenticator, csrfProtector, ReadPrivilegeFilter.class, MimeTypes.class);
            app.get("/structured-ingest/analyze", authenticator, csrfProtector, ReadPrivilegeFilter.class, Analyze.class);
            app.post("/structured-ingest/analyzeFile", authenticator, csrfProtector, ReadPrivilegeFilter.class, AnalyzeFile.class);
            app.post("/structured-ingest/ingest", authenticator, csrfProtector, ReadPrivilegeFilter.class, Ingest.class);

            app.get("/dataload/dcTable", authenticator, csrfProtector, AdminPrivilegeFilter.class, DataConnectionTable.class);
            app.post("/dataload/addOrEdit", authenticator, csrfProtector, AdminPrivilegeFilter.class, DataConnectionAddOrEdit.class);
            app.get("/dataload/id", authenticator, csrfProtector, AdminPrivilegeFilter.class, DataConnectionGetById.class);
            app.get("/dataload/preview", authenticator, csrfProtector, AdminPrivilegeFilter.class, DataSourcePreview.class);
            app.get("/dataload/delete", authenticator, csrfProtector, AdminPrivilegeFilter.class, DataConnectionDelete.class);
            app.post("/dataload/saveds", authenticator, csrfProtector, AdminPrivilegeFilter.class, DataSourceSave.class);
            app.post("/dataload/import", authenticator, csrfProtector, AdminPrivilegeFilter.class, DataSourceImport.class);

            app.post("/watch/create", authenticator, csrfProtector, CreateWatch.class);
            app.get("/watch/list", authenticator, csrfProtector, ListWatches.class);
            app.post("/watch/delete", authenticator, csrfProtector, DeleteWatch.class);

            app.get("/behaviour/all", authenticator, csrfProtector, AdminPrivilegeFilter.class, BehaviourAll.class);
            app.post("/behaviour/addOrEdit", authenticator, csrfProtector, AdminPrivilegeFilter.class, BehaviourAddOrEdit.class);
            app.get("/behaviour/id", authenticator, csrfProtector, AdminPrivilegeFilter.class, BehaviourGetById.class);
            app.get("/behaviour/delete", authenticator, csrfProtector, AdminPrivilegeFilter.class, BehaviourDelete.class);
            app.get("/behaviour/run", authenticator, csrfProtector, AdminPrivilegeFilter.class, BehaviourRun.class);

            app.post("/csp-report", ContentSecurityPolicyReport.class);

            app.get("/cypherlab/{(.*)}", new CLStaticHttpHandler(getClass().getClassLoader(), "/"));


            List<WebAppPlugin> webAppPlugins = toList(ServiceLoaderUtil.load(WebAppPlugin.class, configuration));
            for (WebAppPlugin webAppPlugin : webAppPlugins) {
                LOGGER.info("Loading webapp plugin: %s", webAppPlugin.getClass().getName());
                try {
                    webAppPlugin.init(app, servletContext, authenticatorInstance);
                } catch (Exception e) {
                    throw new BcException("Could not initialize webapp plugin: " + webAppPlugin.getClass().getName(), e);
                }
            }

            app.get(
                    "/css/images/ui-icons_222222_256x240.png",
                    new StaticResourceHandler(
                            this.getClass(),
                            "/com/mware/web/routes/resource/ui-icons_222222_256x240.png",
                            "image/png"
                    )
            );

            app.onException(BcAccessDeniedException.class, new ErrorCodeHandler(HttpServletResponse.SC_FORBIDDEN));
            app.onException(BcException.class, new ApplicationErrorHandler());
        } catch (Exception ex) {
            LOGGER.error("Failed to initialize Router", ex);
            throw new RuntimeException("Failed to initialize " + getClass().getName(), ex);
        }
    }

    @Override
    protected void service(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        LOGGER.debug("servicing %s", request.getRequestURI());
        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");

        try {
            for (WebEventListener webEventListener : getWebEventListeners()) {
                webEventListener.before(app, request, response);
            }

            response.addHeader("Accept-Ranges", "bytes");
            app.handle(request, response);

            for (WebEventListener webEventListener : getWebEventListenersReverse()) {
                webEventListener.after(app, request, response);
            }
        } catch (ConnectionClosedException cce) {
            LOGGER.debug("Connection closed by client", cce);
            for (WebEventListener webEventListener : getWebEventListenersReverse()) {
                webEventListener.error(app, request, response, cce);
            }
            cce.printStackTrace();
        } catch (Throwable e) {
            for (WebEventListener webEventListener : getWebEventListenersReverse()) {
                webEventListener.error(app, request, response, e);
            }
            e.printStackTrace();
        } finally {
            for (WebEventListener webEventListener : getWebEventListenersReverse()) {
                webEventListener.always(app, request, response);
            }
        }
    }

    private List<WebEventListener> getWebEventListeners() {
        if (webEventListeners == null) {
            webEventListeners = InjectHelper.getInjectedServices(WebEventListener.class, configuration).stream()
                    .sorted(Comparator.comparingInt(WebEventListener::getPriority))
                    .collect(Collectors.toList());
        }
        return webEventListeners;
    }

    private List<WebEventListener> getWebEventListenersReverse() {
        if (webEventListenersReverse == null) {
            webEventListenersReverse = Lists.reverse(getWebEventListeners());
        }
        return webEventListenersReverse;
    }

    @Inject
    public void setConfiguration(Configuration configuration) {
        this.configuration = configuration;
    }

    @Inject
    public void setGeocoderRepository(GeocoderRepository geocoderRepository) {
        this.geocoderRepository = geocoderRepository;
    }

    public WebApp getApp() {
        return app;
    }
}
