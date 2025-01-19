package com.mware.web.routes.webui;

import com.google.inject.Inject;
import com.mware.core.config.Configuration;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.json.JSONObject;

public class StaticUrlGet implements ParameterizedHandler {
    public static final String STATIC_URL = "webui-static.url";
    private final Configuration configuration;

    @Inject
    public StaticUrlGet(Configuration configuration) {
        this.configuration = configuration;
    }

    @Handle
    public JSONObject handle() throws Exception {
        String url = configuration.get(STATIC_URL, "");

        JSONObject json = new JSONObject();
        json.put("url", url);
        return json;
    }
}