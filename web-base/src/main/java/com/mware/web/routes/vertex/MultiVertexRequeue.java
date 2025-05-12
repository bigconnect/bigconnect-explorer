package com.mware.web.routes.vertex;

import com.google.inject.Inject;
import com.mware.core.ingest.dataworker.ElementOrPropertyStatus;
import com.mware.core.model.workQueue.Priority;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.model.workQueue.WorkQueueRepository;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.ge.Property;
import com.mware.ge.Vertex;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import org.apache.commons.lang.StringUtils;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;

public class MultiVertexRequeue implements ParameterizedHandler {
    private final Graph graph;
    private final WorkQueueRepository workQueueRepository;
    private final WebQueueRepository webQueueRepository;

    @Inject
    public MultiVertexRequeue(
            Graph graph,
            WorkQueueRepository workQueueRepository,
            WebQueueRepository webQueueRepository
    ) {
        this.graph = graph;
        this.workQueueRepository = workQueueRepository;
        this.webQueueRepository = webQueueRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            @Optional(name = "concept") String conceptType,
            @Optional(name = "property") String propertyName,
            @Optional(name = "currentYear", defaultValue = "false") boolean currentYear,
            @Optional(name = "priority", defaultValue = "LOW") String requeuePriority,
            Authorizations authorizations,
            @ActiveWorkspaceId String workspaceId
    ) throws Exception {
        Iterable<Vertex> vertices;

        if (!StringUtils.isEmpty(conceptType)) {
            vertices = graph.query(authorizations).hasConceptType(conceptType).vertices();
        } else {
            vertices = graph.getVertices(authorizations);
        }

        long startOfYearTimestamp = 0;
        if (currentYear) {
            final Calendar calendar = Calendar.getInstance();
            int year = calendar.get(Calendar.YEAR);
            // Modified code to keep timestamp in milliseconds
            calendar.set(year, Calendar.JANUARY, 1, 0, 0, 0);
            calendar.set(Calendar.MILLISECOND, 0);
            startOfYearTimestamp = calendar.getTimeInMillis();
        }

        Priority priority = Priority.safeParse(requeuePriority);

        int totalVertices = 0;
        int processedVertices = 0;

        // Count total vertices first
        for (Vertex v : vertices) {
            totalVertices++;
        }

        // Now process with filtering
        final long finalStartOfYearTimestamp = startOfYearTimestamp;
        for (Vertex v : vertices) {
            boolean shouldProcess = true;

            if (currentYear) {
                Property lastModified = v.getProperty("last_modified");
                if (lastModified != null) {
                    Object value = lastModified.getValue();
                    long lastModifiedTimestamp = 0;

                    // Properly handle Long values
                    if (value instanceof Long) {
                        lastModifiedTimestamp = (Long) value;
                        shouldProcess = lastModifiedTimestamp >= finalStartOfYearTimestamp;
                    } else if (value != null && value.toString().startsWith("Long(")) {
                        // Handle the "Long(1744218757762)" format
                        String valueStr = value.toString();
                        try {
                            // Extract the number from inside Long(...)
                            String numberPart = valueStr.substring(5, valueStr.length() - 1);
                            lastModifiedTimestamp = Long.parseLong(numberPart);
                            shouldProcess = lastModifiedTimestamp >= finalStartOfYearTimestamp;
                        } catch (Exception e) {
                            System.out.println("Error parsing Long value: " + valueStr + " - " + e.getMessage());
                            shouldProcess = false;
                        }
                    } else if (value instanceof Number) {
                        lastModifiedTimestamp = ((Number) value).longValue();
                        shouldProcess = lastModifiedTimestamp >= finalStartOfYearTimestamp;
                    } else {
                        shouldProcess = false;
                    }
                } else {
                    shouldProcess = false;
                }
            }

            if (shouldProcess) {
                processedVertices++;
                if (StringUtils.isEmpty(propertyName)) {
                    webQueueRepository.broadcastPropertyChange(v, null, null, workspaceId);
                    workQueueRepository.pushOnDwQueue(
                            v,
                            null,
                            null,
                            workspaceId,
                            null,
                            priority,
                            ElementOrPropertyStatus.UPDATE,
                            null
                    );
                } else {
                    Iterable<Property> properties = v.getProperties(propertyName);
                    boolean hasProperties = false;
                    for (Property property : properties) {
                        hasProperties = true;
                        webQueueRepository.broadcastPropertyChange(v, property.getKey(), property.getName(), workspaceId);
                        workQueueRepository.pushOnDwQueue(
                                v,
                                property.getKey(),
                                property.getName(),
                                workspaceId,
                                null,
                                priority,
                                ElementOrPropertyStatus.UPDATE,
                                null
                        );
                    }
                }
            }
        }

        System.out.println("Successfully sent " + processedVertices + " out of " + totalVertices + " vertices to requeue");

        return BcResponse.SUCCESS;
    }
}
