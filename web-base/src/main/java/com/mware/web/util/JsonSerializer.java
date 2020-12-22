/*
 * This file is part of the BigConnect project.
 *
 * Copyright (c) 2013-2020 MWARE SOLUTIONS SRL
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation with the addition of the
 * following permission added to Section 15 as permitted in Section 7(a):
 * FOR ANY PART OF THE COVERED WORK IN WHICH THE COPYRIGHT IS OWNED BY
 * MWARE SOLUTIONS SRL, MWARE SOLUTIONS SRL DISCLAIMS THE WARRANTY OF
 * NON INFRINGEMENT OF THIRD PARTY RIGHTS
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 * You should have received a copy of the GNU Affero General Public License
 * along with this program; if not, see http://www.gnu.org/licenses or write to
 * the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
 * Boston, MA, 02110-1301 USA, or download the license from the following URL:
 * https://www.gnu.org/licenses/agpl-3.0.txt
 *
 * The interactive user interfaces in modified source and object code versions
 * of this program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU Affero General Public License.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the BigConnect software without
 * disclosing the source code of your own applications.
 *
 * These activities include: offering paid services to customers as an ASP,
 * embedding the product in a web application, shipping BigConnect with a
 * closed source product.
 */
package com.mware.web.util;

import com.mware.core.ingest.video.VideoFrameInfo;
import com.mware.core.ingest.video.VideoPropertyHelper;
import com.mware.core.ingest.video.VideoTranscript;
import com.mware.core.model.PropertyJustificationMetadata;
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.core.model.clientapi.dto.VisibilityJson;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.properties.MediaBcSchema;
import com.mware.core.util.SandboxStatusUtil;
import com.mware.ge.*;
import com.mware.ge.type.GeoPoint;
import com.mware.ge.values.storable.*;
import org.apache.commons.io.IOUtils;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.Date;
import java.util.List;

import static com.google.common.base.Preconditions.checkNotNull;
import static com.mware.ge.util.IterableUtils.toList;

public class JsonSerializer {
    public static JSONArray toJson(Iterable<? extends Element> elements, String workspaceId, Authorizations authorizations) {
        JSONArray result = new JSONArray();
        for (Element element : elements) {
            result.put(toJson(element, workspaceId, authorizations));
        }
        return result;
    }

    public static JSONObject toJson(Element element, String workspaceId, Authorizations authorizations) {
        checkNotNull(element, "element cannot be null");
        if (element instanceof Vertex) {
            return toJsonVertex((Vertex) element, workspaceId, authorizations);
        }
        if (element instanceof Edge) {
            return toJsonEdge((Edge) element, workspaceId);
        }
        throw new RuntimeException("Unexpected element type: " + element.getClass().getName());
    }

    public static JSONObject toJsonVertex(Vertex vertex, String workspaceId, Authorizations authorizations) {
        try {
            JSONObject json = toJsonElement(vertex, workspaceId);
            JSONArray vertexEdgeLabelsJson = getVertexEdgeLabelsJson(vertex, authorizations);
            if (vertexEdgeLabelsJson != null) {
                json.put("edgeLabels", vertexEdgeLabelsJson);
            }
            return json;
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    private static JSONArray getVertexEdgeLabelsJson(Vertex vertex, Authorizations authorizations) {
        if (authorizations == null) {
            return null;
        }
        Iterable<String> edgeLabels = vertex.getEdgeLabels(Direction.BOTH, authorizations);
        JSONArray result = new JSONArray();
        for (String edgeLabel : edgeLabels) {
            result.put(edgeLabel);
        }
        return result;
    }

    public static JSONObject toJsonEdge(Edge edge, String workspaceId) {
        try {
            JSONObject json = toJsonElement(edge, workspaceId);
            json.put("label", edge.getLabel());
            json.put("outVertexId", edge.getVertexId(Direction.OUT));
            json.put("inVertexId", edge.getVertexId(Direction.IN));
            return json;
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    public static JSONObject toJsonElement(Element element, String workspaceId) {
        JSONObject json = new JSONObject();
        json.put("id", element.getId());
        json.put("properties", toJsonProperties(element.getProperties(), workspaceId));
        json.put("sandboxStatus", SandboxStatusUtil.getSandboxStatus(element, workspaceId).toString());
        VisibilityJson visibilityJson = BcSchema.VISIBILITY_JSON.getPropertyValue(element);
        if (visibilityJson != null) {
            json.put("visibilitySource", visibilityJson.getSource());
        }

        return json;
    }

    public static JSONArray toJsonProperties(Iterable<Property> properties, String workspaceId) {
        JSONArray resultsJson = new JSONArray();
        List<Property> propertiesList = toList(properties);
        SandboxStatus[] sandboxStatuses = SandboxStatusUtil.getPropertySandboxStatuses(propertiesList, workspaceId);
        for (int i = 0; i < propertiesList.size(); i++) {
            Property property = propertiesList.get(i);
            String sandboxStatus = sandboxStatuses[i].toString();
            VideoFrameInfo videoFrameInfo;
            if ((videoFrameInfo = VideoPropertyHelper.getVideoFrameInfoFromProperty(property)) != null) {
                String textDescription = BcSchema.TEXT_DESCRIPTION_METADATA.getMetadataValueOrDefault(property.getMetadata(), null);
                addVideoFramePropertyToResults(resultsJson, videoFrameInfo.getPropertyKey(), textDescription, sandboxStatus);
            } else {
                JSONObject propertyJson = toJsonProperty(property);
                propertyJson.put("sandboxStatus", sandboxStatus);
                resultsJson.put(propertyJson);
            }
        }

        return resultsJson;
    }


    public static VideoTranscript getSynthesisedVideoTranscription(Vertex artifactVertex, String propertyKey) throws IOException {
        VideoTranscript videoTranscript = new VideoTranscript();
        for (Property property : artifactVertex.getProperties()) {
            VideoFrameInfo videoFrameInfo = VideoPropertyHelper.getVideoFrameInfoFromProperty(property);
            if (videoFrameInfo == null) {
                continue;
            }
            if (videoFrameInfo.getPropertyKey().equals(propertyKey)) {
                Object value = property.getValue();
                String text;
                if (value instanceof StreamingPropertyValue) {
                    text = IOUtils.toString(((StreamingPropertyValue) value).getInputStream());
                } else {
                    text = value.toString();
                }
                videoTranscript.add(new VideoTranscript.Time(videoFrameInfo.getFrameStartTime(), videoFrameInfo.getFrameEndTime()), text);
            }
        }
        if (videoTranscript.getEntries().size() > 0) {
            return videoTranscript;
        }
        return null;
    }

    private static void addVideoFramePropertyToResults(JSONArray resultsJson, String propertyKey, String textDescription, String sandboxStatus) {
        JSONObject json = findProperty(resultsJson, MediaBcSchema.VIDEO_TRANSCRIPT.getPropertyName(), propertyKey);
        if (json == null) {
            json = new JSONObject();
            json.put("key", propertyKey);
            json.put("name", MediaBcSchema.VIDEO_TRANSCRIPT.getPropertyName());
            json.put("sandboxStatus", sandboxStatus);
            json.put(BcSchema.TEXT_DESCRIPTION_METADATA.getMetadataKey(), textDescription);
            json.put("streamingPropertyValue", true);
            resultsJson.put(json);
        }
    }

    private static JSONObject findProperty(JSONArray resultsJson, String propertyName, String propertyKey) {
        for (int i = 0; i < resultsJson.length(); i++) {
            JSONObject json = resultsJson.getJSONObject(i);
            if (json.getString("name").equals(propertyName)
                    && json.getString("key").equals(propertyKey)) {
                return json;
            }
        }
        return null;
    }

    public static JSONObject toJsonProperty(Property property) {
        checkNotNull(property, "property cannot be null");
        JSONObject result = new JSONObject();
        result.put("key", property.getKey());
        result.put("name", property.getName());

        Value propertyValue = property.getValue();
        if (propertyValue instanceof StreamingPropertyValue) {
            result.put("streamingPropertyValue", true);
        } else {
            result.put("value", toJsonValue(property.getName(), propertyValue));
        }

        for (Metadata.Entry metadataEntry : property.getMetadata().entrySet()) {
            result.put(metadataEntry.getKey(), toJsonValue(metadataEntry.getKey(), metadataEntry.getValue()));
        }

        return result;
    }

    private static Object toJsonValue(String propertyName, Value value) {
        if (value instanceof GeoPointValue) {
            GeoPoint geoPoint = (GeoPoint) ((GeoPointValue) value).asObjectCopy();
            JSONObject result = new JSONObject();
            result.put("latitude", geoPoint.getLatitude());
            result.put("longitude", geoPoint.getLongitude());
            if (geoPoint.getAltitude() != null) {
                result.put("altitude", geoPoint.getAltitude());
            }
            return result;
        } else if (value instanceof DateTimeValue) {
            return ((DateTimeValue) value).asObjectCopy().toInstant().toEpochMilli();
        } else if (BcSchema.JUSTIFICATION_METADATA.getMetadataKey().equals(propertyName)) {
            return PropertyJustificationMetadata.toJson(((TextValue)value).stringValue());
        } else if (value instanceof TextValue) {
            try {
                String valueString = ((TextValue) value).stringValue();
                valueString = valueString.trim();
                if (valueString.startsWith("{") && valueString.endsWith("}")) {
                    return new JSONObject(valueString);
                } else {
                    return valueString;
                }
            } catch (Exception ex) {
                // ignore this exception it just mean the string wasn't really json
            }
        }
        return value.asObjectCopy();
    }
}
