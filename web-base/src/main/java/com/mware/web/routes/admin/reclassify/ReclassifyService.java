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
import com.mware.core.ingest.dataworker.DataWorker;
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
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Finds posts by type, SERP keyword/bucket/project and date and sends them back to the data workers:
 * - TOPICS / RELEVANCE_AND_TOPICS clear the classification and re-queue only the language property, which is what the
 *   relevance and topic classification workers listen for
 * - WORKER re-queues the properties a chosen data worker handles on each post, as decided by the running worker
 *   itself; other workers handling the same properties start too, the preview lists them
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
    private static final int PREVIEW_SAMPLE = 100;
    private static final int PROGRESS_CHECK_SECONDS = 30;
    private static final int PROGRESS_BATCH = 1000;
    private static final int WORKER_CHECKS_PER_ROUND = 5000;
    private static final long STALLED_AFTER_MILLIS = TimeUnit.MINUTES.toMillis(15);
    // with the queue empty and nothing finishing for this long, the posts still waiting will not get a result
    private static final long FINISHED_WHEN_QUEUE_EMPTY_MILLIS = TimeUnit.MINUTES.toMillis(2);
    // posts whose relevance recomputation finds no keywords never get a topic; they count as done after this
    private static final long NO_KEYWORDS_GRACE_MILLIS = TimeUnit.MINUTES.toMillis(10);
    private static final String EXACT = Elasticsearch5SearchIndex.EXACT_MATCH_PROPERTY_NAME_SUFFIX;

    public enum Scope { MISSING, NO_CONFIDENT, ALL }

    public enum Action { TOPICS, RELEVANCE_AND_TOPICS, WORKER }

    public static class Filter {
        List<String> concepts = DEFAULT_CONCEPTS;
        List<String> keywords = Collections.emptyList();
        List<String> buckets = Collections.emptyList();
        List<String> projects = Collections.emptyList();
        Long fromMillis;
        Long toMillis;
        Scope scope = Scope.MISSING;
        boolean ignoreScope;

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
        final String worker;
        final long startedAt = System.currentTimeMillis();
        volatile String state = "RUNNING";
        volatile String message = "";
        volatile long total;
        volatile long processed;
        volatile long requeued;
        volatile long skippedNoLanguage;
        volatile long skippedAlreadyClassified;
        volatile long skippedNotHandled;
        volatile long errors;
        volatile Long finishedAt;
        volatile boolean cancelRequested;
        // what the data workers did with the posts sent: a post is pending until its result is there
        final Set<String> pending = ConcurrentHashMap.newKeySet();
        volatile long done;
        volatile long doneWithoutKeywords;
        volatile Long sentAt;
        volatile long lastProgressAt = System.currentTimeMillis();
        volatile Authorizations authorizations;

        Job(Filter filter, Action action, String worker, Priority priority, Integer limit) {
            this.filter = filter;
            this.action = action;
            this.worker = worker;
            this.priority = priority;
            this.limit = limit;
        }

        public JSONObject toJson() {
            return new JSONObject()
                    .put("id", id)
                    .put("state", state)
                    .put("message", message)
                    .put("action", action.name())
                    .put("worker", worker == null ? JSONObject.NULL : worker)
                    .put("priority", priority.name())
                    .put("limit", limit == null ? JSONObject.NULL : limit)
                    .put("filter", filter.toJson())
                    .put("total", total)
                    .put("processed", processed)
                    .put("requeued", requeued)
                    .put("skippedNoLanguage", skippedNoLanguage)
                    .put("skippedAlreadyClassified", skippedAlreadyClassified)
                    .put("skippedNotHandled", skippedNotHandled)
                    .put("errors", errors)
                    .put("done", done)
                    .put("doneWithoutKeywords", doneWithoutKeywords)
                    .put("waiting", pending.size())
                    .put("sentAt", sentAt == null ? JSONObject.NULL : sentAt)
                    .put("lastProgressAt", lastProgressAt)
                    .put("startedAt", startedAt)
                    .put("finishedAt", finishedAt == null ? JSONObject.NULL : finishedAt);
        }
    }

    private final Graph graph;
    private final WorkQueueRepository workQueueRepository;
    private final String indexName;
    private final DataWorkerCatalog dataWorkerCatalog;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "reclassify");
        t.setDaemon(true);
        return t;
    });
    private final ScheduledExecutorService progressChecker = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "reclassify-progress");
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
    public ReclassifyService(Graph graph, WorkQueueRepository workQueueRepository, Configuration configuration,
                             DataWorkerCatalog dataWorkerCatalog) {
        this.graph = graph;
        this.dataWorkerCatalog = dataWorkerCatalog;
        this.workQueueRepository = workQueueRepository;
        this.indexName = configuration.get("graph.search.indexName", "ge");
        progressChecker.scheduleWithFixedDelay(this::checkProgress, PROGRESS_CHECK_SECONDS, PROGRESS_CHECK_SECONDS, TimeUnit.SECONDS);
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

    /**
     * For the WORKER action: the matching posts, and on a sample of them which properties the worker handles and which
     * other workers the same properties start.
     */
    public JSONObject previewWorker(Filter filter, String workerClass, Authorizations authorizations) {
        Map<String, DataWorker> workers = dataWorkerCatalog.workers();
        DataWorker worker = workers.get(workerClass);
        if (worker == null) {
            throw new IllegalArgumentException("Data worker is not running here: " + workerClass);
        }
        long matching = count(buildRunQuery(filter, Action.WORKER, authorizations));
        List<String> sampleIds = findIds(filter, Action.WORKER, PREVIEW_SAMPLE, authorizations);
        int handledPosts = 0;
        Map<String, Integer> postsByProperty = new LinkedHashMap<>();
        Map<String, java.util.Set<String>> alsoByProperty = new HashMap<>();
        for (Vertex vertex : graph.getVertices(sampleIds, FetchHints.ALL, authorizations)) {
            boolean handled = false;
            for (Property property : handledProperties(worker, vertex)) {
                String key = property == null ? "(whole post)" : property.getName();
                handled = true;
                postsByProperty.merge(key, 1, Integer::sum);
                for (String other : dataWorkerCatalog.handling(workers, vertex, property)) {
                    if (!other.equals(workerClass)) {
                        alsoByProperty.computeIfAbsent(key, k -> new java.util.TreeSet<>())
                                .add(DataWorkerCatalog.name(workers.get(other)));
                    }
                }
            }
            if (handled) {
                handledPosts++;
            }
        }
        JSONArray properties = new JSONArray();
        postsByProperty.forEach((name, posts) -> properties.put(new JSONObject()
                .put("property", name)
                .put("posts", posts)
                .put("alsoStarts", new JSONArray(alsoByProperty.getOrDefault(name, Collections.emptySet())))));
        return new JSONObject()
                .put("matching", matching)
                .put("sample", sampleIds.size())
                .put("handledInSample", handledPosts)
                .put("properties", properties);
    }

    /** The properties of the post the worker handles; null stands for the whole post. */
    private static List<Property> handledProperties(DataWorker worker, Vertex vertex) {
        List<Property> handled = new ArrayList<>();
        if (safeIsHandled(worker, vertex, null)) {
            handled.add(null);
        }
        for (Property property : vertex.getProperties()) {
            if (safeIsHandled(worker, vertex, property)) {
                handled.add(property);
            }
        }
        return handled;
    }

    private static boolean safeIsHandled(DataWorker worker, Vertex vertex, Property property) {
        try {
            return worker.isHandled(vertex, property);
        } catch (Exception e) {
            LOGGER.debug("isHandled of %s failed on %s", worker.getClass().getName(), vertex.getId(), e);
            return false;
        }
    }

    public JSONArray workers() {
        return dataWorkerCatalog.toJson();
    }

    /** The posts an action can classify; the others would only be skipped by the data workers. */
    private BoolQueryBuilder buildRunQuery(Filter filter, Action action, Authorizations authorizations) {
        BoolQueryBuilder query = buildQuery(filter, authorizations);
        if (action == Action.WORKER) {
            return query;                          // the worker decides on each post which properties it handles
        }
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

    public Job start(Filter filter, Action action, String worker, Priority priority, Integer limit, Authorizations authorizations) {
        if (action == Action.WORKER && !dataWorkerCatalog.workers().containsKey(worker)) {
            throw new IllegalArgumentException("Data worker is not running here: " + worker);
        }
        Job job = new Job(filter, action, action == Action.WORKER ? worker : null, priority, limit);
        job.authorizations = authorizations;
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

    /** Stops sending posts; a run that already sent everything stops being tracked (queued posts are still processed). */
    public boolean cancel(String id) {
        Job job = jobs.get(id);
        if (job == null) {
            return false;
        }
        if ("RUNNING".equals(job.state) || "QUEUED".equals(job.state)) {
            job.cancelRequested = true;
            return true;
        }
        if ("PROCESSING".equals(job.state) || "STALLED".equals(job.state)) {
            job.state = "CANCELLED";
            job.message = "No longer tracked; posts already sent are still processed";
            job.finishedAt = System.currentTimeMillis();
            return true;
        }
        return false;
    }

    private void run(Job job, Authorizations authorizations) {
        try {
            List<String> ids = findIds(job.filter, job.action, job.limit, authorizations);
            job.total = ids.size();
            LOGGER.info("Reclassify job %s: %d posts, action %s, filter %s", job.id, ids.size(), job.action, job.filter.toJson());

            for (int i = 0; i < ids.size() && !job.cancelRequested; i += BATCH_SIZE) {
                processBatch(job, ids.subList(i, Math.min(i + BATCH_SIZE, ids.size())), authorizations);
            }

            job.sentAt = System.currentTimeMillis();
            job.lastProgressAt = job.sentAt;
            if (job.cancelRequested) {
                job.state = "CANCELLED";
                job.message = "Stopped by user; posts already sent are still processed";
            } else {
                job.state = job.pending.isEmpty() ? "DONE" : "PROCESSING";
                job.message = "";
            }
        } catch (Exception e) {
            LOGGER.error("Reclassify job %s failed", job.id, e);
            job.state = "FAILED";
            job.message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        } finally {
            if (!"PROCESSING".equals(job.state)) {
                job.finishedAt = System.currentTimeMillis();
            }
            LOGGER.info("Reclassify job %s sent its posts: %s", job.id, job.toJson());
        }
    }

    private void processBatch(Job job, List<String> ids, Authorizations authorizations) {
        if (job.action == Action.WORKER) {
            requeueForWorker(job, ids, authorizations);
            return;
        }
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
                job.pending.add(vertex.getId());
            } catch (Exception e) {
                job.errors++;
                LOGGER.error("Could not re-queue %s", vertex.getId(), e);
            }
        }
    }

    private void requeueForWorker(Job job, List<String> ids, Authorizations authorizations) {
        DataWorker worker = dataWorkerCatalog.workers().get(job.worker);
        if (worker == null) {
            throw new IllegalStateException("Data worker is no longer running: " + job.worker);
        }
        for (Vertex vertex : graph.getVertices(ids, FetchHints.ALL, authorizations)) {
            try {
                List<Property> handled = handledProperties(worker, vertex);
                if (handled.isEmpty()) {
                    job.skippedNotHandled++;
                }
                for (Property property : handled) {
                    workQueueRepository.pushOnDwQueue(vertex, property == null ? null : property.getKey(),
                            property == null ? null : property.getName(), null, null, job.priority,
                            ElementOrPropertyStatus.UPDATE, null);
                }
                if (!handled.isEmpty()) {
                    job.requeued++;
                    job.pending.add(vertex.getId());
                }
            } catch (Exception e) {
                job.errors++;
                LOGGER.error("Could not re-queue %s for %s", vertex.getId(), job.worker, e);
            }
            job.processed++;
        }
    }

    /** Every half minute: which of the posts sent by each run have their result now. */
    private void checkProgress() {
        for (Job job : getJobs()) {
            if (job.pending.isEmpty() || job.authorizations == null
                    || !("RUNNING".equals(job.state) || "PROCESSING".equals(job.state) || "STALLED".equals(job.state))) {
                continue;
            }
            try {
                long before = job.done;
                if (job.action == Action.WORKER) {
                    checkWorkerProgress(job);
                } else {
                    checkClassificationProgress(job);
                }
                long now = System.currentTimeMillis();
                if (job.done > before) {
                    job.lastProgressAt = now;
                }
                if (job.sentAt != null) {
                    if (job.pending.isEmpty()) {
                        job.state = "DONE";
                        job.finishedAt = now;
                    } else if (now - job.lastProgressAt > FINISHED_WHEN_QUEUE_EMPTY_MILLIS && dwQueueIsEmpty()) {
                        // e.g. posts without usable text: the worker clears them and writes nothing
                        job.state = "DONE";
                        job.finishedAt = now;
                        job.message = String.format("%,d posts got no result (no usable text, or skipped by the worker)",
                                job.pending.size());
                    } else if (now - job.lastProgressAt > STALLED_AFTER_MILLIS) {
                        job.state = "STALLED";
                        job.message = "Nothing finished in the last 15 minutes: check the data workers and the AI server";
                    } else {
                        job.state = "PROCESSING";
                        job.message = "";
                    }
                }
            } catch (Exception e) {
                LOGGER.warn("Could not check the progress of reclassify job %s", job.id, e);
            }
        }
    }

    private boolean dwQueueIsEmpty() {
        try {
            return workQueueRepository.getDwQueueSize() == 0;
        } catch (Exception e) {
            LOGGER.debug("Could not read the data worker queue size", e);
            return false;
        }
    }

    /** A post is done once the topic classification wrote topicClassification1 again (cleared before sending). */
    private void checkClassificationProgress(Job job) {
        List<String> ids = new ArrayList<>(job.pending);
        boolean graceOver = job.sentAt != null && System.currentTimeMillis() - job.sentAt > NO_KEYWORDS_GRACE_MILLIS;
        for (int i = 0; i < ids.size(); i += PROGRESS_BATCH) {
            List<String> batch = ids.subList(i, Math.min(i + PROGRESS_BATCH, ids.size()));
            for (String id : findAmong(batch, existsAny(TOPIC_PREFIX + "1", job.authorizations))) {
                if (job.pending.remove(id)) {
                    job.done++;
                }
            }
            if (job.action == Action.RELEVANCE_AND_TOPICS && graceOver) {
                BoolQueryBuilder noKeywords = QueryBuilders.boolQuery().mustNot(existsAny(RELEVANT_KEYWORDS, job.authorizations));
                for (String id : findAmong(batch, noKeywords)) {
                    if (job.pending.remove(id)) {
                        job.done++;
                        job.doneWithoutKeywords++;
                    }
                }
            }
        }
    }

    private List<String> findAmong(List<String> ids, org.elasticsearch.index.query.QueryBuilder condition) {
        SearchResponse response = client().prepareSearch(indexName)
                .setQuery(QueryBuilders.boolQuery()
                        .filter(QueryBuilders.termsQuery(Elasticsearch5SearchIndex.ELEMENT_ID_FIELD_NAME, ids))
                        .filter(condition))
                .setFetchSource(Elasticsearch5SearchIndex.ELEMENT_ID_FIELD_NAME, null)
                .setSize(ids.size())
                .get();
        List<String> found = new ArrayList<>();
        for (SearchHit hit : response.getHits().getHits()) {
            Object id = hit.getSourceAsMap().get(Elasticsearch5SearchIndex.ELEMENT_ID_FIELD_NAME);
            if (id instanceof List && !((List<?>) id).isEmpty()) {
                id = ((List<?>) id).get(0);
            }
            if (id != null) {
                found.add(id.toString());
            }
        }
        return found;
    }

    /** A post is done once the worker no longer handles any of its properties (it wrote its result). */
    private void checkWorkerProgress(Job job) {
        DataWorker worker = dataWorkerCatalog.workers().get(job.worker);
        if (worker == null) {
            return;
        }
        List<String> ids = new ArrayList<>(job.pending);
        ids = ids.subList(0, Math.min(ids.size(), WORKER_CHECKS_PER_ROUND));
        for (int i = 0; i < ids.size(); i += BATCH_SIZE) {
            for (Vertex vertex : graph.getVertices(ids.subList(i, Math.min(i + BATCH_SIZE, ids.size())), FetchHints.ALL, job.authorizations)) {
                if (handledProperties(worker, vertex).isEmpty() && job.pending.remove(vertex.getId())) {
                    job.done++;
                }
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
        if (filter.ignoreScope) {
            return query;
        }
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
        copy.ignoreScope = filter.ignoreScope;
        return copy;
    }
}
