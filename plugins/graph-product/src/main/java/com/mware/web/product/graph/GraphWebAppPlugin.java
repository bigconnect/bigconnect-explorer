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
package com.mware.web.product.graph;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.Description;
import com.mware.core.model.Name;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.web.BcCsrfHandler;
import com.mware.web.WebApp;
import com.mware.web.WebAppPlugin;
import com.mware.web.framework.Handler;
import com.mware.web.privilegeFilters.EditPrivilegeFilter;
import com.mware.web.product.graph.routes.CollapseVertices;
import com.mware.web.product.graph.routes.NodeSetTitle;
import com.mware.web.product.graph.routes.RemoveVertices;
import com.mware.web.product.graph.routes.UpdateVertices;


import javax.servlet.ServletContext;

@Name("Product: Graph")
@Description("Graph visualization")
@Singleton
public class GraphWebAppPlugin implements WebAppPlugin {
    private final SchemaRepository schemaRepository;
    private final UserRepository userRepository;
    private final AuthorizationRepository authorizationRepository;

    @Inject
    public GraphWebAppPlugin(
            SchemaRepository schemaRepository,
            UserRepository userRepository,
            AuthorizationRepository authorizationRepository
    ) {
        this.schemaRepository = schemaRepository;
        this.userRepository = userRepository;
        this.authorizationRepository = authorizationRepository;
    }

    @Override
    public void init(WebApp app, ServletContext servletContext, Handler authenticationHandler) {
        Class<? extends Handler> authenticationHandlerClass = authenticationHandler.getClass();
        Class<? extends Handler> csrfHandlerClass = BcCsrfHandler.class;

        app.post("/product/graph/vertices/collapse", authenticationHandlerClass, csrfHandlerClass, EditPrivilegeFilter.class, CollapseVertices.class);
        app.post("/product/graph/vertices/remove", authenticationHandlerClass, csrfHandlerClass, EditPrivilegeFilter.class, RemoveVertices.class);
        app.post("/product/graph/vertices/update", authenticationHandlerClass, csrfHandlerClass, EditPrivilegeFilter.class, UpdateVertices.class);
        app.post("/product/graph/node/rename", authenticationHandlerClass, csrfHandlerClass, EditPrivilegeFilter.class, NodeSetTitle.class);

        app.registerJavaScript("/com/mware/web/product/graph/plugin.js");

        app.registerCompiledJavaScript("/com/mware/web/product/graph/dist/Graph.js");
        app.registerCompiledJavaScript("/com/mware/web/product/graph/dist/EdgeLabel.js");
        app.registerCompiledJavaScript("/com/mware/web/product/graph/dist/SnapToGrid.js");
        app.registerCompiledJavaScript("/com/mware/web/product/graph/dist/NodeLabel.js");
        app.registerCompiledJavaScript("/com/mware/web/product/graph/dist/ExportGraph.js");
        app.registerCompiledJavaScript("/com/mware/web/product/graph/dist/NodeImage.js");
        app.registerCompiledJavaScript("/com/mware/web/product/graph/dist/FindPathPopoverContainer.js");
        app.registerCompiledJavaScript("/com/mware/web/product/graph/dist/CollapsedNodePopoverConfig.js");
        app.registerCompiledJavaScript("/com/mware/web/product/graph/dist/actions-impl.js");

        app.registerCompiledWebWorkerJavaScript("/com/mware/web/product/graph/dist/plugin-worker.js");
        app.registerCompiledWebWorkerJavaScript("/com/mware/web/product/graph/dist/store-changes.js");

        app.registerJavaScript("/com/mware/web/product/graph/popovers/collapsedNode/collapsedNodePopoverShim.js", false);
        app.registerJavaScript("/com/mware/web/product/graph/popovers/withVertexPopover.js", false);
        app.registerJavaScriptTemplate("/com/mware/web/product/graph/popovers/collapsedNode/collapsedNodePopoverTpl.hbs");

        app.registerLess("/com/mware/web/product/graph/css.less");
        app.registerResourceBundle("/com/mware/web/product/graph/messages.properties");
        app.registerFile("/com/mware/web/product/graph/select-arrow.png", "image/png");
    }
}
