package com.mware.web.routes.admin.reclassify;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.properties.RawObjectSchema;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.Authorizations;
import com.mware.ge.FetchHints;
import com.mware.ge.Graph;
import com.mware.ge.Property;
import com.mware.ge.Vertex;
import com.mware.core.config.Configuration;
import com.mware.ge.GraphWithSearchIndex;
import com.mware.ge.elasticsearch5.Elasticsearch5SearchIndex;
import com.mware.ge.elasticsearch5.ElasticsearchDocumentType;
import com.mware.ge.mutation.ExistingElementMutation;
import com.mware.ge.search.SearchIndex;
import org.apache.commons.lang3.StringUtils;
import org.elasticsearch.action.search.SearchRequestBuilder;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.client.Client;
import org.elasticsearch.common.unit.TimeValue;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.aggregations.AggregationBuilders;
import org.elasticsearch.search.aggregations.bucket.terms.Terms;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Finds posts by type, SERP keyword/bucket/project and date, clears their classification and sends them back
 * to the data workers. Only the language property is re-queued, which is what the relevance and topic
 * classification workers listen for, so the other data workers are not run again.
 */
@Singleton
public class ReclassifyService {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(ReclassifyService.class);

    public static final List<String> DEFAULT_CONCEPTS = Arrays.asList(
            "fbPost", "fbComment", "twitterPost", "twitterComment", "instagramPost", "instagramComment",
            "ttVideo", "youtubeVideo", "webArticle");
    public static final String NO_CONFIDENT_CLASSIFICATION = "No confident classification";

    private static final String TOPIC_PREFIX = "topicClassification";
    private static final int MAX_TOPICS = 10;
    private static final String RELEVANT_KEYWORDS = "otherRelevantKeywords";
    private static final String RELEVANT_BUCKETS = "otherRelevantBuckets";
    private static final String LAST_MODIFIED = "last_modified";
    private static final int BATCH_SIZE = 100;
    private static final int FACET_SIZE = 1000;
    private static final int MAX_KEPT_JOBS = 20;
    private static final String EXACT = Elasticsearch5SearchIndex.EXACT_MATCH_PROPERTY_NAME_SUFFIX;

    public enum Scope { MISSING, NO_CONFIDENT, ALL }

    public enum Action { TOPICS, RELEVANCE_AND_TOPICS }

    public static class Filter {
        List<String> concepts = DEFAULT_CONCEPTS;
        List<String> keywords = Collections.emptyList();
        List<String> buckets = Collections.emptyList();
        List<String> projects = Collections.emptyList();
        Long fromMillis;
        Long toMillis;
        Scope scope = Scope.MISSING;

        JSONObject toJson() {
            return new JSONObject()
                    .put("concepts", concepts)
                    .put("keywords", keywords)
                    .put("buckets", buckets)
                    .put("projects", projects)
                    .put("from", fromMillis == null ? JSONObject.NULL : fromMillis)
                    .put("to", toMillis == null ? JSONObject.NULL : toMillis)
                    .put("scope", scope.name());
        }
    }

    public static class Job {
        final String id = UUID.randomUUID().toString();
        final Filter filter;
        final Action action;
        final Priority priority;
        final Integer limit;
        final long startedAt = System.currentTimeMillis();
        volatile String state = "RUNNING";
        volatile String message = "";
        volatile long total;
        volatile long processed;
        volatile long requeued;
        volatile long skippedNoLanguage;
        volatile long skippedAlreadyClassified;
        volatile long errors;
        volatile Long finishedAt;
        volatile boolean cancelRequested;

        Job(Filter filter, Action action, Priority priority, Integer limit) {
            this.filter = filter;
            this.action = action;
            this.priority = priority;
            this.limit = limit;
        }

        public JSONObject toJson() {
            return new JSONObject()
                    .put("id", id)
                    .put("state", state)
                    .put("message", message)
                    .put("action", action.name())
                    .put("priority", priority.name())
                    .put("limit", limit == null ? JSONObject.NULL : limit)
                    .put("filter", filter.toJson())
                    .put("total", total)
                    .put("processed", processed)
                    .put("requeued", requeued)
                    .put("skippedNoLanguage", skippedNoLanguage)
                    .put("skippedAlreadyClassified", skippedAlreadyClassified)
                    .put("errors", errors)
                    .put("startedAt", startedAt)
                    .put("finishedAt", finishedAt == null ? JSONObject.NULL : finishedAt);
        }
    }

    private final Graph graph;
    private final WorkQueueRepository workQueueRepository;
    private final String indexName;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "reclassify");
        t.setDaemon(true);
        return t;
    });
    private final Map<String, Job> jobs = Collections.synchronizedMap(new LinkedHashMap<String, Job>() {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Job> eldest) {
            return size() > MAX_KEPT_JOBS;
        }
    });

    @Inject
    public ReclassifyService(Graph graph, WorkQueueRepository workQueueRepository, Configuration configuration) {
        this.graph = graph;
        this.workQueueRepository = workQueueRepository;
        this.indexName = configuration.get("graph.search.indexName", "ge");
    }

    // The SERP properties are indexed only as keywords (".exact"), but the graph has no exact-match definition for them,
    // so graph queries on them fail ("Text fields are not optimized..."). The posts are therefore searched directly in
    // Elasticsearch, on the exact fields of every visibility the property is stored with.

    /**
     * Keyword, bucket and project counts of the posts the action will classify (each list ignores its own selection).
     * The classifiers need a detected language, and the topic classification also needs relevant keywords, so posts
     * without them are never counted or sent.
     */
    public JSONObject facets(Filter filter, Action action, Authorizations authorizations) {
        JSONObject result = new JSONObject();
        result.put("keywords", facet(filter, action, RawObjectSchema.SERP_KEYWORD.getPropertyName(), "keywords", authorizations));
        result.put("buckets", facet(filter, action, RawObjectSchema.SERP_BUCKET.getPropertyName(), "buckets", authorizations));
        result.put("projects", facet(filter, action, RawObjectSchema.SERP_PROJECT.getPropertyName(), "projects", authorizations));
        return result;
    }

    private JSONArray facet(Filter filter, Action action, String propertyName, String ignoredField, Authorizations authorizations) {
        JSONArray values = new JSONArray();
        String[] fields = fieldNames(propertyName, authorizations);
        if (fields.length == 0) {
            return values;
        }
        try {
            SearchRequestBuilder search = client().prepareSearch(indexName)
                    .setQuery(buildRunQuery(copyWithout(filter, ignoredField), action, authorizations))
                    .setSize(0);
            for (int i = 0; i < fields.length; i++) {
                search.addAggregation(AggregationBuilders.terms("f" + i).field(fields[i] + EXACT).size(FACET_SIZE));
            }
            SearchResponse response = search.get();
            Map<String, Long> counts = new HashMap<>();
            for (int i = 0; i < fields.length; i++) {
                Terms terms = response.getAggregations().get("f" + i);
                for (Terms.Bucket bucket : terms.getBuckets()) {
                    counts.merge(bucket.getKeyAsString(), bucket.getDocCount(), Long::sum);
                }
            }
            counts.entrySet().stream()
                    .filter(e -> StringUtils.isNotBlank(e.getKey()))
                    .sorted((x, y) -> Long.compare(y.getValue(), x.getValue()))
                    .forEach(e -> values.put(new JSONObject().put("value", e.getKey()).put("count", e.getValue())));
        } catch (Exception e) {
            LOGGER.error("Could not count values of %s", propertyName, e);
        }
        return values;
    }

    /** How many posts the action will classify. */
    public JSONObject preview(Filter filter, Action action, Authorizations authorizations) {
        return new JSONObject().put("toClassify", count(buildRunQuery(filter, action, authorizations)));
    }

    /** The posts an action can classify; the others would only be skipped by the data workers. */
    private BoolQueryBuilder buildRunQuery(Filter filter, Action action, Authorizations authorizations) {
        BoolQueryBuilder query = buildQuery(filter, authorizations);
        query.filter(existsAny(RawObjectSchema.RAW_LANGUAGE.getPropertyName(), authorizations));
        if (action == Action.TOPICS) {
            query.filter(existsAny(RELEVANT_KEYWORDS, authorizations));
        }
        return query;
    }

    private long count(BoolQueryBuilder query) {
        return client().prepareSearch(indexName).setQuery(query).setSize(0).setTrackTotalHits(true).get()
                .getHits().getTotalHits().value;
    }

    private List<String> findIds(Filter filter, Action action, Integer limit, Authorizations authorizations) {
        List<String> ids = new ArrayList<>();
        int max = limit != null && limit > 0 ? limit : Integer.MAX_VALUE;
        TimeValue keepAlive = TimeValue.timeValueMinutes(2);
        SearchResponse response = client().prepareSearch(indexName)
                .setQuery(buildRunQuery(filter, action, authorizations))
                .setFetchSource(Elasticsearch5SearchIndex.ELEMENT_ID_FIELD_NAME, null)
                .setSize(Math.min(1000, max))
                .setScroll(keepAlive)
                .get();
        String scrollId = response.getScrollId();
        try {
            while (response.getHits().getHits().length > 0 && ids.size() < max) {
                for (SearchHit hit : response.getHits().getHits()) {
                    Object id = hit.getSourceAsMap().get(Elasticsearch5SearchIndex.ELEMENT_ID_FIELD_NAME);
                    if (id instanceof List && !((List<?>) id).isEmpty()) {
                        id = ((List<?>) id).get(0);
                    }
                    if (id != null && ids.size() < max) {
                        ids.add(id.toString());
                    }
                }
                response = client().prepareSearchScroll(scrollId).setScroll(keepAlive).get();
                scrollId = response.getScrollId();
            }
        } finally {
            if (scrollId != null) {
                client().prepareClearScroll().addScrollId(scrollId).get();
            }
        }
        return ids;
    }

    public Job start(Filter filter, Action action, Priority priority, Integer limit, Authorizations authorizations) {
        Job job = new Job(filter, action, priority, limit);
        jobs.put(job.id, job);
        executor.submit(() -> run(job, authorizations));
        return job;
    }

    public Job getJob(String id) {
        return jobs.get(id);
    }

    public List<Job> getJobs() {
        synchronized (jobs) {
            List<Job> list = new ArrayList<>(jobs.values());
            Collections.reverse(list);
            return list;
        }
    }

    public boolean cancel(String id) {
        Job job = jobs.get(id);
        if (job == null || !"RUNNING".equals(job.state) && !"QUEUED".equals(job.state)) {
            return false;
        }
        job.cancelRequested = true;
        return true;
    }

    private void run(Job job, Authorizations authorizations) {
        try {
            List<String> ids = findIds(job.filter, job.action, job.limit, authorizations);
            job.total = ids.size();
            LOGGER.info("Reclassify job %s: %d posts, action %s, filter %s", job.id, ids.size(), job.action, job.filter.toJson());

            for (int i = 0; i < ids.size() && !job.cancelRequested; i += BATCH_SIZE) {
                processBatch(job, ids.subList(i, Math.min(i + BATCH_SIZE, ids.size())), authorizations);
            }

            job.state = job.cancelRequested ? "CANCELLED" : "DONE";
            job.message = job.cancelRequested ? "Stopped by user" : "";
        } catch (Exception e) {
            LOGGER.error("Reclassify job %s failed", job.id, e);
            job.state = "FAILED";
            job.message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        } finally {
            job.finishedAt = System.currentTimeMillis();
            LOGGER.info("Reclassify job %s finished: %s", job.id, job.toJson());
        }
    }

    private void processBatch(Job job, List<String> ids, Authorizations authorizations) {
        List<Vertex> changed = new ArrayList<>();
        for (Vertex vertex : graph.getVertices(ids, FetchHints.ALL, authorizations)) {
            try {
                if (!hasLanguage(vertex)) {
                    job.skippedNoLanguage++;
                } else if (!inScope(vertex, job.filter.scope)) {
                    job.skippedAlreadyClassified++;
                } else {
                    ExistingElementMutation<Vertex> m = vertex.prepareMutation();
                    for (int i = 1; i <= MAX_TOPICS; i++) {
                        deleteAll(vertex, m, TOPIC_PREFIX + i);
                    }
                    if (job.action == Action.RELEVANCE_AND_TOPICS) {
                        deleteAll(vertex, m, RELEVANT_KEYWORDS);
                        deleteAll(vertex, m, RELEVANT_BUCKETS);
                    }
                    m.save(authorizations);
                    changed.add(vertex);
                }
            } catch (Exception e) {
                job.errors++;
                LOGGER.error("Could not clear classification of %s", vertex.getId(), e);
            }
            job.processed++;
        }
        graph.flush();

        // re-read the posts so the workers decide on the cleared properties
        List<String> changedIds = new ArrayList<>();
        for (Vertex vertex : changed) {
            changedIds.add(vertex.getId());
        }
        for (Vertex vertex : graph.getVertices(changedIds, FetchHints.ALL, authorizations)) {
            try {
                for (Property language : vertex.getProperties(RawObjectSchema.RAW_LANGUAGE.getPropertyName())) {
                    workQueueRepository.pushOnDwQueue(vertex, language.getKey(), language.getName(), null, null,
                            job.priority, ElementOrPropertyStatus.UPDATE, null);
                }
                job.requeued++;
            } catch (Exception e) {
                job.errors++;
                LOGGER.error("Could not re-queue %s", vertex.getId(), e);
            }
        }
    }

    private static void deleteAll(Vertex vertex, ExistingElementMutation<Vertex> m, String propertyName) {
        for (Property property : vertex.getProperties(propertyName)) {
            m.deleteProperty(property);
        }
    }

    private static boolean hasLanguage(Vertex vertex) {
        for (Property property : vertex.getProperties(RawObjectSchema.RAW_LANGUAGE.getPropertyName())) {
            if (StringUtils.isNotBlank(RawObjectSchema.RAW_LANGUAGE.getPropertyValue(property))) {
                return true;
            }
        }
        return false;
    }

    private static boolean inScope(Vertex vertex, Scope scope) {
        if (scope == Scope.ALL) {
            return true;
        }
        String topic = null;
        for (Property property : vertex.getProperties(TOPIC_PREFIX + "1")) {
            if (property.getValue() != null && StringUtils.isNotBlank(property.getValue().toString())) {
                topic = property.getValue().toString();
            }
        }
        // the index already filtered; re-checked here because the post may have been classified since
        return scope == Scope.MISSING ? topic == null : NO_CONFIDENT_CLASSIFICATION.equals(topic);
    }

    private BoolQueryBuilder buildQuery(Filter filter, Authorizations authorizations) {
        BoolQueryBuilder query = QueryBuilders.boolQuery()
                .filter(QueryBuilders.termQuery(Elasticsearch5SearchIndex.ELEMENT_TYPE_FIELD_NAME, ElasticsearchDocumentType.VERTEX.getKey()))
                .filter(QueryBuilders.termsQuery(SearchIndex.CONCEPT_TYPE_FIELD_NAME, filter.concepts));
        exactIn(query, RawObjectSchema.SERP_KEYWORD.getPropertyName(), filter.keywords, authorizations);
        exactIn(query, RawObjectSchema.SERP_BUCKET.getPropertyName(), filter.buckets, authorizations);
        exactIn(query, RawObjectSchema.SERP_PROJECT.getPropertyName(), filter.projects, authorizations);
        if (filter.fromMillis != null || filter.toMillis != null) {
            BoolQueryBuilder anyDate = QueryBuilders.boolQuery().minimumShouldMatch(1);
            for (String field : fieldNames(LAST_MODIFIED, authorizations)) {
                org.elasticsearch.index.query.RangeQueryBuilder range = QueryBuilders.rangeQuery(field);
                if (filter.fromMillis != null) {
                    range.gte(filter.fromMillis);
                }
                if (filter.toMillis != null) {
                    range.lt(filter.toMillis);
                }
                anyDate.should(range);
            }
            query.filter(anyDate);
        }
        String topic = TOPIC_PREFIX + "1";
        if (filter.scope == Scope.MISSING) {
            query.mustNot(existsAny(topic, authorizations));
        } else if (filter.scope == Scope.NO_CONFIDENT) {
            exactIn(query, topic, Collections.singletonList(NO_CONFIDENT_CLASSIFICATION), authorizations);
        }
        return query;
    }

    /** The value is one of the given ones, in any of the property's visibilities (keyword fields are lower-cased). */
    private void exactIn(BoolQueryBuilder query, String propertyName, List<String> values, Authorizations authorizations) {
        if (values.isEmpty()) {
            return;
        }
        BoolQueryBuilder any = QueryBuilders.boolQuery().minimumShouldMatch(1);
        for (String field : fieldNames(propertyName, authorizations)) {
            any.should(QueryBuilders.termsQuery(field + EXACT, values));
        }
        query.filter(any);
    }

    private BoolQueryBuilder existsAny(String propertyName, Authorizations authorizations) {
        BoolQueryBuilder any = QueryBuilders.boolQuery().minimumShouldMatch(1);
        for (String field : fieldNames(propertyName, authorizations)) {
            any.should(QueryBuilders.existsQuery(field));
        }
        return any;
    }

    private String[] fieldNames(String propertyName, Authorizations authorizations) {
        return searchIndex().getPropertyNames(graph, propertyName, authorizations);
    }

    private Elasticsearch5SearchIndex searchIndex() {
        return (Elasticsearch5SearchIndex) ((GraphWithSearchIndex) graph).getSearchIndex();
    }

    private Client client() {
        return searchIndex().getClient();
    }

    private static Filter copyWithout(Filter filter, String field) {
        Filter copy = new Filter();
        copy.concepts = filter.concepts;
        copy.keywords = "keywords".equals(field) ? Collections.emptyList() : filter.keywords;
        copy.buckets = "buckets".equals(field) ? Collections.emptyList() : filter.buckets;
        copy.projects = "projects".equals(field) ? Collections.emptyList() : filter.projects;
        copy.fromMillis = filter.fromMillis;
        copy.toMillis = filter.toMillis;
        copy.scope = filter.scope;
        return copy;
    }
}
