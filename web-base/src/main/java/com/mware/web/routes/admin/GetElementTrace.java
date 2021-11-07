package com.mware.web.routes.admin;

import com.google.inject.Inject;
import com.mware.core.trace.ElementTraceInfo;
import com.mware.core.trace.ElementTracer;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class GetElementTrace implements ParameterizedHandler {
    private ElementTracer elementTracer;

    @Inject
    public GetElementTrace(ElementTracer elementTracer) {
        this.elementTracer = elementTracer;
    }

    @Handle
    public JSONObject handle(
            @Required(name = "eid") String elementId
    ) throws Exception {
        List<ElementTraceInfo> traces = elementTracer.getTraces(elementId);
        traces.sort(Comparator.comparingLong(ElementTraceInfo::getTimestamp));

        List<JSONObject> jj = new ArrayList<>();
        for (ElementTraceInfo trace : traces) {
            jj.add(new JSONObject(trace));
        }

        JSONObject json = new JSONObject();
        json.put("traces", jj);
        return json;
    }
}
