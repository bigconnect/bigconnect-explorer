package com.mware.web.routes.admin.reclassify;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.ge.Authorizations;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import org.json.JSONObject;

@Singleton
public class ReclassifyPreview implements ParameterizedHandler {
    private final ReclassifyService reclassifyService;

    @Inject
    public ReclassifyPreview(ReclassifyService reclassifyService) {
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
            @Optional(name = "action", defaultValue = "TOPICS") String action,
            @Optional(name = "worker") String worker,
            Authorizations authorizations
    ) {
        ReclassifyService.Action parsedAction = ReclassifyFilters.action(action);
        ReclassifyService.Filter filter = ReclassifyFilters.parse(concepts, keywords, buckets, projects, from, to, scope, parsedAction);
        if (parsedAction == ReclassifyService.Action.WORKER) {
            return reclassifyService.previewWorker(filter, worker, authorizations);
        }
        return reclassifyService.preview(filter, parsedAction, authorizations);
    }
}
