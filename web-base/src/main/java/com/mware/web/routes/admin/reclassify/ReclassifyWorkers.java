package com.mware.web.routes.admin.reclassify;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import org.json.JSONObject;

/** The data workers running in this Explorer, which the reprocess page can start. */
@Singleton
public class ReclassifyWorkers implements ParameterizedHandler {
    private final ReclassifyService reclassifyService;

    @Inject
    public ReclassifyWorkers(ReclassifyService reclassifyService) {
        this.reclassifyService = reclassifyService;
    }

    @Handle
    public JSONObject handle() {
        return new JSONObject().put("workers", reclassifyService.workers());
    }
}
