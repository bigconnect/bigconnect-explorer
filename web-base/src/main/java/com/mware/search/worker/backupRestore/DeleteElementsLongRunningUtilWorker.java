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
package com.mware.search.worker.backupRestore;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.model.Description;
import com.mware.core.model.Name;
import com.mware.core.model.longRunningProcess.LongRunningProcessRepository;
import com.mware.core.model.longRunningProcess.LongRunningProcessWorker;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.ClientApiConverter;
import com.mware.ge.*;
import com.mware.ge.tools.GraphBackup;
import com.mware.search.SearchHelper;
import com.mware.search.SearchRepository;
import com.mware.web.model.ClientApiSearch;
import org.json.JSONObject;

import java.io.OutputStream;
import java.util.List;

import static com.mware.search.worker.backupRestore.DeleteRestoreElementsLRPQueueItem.SEARCH_DELETE_ELEMENTS_TYPE;
import static com.mware.search.worker.backupRestore.DeleteRestoreUtil.getBackupFileName;

@Name("Delete Elements")
@Description("Delete elements based on a saved search")
@Singleton
public class DeleteElementsLongRunningUtilWorker extends LongRunningProcessWorker {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(DeleteElementsLongRunningUtilWorker.class);

    protected final AuthorizationRepository authorizationRepository;
    protected final LongRunningProcessRepository longRunningProcessRepository;
    protected final SearchRepository searchRepository;
    protected final UserRepository userRepository;
    protected final GraphBaseWithSearchIndex graph;
    protected final SearchHelper searchHelper;

    @Inject
    public DeleteElementsLongRunningUtilWorker(
            AuthorizationRepository authorizationRepository,
            LongRunningProcessRepository longRunningProcessRepository,
            SearchRepository searchRepository,
            UserRepository userRepository,
            Graph graph,
            SearchHelper searchHelper
    ) {
        this.authorizationRepository = authorizationRepository;
        this.longRunningProcessRepository = longRunningProcessRepository;
        this.searchRepository = searchRepository;
        this.userRepository = userRepository;
        this.graph = (GraphBaseWithSearchIndex) graph;
        this.searchHelper = searchHelper;
    }

    @Override
    public boolean isHandled(JSONObject longRunningProcessQueueItem) {
        return longRunningProcessQueueItem.getString("type").equals(SEARCH_DELETE_ELEMENTS_TYPE);
    }

    @Override
    public void processInternal(final JSONObject config) {
        DeleteRestoreElementsLRPQueueItem deleteElements = ClientApiConverter
                .toClientApi(config.toString(), DeleteRestoreElementsLRPQueueItem.class);
        User user = userRepository.findById(deleteElements.getUserId());
        if (user == null) {
            LOGGER.error(String.format("User with id %s not found.", deleteElements.getUserId()));
            return;
        }
        ClientApiSearch savedSearch = searchRepository.getSavedSearch(deleteElements.getSavedSearchId(), user);
        if (savedSearch == null) {
            LOGGER.error(String.format("Saved search with id %s and name %s not found.",
                        deleteElements.getSavedSearchId(), deleteElements.getSavedSearchName()));
            return;
        }
        LOGGER.info("Start long running delete elements for user: %s, search: %s, uri: %s",
                user.getDisplayName(), savedSearch.id, savedSearch.url);

        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(user);
        LOGGER.debug("Found authorizations: %s", authorizations);

        List<Element> results = searchHelper.search(savedSearch, user, authorizations, true);
        LOGGER.info("Found %s elements to delete.", results.size());

        double progress = 0;
        if (results.size() > 0) {
            progress += 0.3;
            longRunningProcessRepository.reportProgress(config, progress, String.format("Finished running search, found %d items.", results.size()));
        } else {
            LOGGER.error("Saved search returned no items.");
            throw new BcException("Saved search returned no items.");
        }

        String backupFile = "N/A";
        if (deleteElements.isBackup()) {
            backupFile = backupGraphElements(savedSearch, results);
            progress += 0.5;
            longRunningProcessRepository.reportProgress(config, progress, String.format("Finished running backup, to %s file.", backupFile));
        }

        deleteResults(results, authorizations, config, progress);

        config.put("backupFile", backupFile);
        config.put("resultsCount", results.size());
        longRunningProcessRepository.reportProgress(config, 1.0,
                String.format("Finished running delete for %d items.", results.size()));
    }

    protected String backupGraphElements(ClientApiSearch savedSearch, List<Element> elements) {
        String backupFile = getBackupFileName(savedSearch.name);
        GraphBackup backup = this.graph.getBackupTool(backupFile);
        String absolutePath = backup.getAbsoluteFilePath(backupFile);
        LOGGER.info("Backing up to file: %s, using %s tool", absolutePath, backup.getClass().getName());
        try (OutputStream out = backup.createOutputStream()) {
            for (Element e : elements) {
                if (e instanceof Vertex) {
                    backup.saveVertex((Vertex) e, out);
                } else {
                    backup.saveEdge((Edge) e, out);
                }
            }
            return absolutePath;
        } catch (Exception e) {
            LOGGER.error(String.format("Backup failed for file %s", backupFile), e);
            throw new BcException(e.getMessage());
        }
    }

    private void deleteResults(List<Element> results, Authorizations authorizations, JSONObject config, double progress) {
        double progressUnit = (double)(1 - progress) / results.size();
        int index = 0;
        for (Element e : results) {
            try {
                graph.deleteElement(ElementId.create(e.getElementType(), e.getId()), authorizations);
                progress += progressUnit;
                longRunningProcessRepository.reportProgress(config, progress,
                        String.format("Deleted %d items.", ++index));
            } catch (Exception ex) {
                LOGGER.error(ex.getMessage(), ex);
                throw new BcException(ex.getMessage());
            }
        }
    }
}
