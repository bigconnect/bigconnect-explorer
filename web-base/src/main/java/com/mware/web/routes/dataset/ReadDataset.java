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
package com.mware.web.routes.dataset;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.cache.CacheService;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.*;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.RawObjectSchema;
import com.mware.core.model.role.AuthorizationRepository;
import com.mware.core.model.search.*;
import com.mware.core.model.user.UserRepository;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.Authorizations;
import com.mware.ge.type.GeoPoint;
import com.mware.ge.util.IterableUtils;
import com.mware.search.*;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.*;
import com.mware.web.routes.dataset.ReadDataset.ClientApiReadDatasetResponse.DatasetRow;
import com.mware.web.routes.search.SearchList;
import com.mware.web.routes.vertex.GeObjectSearchBase;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.joda.time.DateTime;

import java.io.BufferedWriter;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Singleton
public class ReadDataset implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(ReadDataset.class);
    private final SearchRepository searchRepository;
    private final UserRepository userRepository;
    private final AuthorizationRepository authorizationRepository;
    private final CacheService cacheService;

    @Inject
    public ReadDataset(
            SearchRepository searchRepository,
            UserRepository userRepository,
            AuthorizationRepository authorizationRepository,
            CacheService cacheService
    ) {
        this.searchRepository = searchRepository;
        this.userRepository = userRepository;
        this.authorizationRepository = authorizationRepository;
        this.cacheService = cacheService;
    }

    @Handle
    public ClientApiReadDatasetResponse handle(
            @Required(name = "name") String datasetName,
            @Optional(name = "offset") Integer offset,
            @Optional(name = "size") Integer size,
            @Optional(name = "scope") ClientApiSearch.Scope scope,
            @Optional(name = "as") ResponseType responseType,
            User user
    ) throws Exception {
        ClientApiSearchListResponse userSearches = new SearchList(searchRepository, cacheService).handle(user);
        java.util.Optional<ClientApiSearch> search = userSearches.searches.stream()
                .filter(s -> scope == null || s.scope.equals(scope))
                .filter(s -> s.name.equals(datasetName)).findFirst();

        if (!search.isPresent()) {
            throw new BcException(String.format("Could not find a saved search with name: %s", datasetName));
        }
        ClientApiUser userMe = userRepository.toClientApiPrivate(user);
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(user, userMe.getCurrentWorkspaceId());

        SearchRunner searchRunner = searchRepository.findSearchRunnerByUri(search.get().url);
        SearchResults results = searchRunner.run(
                getSearchOptions(search.get(), userMe.getCurrentWorkspaceId(), offset, size),
                user,
                authorizations
        );

        ClientApiReadDatasetResponse response;
        if (results instanceof ClientApiElementSearchResponse) {
            response = geObjectsToDataset((ClientApiElementSearchResponse) results);
        } else if (results instanceof ClientApiTabularSearchResponse) {
            response = rowsToDataset((ClientApiTabularSearchResponse) results);
        } else if (results instanceof QueryResultsIterableSearchResults) {
            QueryResultsIterableSearchResults searchResults = (QueryResultsIterableSearchResults) results;
            List<ClientApiGeObject> geObjects = GeObjectSearchBase.convertElementsToClientApi(
                    searchResults.getQueryResultsIterable(),
                    userMe.getCurrentWorkspaceId(),
                    authorizations
            );
            ClientApiElementSearchResponse r = new ClientApiElementSearchResponse();
            r.getElements().addAll(geObjects);
            response = geObjectsToDataset(r);
            searchResults.getQueryResultsIterable().close();
            searchResults.close();
        } else {
            throw new IllegalArgumentException("Unsupported search type: " + results.getClass().getName());
        }

        response.name = datasetName;

        if (ResponseType.Csv.equals(responseType)) {
            String savedSearchesDir = System.getenv("BIGCONNECT_DIR") + System.getProperty("file.separator") + "savedsearches";
            new File(savedSearchesDir).mkdirs();
            String fileToHoldTheSavedSearch = savedSearchesDir + System.getProperty("file.separator") + datasetName;
            new File(fileToHoldTheSavedSearch).createNewFile();

            try (BufferedWriter writer = Files.newBufferedWriter(Paths.get(fileToHoldTheSavedSearch));
                 CSVPrinter csvPrinter = new CSVPrinter(writer, CSVFormat.DEFAULT.withHeader(response.columns.toArray(new String[0])))
            ) {
                for (DatasetRow row : response.rows) {
                    csvPrinter.printRecord(row.elementData);
                }

                csvPrinter.flush();
            }

            return new CsvClientApiReadDatasetResponse(response.name, response.id, fileToHoldTheSavedSearch);
        }

        return response;
    }

    private ClientApiReadDatasetResponse rowsToDataset(ClientApiTabularSearchResponse results) {
        ClientApiReadDatasetResponse response = new ClientApiReadDatasetResponse();
        response.columns.addAll(results.getColumns());
        response.columns.forEach(c -> response.columnTypes.add(results.getColumnTypes().get(c)));
        results.getRows().forEach(row -> {
            DatasetRow dsRow = new DatasetRow();
            response.columns.forEach(column -> {
                dsRow.set(dsRow.size(), row.get(column));
            });
            response.rows.add(dsRow);
        });
        return response;
    }

    private ClientApiReadDatasetResponse geObjectsToDataset(ClientApiElementSearchResponse results) {
        ClientApiReadDatasetResponse response = new ClientApiReadDatasetResponse();
        List<String> columns = new ArrayList<>();
        columns.add("_id_");
        List<String> columnTypes = new ArrayList<>();
        columnTypes.add(String.class.getName());

        AtomicInteger maxRowSize = new AtomicInteger(1);

        // build column lst
        results.getElements().forEach(geObject -> {
            ClientApiElement element = (ClientApiElement) geObject;
            DatasetRow row = new DatasetRow();

            // first one is _id_
            row.set(0, element.getId());

            element.getProperties()
                    .parallelStream()
                    .collect(Collectors.groupingBy(ClientApiProperty::getName))
                    .keySet()
                    .forEach(propName -> {
                        if (!skipColumn(propName)) {
                            if (RawObjectSchema.GEOLOCATION_PROPERTY.getPropertyName().equals(propName)) {
                                int c1Index = addColumnToList(columns, propName + "_lon");
                                int c2Index = addColumnToList(columns, propName + "_lat");

                                ClientApiProperty property = IterableUtils.anyOrDefault(element.getProperties(propName), null);
                                if (property != null && property.getValue() != null && property.getValue() instanceof GeoPoint) {
                                    GeoPoint value = (GeoPoint) property.getValue();
                                    row.set(c1Index, value.getLongitude());
                                    row.set(c2Index, value.getLatitude());
                                    addColumnType(columnTypes, c1Index, Double.class.getName());
                                    addColumnType(columnTypes, c2Index, Double.class.getName());
                                } else {
                                    if (property != null && property.getValue() != null && !(property.getValue() instanceof GeoPoint)) {
                                        LOGGER.warn("Property %s of type GeoLocation has unknown value type: %s", propName, property.getValue().getClass().getName());
                                    }
                                    row.set(c1Index, null);
                                    row.set(c2Index, null);
                                    addColumnType(columnTypes, c1Index, Object.class.getName());
                                    addColumnType(columnTypes, c2Index, Object.class.getName());
                                }
                            } else {
                                int cIndex = addColumnToList(columns, propName);
                                Iterable<ClientApiProperty> properties = element.getProperties(propName);
                                boolean hasProp = false;
                                if (properties != null) {
                                    ClientApiProperty property = null;
                                    Iterator<ClientApiProperty> iterator = properties.iterator();
                                    while (iterator.hasNext()) {
                                        property = iterator.next();
                                        hasProp = true;
                                        Object converted = convertValue(property.getValue());

                                        if (row.size() > cIndex) {
                                            if (row.get(cIndex) != null) {
                                                final String existing = row.get(cIndex).toString();
                                                row.set(cIndex, existing + ";" + converted.toString());
                                            } else
                                                row.set(cIndex, converted);
                                        } else {
                                            row.set(cIndex, converted);
                                        }

                                        if (converted != null) {
                                            addColumnType(columnTypes, cIndex, converted.getClass().getName());
                                        } else {
                                            addColumnType(columnTypes, cIndex, String.class.getName());
                                        }
                                    }
                                }

                                if (!hasProp) {
                                    row.set(cIndex, null);
                                    addColumnType(columnTypes, cIndex, Object.class.getName());
                                }
                            }
                        }
                    });

            if (maxRowSize.get() < row.size())
                maxRowSize.set(row.size());

            response.rows.add(row);
        });

        response.rows.parallelStream().forEach(row -> row.ensureCapacity(maxRowSize.get()));
        response.columns.addAll(columns);
        response.columnTypes.addAll(columnTypes);

        return response;
    }

    private Object convertValue(Object value) {
        if (value == null)
            return null;

        // transform dates to epoch seconds
        if (value instanceof java.util.Date) {
            return ((java.util.Date) value).toInstant().getEpochSecond();
        } else if (value instanceof ZonedDateTime) {
            return ((ZonedDateTime) value).toInstant().getEpochSecond();
        } else if (value instanceof DateTime) {
            return ((DateTime) value).toDate().toInstant().getEpochSecond();
        }

        return value;
    }

    private boolean skipColumn(String name) {
        if (BcSchema.VISIBILITY_JSON.getPropertyName().equals(name)
                || BcSchema.MODIFIED_BY.getPropertyName().equals(name)
                || BcSchema.MODIFIED_DATE.getPropertyName().equals(name)
                || RawObjectSchema.CONTENT_HASH.getPropertyName().equals(name)
                || BcSchema.MIME_TYPE.getPropertyName().equals(name)
                || BcSchema.FILE_NAME.getPropertyName().equals(name)
                || BcSchema.RAW.getPropertyName().equals(name)
        )
            return true;

        return false;
    }

    private int addColumnToList(List<String> columns, String column) {
        if (!columns.contains(column))
            columns.add(column);

        return columns.indexOf(column);
    }

    private void addColumnType(List<String> columnTypes, int index, String type) {
        if (columnTypes.size() <= index) {
            columnTypes.add(index, type);
        } else if (Object.class.getName().equals(columnTypes.get(index)) && !Object.class.getName().equals(type)) {
            columnTypes.set(index, type);
        }
    }

    private SearchOptions getSearchOptions(ClientApiSearch search, String workspaceId, Integer offset, Integer size) {
        Map<String, Object> searchParams = new HashMap<>();
        searchParams.put("offset", offset);
        searchParams.put("size", size);
        searchParams.putAll(search.parameters);

        return new SearchOptions(searchParams, workspaceId);
    }


    public abstract static class DynamicGrowingList extends AbstractList {
        private static final Object[] DEFAULTCAPACITY_EMPTY_ELEMENTDATA = {};
        private static final int MAX_ARRAY_SIZE = Integer.MAX_VALUE - 8;
        transient Object[] elementData = DEFAULTCAPACITY_EMPTY_ELEMENTDATA;

        public DynamicGrowingList() {
        }

        @Override
        public Object set(int index, Object element) {
            ensureCapacity(index + 1);
            elementData[index] = element;
            return element;
        }

        @Override
        public Object get(int index) {
            return elementData[index];
        }

        @Override
        public int size() {
            return elementData.length;
        }

        public void ensureCapacity(int minCapacity) {
            int oldCapacity = elementData.length;

            if (minCapacity - oldCapacity <= 0)
                return;

            elementData = Arrays.copyOf(elementData, minCapacity);
        }
    }

    public static class ClientApiReadDatasetResponse implements ClientApiObject {

        public ClientApiReadDatasetResponse() {
        }

        public ClientApiReadDatasetResponse(String name, String id) {
            this.name = name;
            this.id = id;
        }

        public String name;
        public String id;
        public List<String> columns = new ArrayList<>();
        public List<String> columnTypes = new ArrayList<>();
        public List<DatasetRow> rows = new ArrayList<>();

        public static class DatasetRow extends DynamicGrowingList {
        }
    }

    public static class CsvClientApiReadDatasetResponse extends ClientApiReadDatasetResponse {

        public CsvClientApiReadDatasetResponse() {
        }

        public CsvClientApiReadDatasetResponse(String name, String id, String filePath) {
            super(name, id);
            this.filePath = filePath;
        }

        public String filePath;
    }
}
