package com.mware.web.routes.admin.reclassify;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import org.json.JSONObject;

@Singleton
public class ReclassifyCancel implements ParameterizedHandler {
    private final ReclassifyService reclassifyService;

    @Inject
    public ReclassifyCancel(ReclassifyService reclassifyService) {
        this.reclassifyService = reclassifyService;
    }

    @Handle
    public JSONObject handle(@Required(name = "id") String id) {
        return new JSONObject().put("cancelled", reclassifyService.cancel(id));
    }
}
