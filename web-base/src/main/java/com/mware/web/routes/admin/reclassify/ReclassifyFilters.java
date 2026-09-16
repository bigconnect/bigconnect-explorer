package com.mware.web.routes.admin.reclassify;

import org.apache.commons.lang3.StringUtils;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

final class ReclassifyFilters {
    private ReclassifyFilters() {
    }

    /** Dates are yyyy-MM-dd, UTC; "to" includes the whole day. */
    static ReclassifyService.Action action(String action) {
        return ReclassifyService.Action.valueOf(action.trim().toUpperCase());
    }

    static ReclassifyService.Filter parse(String[] concepts, String[] keywords, String[] buckets, String[] projects,
                                          String from, String to, String scope, ReclassifyService.Action action) {
        ReclassifyService.Filter filter = new ReclassifyService.Filter();
        // the classification status only matters to the classification actions
        filter.ignoreScope = action == ReclassifyService.Action.WORKER;
        List<String> conceptList = values(concepts);
        if (!conceptList.isEmpty()) {
            filter.concepts = conceptList;
        }
        filter.keywords = values(keywords);
        filter.buckets = values(buckets);
        filter.projects = values(projects);
        if (StringUtils.isNotBlank(from)) {
            filter.fromMillis = LocalDate.parse(from.trim()).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
        }
        if (StringUtils.isNotBlank(to)) {
            filter.toMillis = LocalDate.parse(to.trim()).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
        }
        if (StringUtils.isNotBlank(scope)) {
            filter.scope = ReclassifyService.Scope.valueOf(scope.trim().toUpperCase());
        }
        return filter;
    }

    private static List<String> values(String[] values) {
        List<String> result = new ArrayList<>();
        if (values != null) {
            for (String value : values) {
                if (StringUtils.isNotBlank(value)) {
                    result.add(value);
                }
            }
        }
        return result;
    }
}
