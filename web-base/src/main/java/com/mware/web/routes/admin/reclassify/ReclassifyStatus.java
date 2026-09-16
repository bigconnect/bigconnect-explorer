package com.mware.web.routes.admin.reclassify;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import org.json.JSONArray;
import org.json.JSONObject;

/** The latest reclassify jobs, newest first. */
@Singleton
public class ReclassifyStatus implements ParameterizedHandler {
    private final ReclassifyService reclassifyService;

    @Inject
    public ReclassifyStatus(ReclassifyService reclassifyService) {
        this.reclassifyService = reclassifyService;
    }

    @Handle
    public JSONObject handle() {
        JSONArray jobs = new JSONArray();
        for (ReclassifyService.Job job : reclassifyService.getJobs()) {
            jobs.put(job.toJson());
        }
        return new JSONObject().put("jobs", jobs);
    }
}
