package com.mware.web.routes.admin.reclassify;

import com.google.inject.Singleton;
import com.mware.core.bootstrap.InjectHelper;
import com.mware.core.ingest.dataworker.DataWorker;
import com.mware.core.ingest.dataworker.DataWorkerRunner;
import com.mware.core.ingest.dataworker.DataWorkerThreadedWrapper;
import com.mware.core.model.Description;
import com.mware.core.model.Name;
import com.mware.core.process.DataWorkerRunnerProcess;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ge.Element;
import com.mware.ge.Property;
import org.json.JSONArray;
import org.json.JSONObject;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The data workers running in this Explorer, as prepared instances: asking them whether they handle a property of a
 * post answers exactly which workers a re-queued property will start.
 */
@Singleton
public class DataWorkerCatalog {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(DataWorkerCatalog.class);

    /** One prepared instance per worker class, in the order the runner calls them. */
    public Map<String, DataWorker> workers() {
        Map<String, DataWorker> workers = new LinkedHashMap<>();
        try {
            for (DataWorkerRunner runner : InjectHelper.getInstance(DataWorkerRunnerProcess.class).getDataWorkerRunners()) {
                for (DataWorkerThreadedWrapper wrapper : wrappers(runner)) {
                    workers.putIfAbsent(wrapper.getWorker().getClass().getName(), wrapper.getWorker());
                }
            }
        } catch (Exception e) {
            LOGGER.error("Could not list the running data workers", e);
        }
        return workers;
    }

    public JSONArray toJson() {
        JSONArray result = new JSONArray();
        for (Map.Entry<String, DataWorker> entry : workers().entrySet()) {
            result.put(new JSONObject()
                    .put("className", entry.getKey())
                    .put("name", name(entry.getValue()))
                    .put("description", description(entry.getValue())));
        }
        return result;
    }

    /** Workers that start when this property (or the element, for a null property) is queued. */
    public List<String> handling(Map<String, DataWorker> workers, Element element, Property property) {
        List<String> names = new ArrayList<>();
        for (Map.Entry<String, DataWorker> entry : workers.entrySet()) {
            try {
                if (entry.getValue().isHandled(element, property)) {
                    names.add(entry.getKey());
                }
            } catch (Exception e) {
                LOGGER.debug("isHandled of %s failed on %s", entry.getKey(), element.getId(), e);
            }
        }
        return names;
    }

    public static String name(DataWorker worker) {
        Name name = worker.getClass().getAnnotation(Name.class);
        return name != null ? name.value() : worker.getClass().getSimpleName();
    }

    private static String description(DataWorker worker) {
        Description description = worker.getClass().getAnnotation(Description.class);
        return description != null ? description.value() : "";
    }

    @SuppressWarnings("unchecked")
    private static List<DataWorkerThreadedWrapper> wrappers(DataWorkerRunner runner) throws ReflectiveOperationException {
        // the runner does not expose its workers
        Field field = DataWorkerRunner.class.getDeclaredField("workerWrappers");
        field.setAccessible(true);
        Object value = field.get(runner);
        return value == null ? Collections.emptyList() : new ArrayList<>((List<DataWorkerThreadedWrapper>) value);
    }
}
