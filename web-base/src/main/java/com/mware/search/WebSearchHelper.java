package com.mware.search;

import com.mware.core.model.search.VertexSearchRunner;

public class WebSearchHelper {
    public static boolean isCypherRunner(String searchRunnerUrl) {
        return CypherSearchRunner.URI.equals(searchRunnerUrl);
    }

    public static boolean isVertexRunner(String searchRunnerUrl) {
        return VertexSearchRunner.URI.equals(searchRunnerUrl);
    }
}
