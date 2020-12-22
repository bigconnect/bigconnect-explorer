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

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.Lists;
import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.ClientApiExtendedDataRow;
import com.mware.core.model.clientapi.dto.ClientApiGeObject;
import com.mware.core.model.clientapi.dto.PropertyType;
import com.mware.core.model.clientapi.util.ObjectMapperFactory;
import com.mware.core.model.schema.Concept;
import com.mware.core.model.schema.SchemaProperty;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.core.security.AuditEventType;
import com.mware.core.security.AuditService;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.core.util.ClientApiConverter;
import com.mware.ge.*;
import com.mware.ge.query.IterableWithSearchTime;
import com.mware.ge.query.Query;
import com.mware.ge.query.QueryResultsIterable;
import com.mware.ge.query.aggregations.*;
import com.mware.ge.values.storable.DateTimeValue;
import com.mware.search.GeObjectSearchRunnerBase;
import com.mware.search.QueryResultsIterableSearchResults;
import com.mware.search.SearchOptions;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.model.ClientApiElementSearchResponse;
import com.mware.web.model.ClientApiSearchResponse.*;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.routes.search.WebSearchOptionsFactory;
import org.apache.commons.lang.StringUtils;

import javax.servlet.http.HttpServletRequest;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Pattern;

import static com.google.common.base.Preconditions.checkNotNull;

public abstract class GeObjectSearchBase {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(GeObjectSearchBase.class);
    private static final Pattern DATE_TIME_PATTERN = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}T.*");
    protected final GeObjectSearchRunnerBase searchRunner;
    protected final SchemaRepository schemaRepository;
    protected final Graph graph;
    protected final AuditService auditService;
    private final ObjectMapper objectMapper;

    public GeObjectSearchBase(Graph graph,
                              GeObjectSearchRunnerBase searchRunner,
                              SchemaRepository schemaRepository,
                              AuditService auditService) {
        checkNotNull(searchRunner, "searchRunner is required");
        checkNotNull(schemaRepository, "ontologyRepository is required");
        this.searchRunner = searchRunner;
        this.schemaRepository = schemaRepository;
        this.graph = graph;
        this.auditService = auditService;
        this.objectMapper = ObjectMapperFactory.getInstance();
    }

    @Handle
    public ClientApiElementSearchResponse handle(
            HttpServletRequest request,
            @ActiveWorkspaceId String workspaceId,
            User user,
            Authorizations authorizations
    ) throws Exception {
        SearchOptions searchOptions = WebSearchOptionsFactory.create(request, workspaceId);
        try (QueryResultsIterableSearchResults searchResults = this.searchRunner.run(searchOptions, user, authorizations)) {
            List<ClientApiGeObject> geObjects = convertElementsToClientApi(
                    searchResults.getQueryResultsIterable(),
                    searchOptions.getWorkspaceId(),
                    authorizations
            );

            ClientApiElementSearchResponse results = new ClientApiElementSearchResponse();
            results.getElements().addAll(geObjects);
            results.setNextOffset((int) (searchResults.getOffset() + searchResults.getSize()));

            Boolean fetchReferencedElements = searchOptions.getOptionalParameter("fetchReferencedElements", Boolean.class);
            if (fetchReferencedElements != null && fetchReferencedElements) {
                results.setReferencedElements(findReferencedElements(geObjects, workspaceId, authorizations));
            }

            addSearchResultsDataToResults(results, searchResults.getQuery(), searchResults.getQueryResultsIterable(), workspaceId);

            searchResults.getQueryResultsIterable().close();
            searchResults.close();

            String q = (String) searchOptions.getParameters().get("q");
            String filter = (String) searchOptions.getParameters().get("filter");
            String json = String.format("{q: %s, filter: %s}", q, filter);
            auditService.auditGenericEvent(user, workspaceId != null ? workspaceId : StringUtils.EMPTY,
                    AuditEventType.SEARCH, "params", json);

            return results;
        }
    }


    protected List<ClientApiGeObject> findReferencedElements(
            List<ClientApiGeObject> searchResults,
            String workspaceId,
            Authorizations authorizations
    ) {
        Set<String> edgeIds = new HashSet<>();
        Set<String> vertexIds = new HashSet<>();
        for (ClientApiGeObject searchResult : searchResults) {
            if (searchResult instanceof ClientApiExtendedDataRow) {
                ClientApiExtendedDataRow row = (ClientApiExtendedDataRow) searchResult;
                switch (row.getId().getElementType()) {
                    case "EDGE":
                        edgeIds.add(row.getId().getElementId());
                        break;
                    case "VERTEX":
                        vertexIds.add(row.getId().getElementId());
                        break;
                    default:
                        throw new BcException("Unhandled " + ElementType.class.getName() + ": " + row.getId().getElementType());
                }
            }
        }

        List<ClientApiGeObject> results = new ArrayList<>();
        if (vertexIds.size() > 0) {
            Iterable<Vertex> vertices = graph.getVertices(vertexIds, ClientApiConverter.SEARCH_FETCH_HINTS, authorizations);
            for (Vertex vertex : vertices) {
                results.add(ClientApiConverter.toClientApiVertex(vertex, workspaceId, authorizations));
            }
        }
        if (edgeIds.size() > 0) {
            Iterable<Edge> edges = graph.getEdges(edgeIds, ClientApiConverter.SEARCH_FETCH_HINTS, authorizations);
            for (Edge edge : edges) {
                results.add(ClientApiConverter.toClientApiEdge(edge, workspaceId));
            }
        }
        return results;
    }

    protected void addSearchResultsDataToResults(
            ClientApiElementSearchResponse results,
            Query query,
            QueryResultsIterable<? extends GeObject> searchResults,
            String workspaceId
    ) {
        results.setTotalHits(searchResults.getTotalHits());

        if (searchResults instanceof IterableWithSearchTime) {
            results.setSearchTime(((IterableWithSearchTime) searchResults).getSearchTimeNanoSeconds());
        }
        for (Aggregation aggregation : query.getAggregations()) {
            results.getAggregates().put(aggregation.getAggregationName(),  toClientApiAggregateResult(searchResults, aggregation, workspaceId));
        }
    }

    private AggregateResult toClientApiAggregateResult(QueryResultsIterable<? extends GeObject> searchResults, Aggregation aggregation, String workspaceId) {
        AggregationResult aggResult;
        String fieldName =  null;
        if (aggregation instanceof TermsAggregation) {
            aggResult = searchResults.getAggregationResult(aggregation.getAggregationName(), TermsResult.class);
            fieldName = ((TermsAggregation)aggregation).getPropertyName();
        } else if (aggregation instanceof GeohashAggregation) {
            aggResult = searchResults.getAggregationResult(aggregation.getAggregationName(), GeohashResult.class);
            fieldName = ((GeohashAggregation)aggregation).getFieldName();
        } else if (aggregation instanceof HistogramAggregation || aggregation instanceof ChronoFieldAggregation) {
            aggResult = searchResults.getAggregationResult(aggregation.getAggregationName(), HistogramResult.class);
            if (aggregation instanceof HistogramAggregation)
                fieldName = ((HistogramAggregation)aggregation).getFieldName();
            else if (aggregation instanceof ChronoFieldAggregation)
                fieldName = ((ChronoFieldAggregation)aggregation).getPropertyName();
        } else if (aggregation instanceof StatisticsAggregation) {
            aggResult = searchResults.getAggregationResult(aggregation.getAggregationName(), StatisticsResult.class);
            fieldName = ((StatisticsAggregation)aggregation).getFieldName();
        } else {
            throw new BcException("Unhandled aggregation type: " + aggregation.getClass().getName());
        }

        return toClientApiAggregateResult(aggResult, fieldName, workspaceId);
    }

    private Map<String, AggregateResult> toClientApiNestedResults(Map<String, AggregationResult> nestedResults, String workspaceId) {
        Map<String, AggregateResult> results = new HashMap<>();
        for (Map.Entry<String, AggregationResult> entry : nestedResults.entrySet()) {
            AggregateResult aggResult = toClientApiAggregateResult(entry.getValue(), null, workspaceId);
            results.put(entry.getKey(), aggResult);
        }
        if (results.size() == 0) {
            return null;
        }
        return results;
    }

    private AggregateResult toClientApiAggregateResult(AggregationResult aggResult, String fieldName, String workspaceId) {
        if (aggResult instanceof TermsResult) {
            return toClientApiTermsAggregateResult((TermsResult) aggResult, fieldName, workspaceId);
        }
        if (aggResult instanceof GeohashResult) {
            return toClientApiGeohashResult((GeohashResult) aggResult, fieldName, workspaceId);
        }
        if (aggResult instanceof HistogramResult) {
            return toClientApiHistogramResult((HistogramResult) aggResult, fieldName, workspaceId);
        }
        if (aggResult instanceof StatisticsResult) {
            return toClientApiStatisticsResult((StatisticsResult) aggResult, fieldName);
        }
        if (aggResult instanceof SumResult) {
            return toClientApiSumResult((SumResult) aggResult, fieldName);
        }
        if (aggResult instanceof AvgResult) {
            return toClientApiAvgResult((AvgResult) aggResult, fieldName);
        }
        if (aggResult instanceof MinResult) {
            return toClientApiMinResult((MinResult) aggResult, fieldName);
        }
        if (aggResult instanceof MaxResult) {
            return toClientApiMaxResult((MaxResult) aggResult, fieldName);
        }
        throw new BcException("Unhandled aggregation result type: " + aggResult.getClass().getName());
    }

    private AggregateResult toClientApiSumResult(SumResult agg, String fieldName) {
        SumAggregateResult result = new SumAggregateResult();
        result.setValue(agg.value());
        result.setField(fieldName);
        return result;
    }

    private AggregateResult toClientApiAvgResult(AvgResult agg, String fieldName) {
        AvgAggregateResult result = new AvgAggregateResult();
        result.setValue(agg.value());
        result.setField(fieldName);
        return result;
    }

    private AggregateResult toClientApiMinResult(MinResult agg, String fieldName) {
        MinAggregateResult result = new MinAggregateResult();
        result.setValue(agg.value());
        result.setField(fieldName);
        return result;
    }

    private AggregateResult toClientApiMaxResult(MaxResult agg, String fieldName) {
        MaxAggregateResult result = new MaxAggregateResult();
        result.setValue(agg.value());
        result.setField(fieldName);
        return result;
    }

    private AggregateResult toClientApiStatisticsResult(StatisticsResult agg, String fieldName) {
        StatisticsAggregateResult result = new StatisticsAggregateResult();
        result.setCount(agg.getCount());
        result.setAverage(agg.getAverage());
        result.setMin(agg.getMin());
        result.setMax(agg.getMax());
        result.setStandardDeviation(agg.getStandardDeviation());
        result.setSum(agg.getSum());
        result.setField(fieldName);
        return result;
    }

    private AggregateResult toClientApiHistogramResult(HistogramResult agg, String fieldName, String workspaceId) {
        HistogramAggregateResult result = new HistogramAggregateResult();

        SchemaProperty schemaProperty = schemaRepository.getPropertyByName(fieldName, workspaceId);
        result.setFieldType(schemaProperty.getDataType().getText());
        result.setField(fieldName);
        List<HistogramBucket> list = Lists.newArrayList(agg.getBuckets());
        if(list != null && list.size() > 0) {
            Comparator<HistogramBucket> comparator = (HistogramBucket o1, HistogramBucket o2) -> {
                if(PropertyType.DOUBLE.equals(schemaProperty.getDataType()) || PropertyType.INTEGER.equals(schemaProperty.getDataType()))
                    return Double.valueOf(o1.getKey().toString()).compareTo(Double.valueOf(o2.getKey().toString()));
                else if(PropertyType.DATE.equals(schemaProperty.getDataType())) {
                    String strT1 = tryConvertToTime(o1.getKey().toString());
                    String strT2 = tryConvertToTime(o2.getKey().toString());
                    int compare = 0;
                    try {
                        compare = Long.valueOf(strT1).compareTo(Long.valueOf(strT2));
                    } catch (Exception ex) {
                        compare = strT1.compareTo(strT2);
                    }

                    return compare;
                } else
                    return o1.getKey().toString().compareTo(o2.getKey().toString());
            };
            Collections.sort(list, comparator);

            for(int i=0; i < list.size(); i++) {

                HistogramBucket histogramBucket = list.get(i);
                String firstKey = histogramBucket.getKey().toString();
                String firstLabel = firstKey;
                String firstValue = firstKey;
                if (PropertyType.DATE.equals(schemaProperty.getDataType())) {
                    firstLabel = getReadableDate(firstKey);
                    firstValue = tryConvertToTime(firstKey);
                }

                String secondKey = null;
                String secondLabel = "*";
                String secondValue = null;

                if (i < list.size() - 1) {
                    secondKey = list.get(i + 1).getKey().toString();
                }

                if (secondKey != null) {
                    if (PropertyType.DATE.equals(schemaProperty.getDataType())) {
                        secondLabel = getReadableDate(secondKey);
                        secondValue = tryConvertToTime(secondKey);
                    } else {
                        secondLabel = secondKey;
                        secondValue = secondKey;
                    }
                }

                HistogramAggregateResult.Bucket b = new HistogramAggregateResult.Bucket(
                        histogramBucket.getCount(),
                        toClientApiNestedResults(histogramBucket.getNestedResults(), workspaceId)
                );

                b.setFromValue(firstValue);
                if (secondKey != null) {
                    b.setToValue(secondValue);
                }

                b.setLabel(firstLabel + " - " + secondLabel);

                result.getBuckets().put(firstKey,b);
            }
        }

       return result;
    }

    private String getReadableDate(String bucketKey) {
        DateTimeFormatter readableFormat = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        if (DATE_TIME_PATTERN.matcher(bucketKey).matches()) {
            try {
                DateTimeValue dtv = DateTimeValue.parse(bucketKey, () -> ZoneOffset.UTC);
                return dtv.asObjectCopy().format(readableFormat);
            } catch (DateTimeParseException pe) {
                LOGGER.warn("Unable to parse histogram date", pe);
            }
        }
        return null;
    }

    private String tryConvertToTime(String bucketKey) {
        if (DATE_TIME_PATTERN.matcher(bucketKey).matches()) {
            try {
                DateTimeValue dtv = DateTimeValue.parse(bucketKey, () -> ZoneOffset.UTC);
                return String.valueOf(dtv.asObjectCopy().toInstant().toEpochMilli());
            } catch (DateTimeParseException pe) {
                LOGGER.warn("Unable to parse histogram date", pe);
            }
        }

        return bucketKey;
    }

    private AggregateResult toClientApiGeohashResult(GeohashResult agg, String fieldName, String workspaceId) {
        GeohashAggregateResult result = new GeohashAggregateResult();
        result.setMaxCount(agg.getMaxCount());
        result.setField(fieldName);
        for (GeohashBucket geohashBucket : agg.getBuckets()) {
            GeohashAggregateResult.Bucket b = new GeohashAggregateResult.Bucket(
                    ClientApiConverter.toClientApiGeoRect(geohashBucket.getGeoCell()),
                    ClientApiConverter.toClientApiGeoPoint(geohashBucket.getGeoPoint()),
                    geohashBucket.getCount(),
                    toClientApiNestedResults(geohashBucket.getNestedResults(), workspaceId)
            );
            result.getBuckets().put(geohashBucket.getKey(), b);
        }
        return result;
    }

    private TermsAggregateResult toClientApiTermsAggregateResult(TermsResult agg, String fieldName, String workspaceId) {
        TermsAggregateResult result = new TermsAggregateResult();
        result.setOrderedByNestedAgg(agg.isOrderedByNestedAgg());
        result.setField(fieldName);
        for (TermsBucket termsBucket : agg.getBuckets()) {
            TermsAggregateResult.Bucket b = new TermsAggregateResult.Bucket(
                    termsBucket.getCount(),
                    toClientApiNestedResults(termsBucket.getNestedResults(), workspaceId)
            );

            if("conceptType".equals(fieldName)) {
                Concept concept = schemaRepository.getConceptByName(termsBucket.getKey().toString(), workspaceId);
                if (concept != null) {
                    b.setLabel(concept.getDisplayName());
                }
            } else {
                b.setLabel(termsBucket.getKey().toString());
            }

            result.getBuckets().put(termsBucket.getKey().toString(), b);
        }
        return result;
    }

    public static List<ClientApiGeObject> convertElementsToClientApi(
            Iterable<? extends GeObject> searchResults,
            String workspaceId,
            Authorizations authorizations
    ) {
        List<ClientApiGeObject> results = new ArrayList<>();
        for (GeObject geObject : searchResults) {
            ClientApiGeObject vo = null;
            if (geObject instanceof Vertex) {
                vo = ClientApiConverter.toClientApiVertex((Vertex) geObject, workspaceId, null, authorizations);
            } else if (geObject instanceof Edge) {
                vo = ClientApiConverter.toClientApiEdge((Edge) geObject, workspaceId);
            } else if (geObject instanceof ExtendedDataRow) {
                vo = ClientApiConverter.toClientApiExtendedDataRow((ExtendedDataRow) geObject, workspaceId);
            } else {
                throw new BcException("Unhandled " + GeObject.class.getName() + ": " + geObject.getClass().getName());
            }
            results.add(vo);
        }
        return results;
    }
}
