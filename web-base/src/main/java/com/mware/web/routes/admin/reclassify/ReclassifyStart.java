package com.mware.web.routes.admin.reclassify;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.workQueue.Priority;
import com.mware.ge.Authorizations;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import org.json.JSONObject;

@Singleton
public class ReclassifyStart implements ParameterizedHandler {
    private final ReclassifyService reclassifyService;

    @Inject
    public ReclassifyStart(ReclassifyService reclassifyService) {
        this.reclassifyService = reclassifyService;
    }

    @Handle
    public JSONObject handle(
            @Optional(name = "concepts[]") String[] concepts,
            @Optional(name = "keywords[]") String[] keywords,
            @Optional(name = "buckets[]") String[] buckets,
            @Optional(name = "projects[]") String[] projects,
            @Optional(name = "from") String from,
            @Optional(name = "to") String to,
            @Optional(name = "scope") String scope,
            @Required(name = "action") String action,
            @Optional(name = "worker") String worker,
            @Optional(name = "priority", defaultValue = "LOW") String priority,
            @Optional(name = "limit") Integer limit,
            Authorizations authorizations
    ) {
        ReclassifyService.Action parsedAction = ReclassifyFilters.action(action);
        ReclassifyService.Filter filter = ReclassifyFilters.parse(concepts, keywords, buckets, projects, from, to, scope, parsedAction);
        ReclassifyService.Job job = reclassifyService.start(filter, parsedAction, worker, Priority.safeParse(priority), limit,
                authorizations);
        return job.toJson();
    }
}
