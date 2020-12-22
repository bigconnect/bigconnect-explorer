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
package com.mware.web.product.chart;

import com.google.inject.Singleton;
import com.mware.core.model.Description;
import com.mware.core.model.Name;
import com.mware.web.BcCsrfHandler;
import com.mware.web.WebApp;
import com.mware.web.WebAppPlugin;
import com.mware.web.framework.Handler;
import com.mware.web.product.chart.routes.*;

import javax.servlet.ServletContext;

@Name("Product: Charts")
@Description("Charting capability")
@Singleton
public class ChartWebAppPlugin implements WebAppPlugin {
    public ChartWebAppPlugin() {
    }

    @Override
    public void init(WebApp app, ServletContext servletContext, Handler authenticationHandler) {
        Class<? extends Handler> authenticationHandlerClass = authenticationHandler.getClass();
        Class<? extends Handler> csrfHandlerClass = BcCsrfHandler.class;

        app.get("/chart/list", authenticationHandlerClass, csrfHandlerClass, ChartList.class);
        app.post("/chart", authenticationHandlerClass, csrfHandlerClass, ChartSave.class);
        app.get("/chart", authenticationHandlerClass, csrfHandlerClass, ChartGet.class);
        app.delete("/chart", authenticationHandlerClass, csrfHandlerClass, ChartDelete.class);
        app.post("/chart/update", authenticationHandlerClass, csrfHandlerClass, ChartUpdate.class);

        app.registerJavaScript("/com/mware/web/product/chart/plugin.js");

        app.registerCompiledJavaScript("/com/mware/web/product/chart/dist/Chart.js");
        app.registerCompiledJavaScript("/com/mware/web/product/chart/dist/DatasetChooser.js");
        app.registerCompiledJavaScript("/com/mware/web/product/chart/dist/ChartList.js");
        app.registerCompiledJavaScript("/com/mware/web/product/chart/dist/actions-impl.js");
        app.registerCompiledJavaScript("/com/mware/web/product/chart/dist/ChartDashboardItem.js");
        app.registerCompiledJavaScript("/com/mware/web/product/chart/dist/ChartDashboardItemConfig.js");

        app.registerCompiledWebWorkerJavaScript("/com/mware/web/product/chart/dist/plugin-worker.js");
        app.registerWebWorkerJavaScript("/com/mware/web/product/chart/worker/service.js");

        app.registerResourceBundle("/com/mware/web/product/chart/messages.properties");

        app.registerLess("/com/mware/web/product/chart/style.less");
    }
}
