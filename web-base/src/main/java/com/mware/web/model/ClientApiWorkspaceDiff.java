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
package com.mware.web.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.JsonNode;
import com.mware.core.model.clientapi.dto.ClientApiObject;
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.core.model.clientapi.util.ClientApiConverter;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.ArrayList;
import java.util.List;

public class ClientApiWorkspaceDiff implements ClientApiObject {
    private List<Item> diffs = new ArrayList<>();

    public void addAll(List<Item> diffs) {
        this.diffs.addAll(diffs);
    }

    public List<Item> getDiffs() {
        return diffs;
    }

    @Override
    public String toString() {
        return ClientApiConverter.clientApiToString(this);
    }

    @JsonTypeInfo(
            use = JsonTypeInfo.Id.NAME,
            include = JsonTypeInfo.As.PROPERTY,
            property = "type")
    @JsonSubTypes({
            @JsonSubTypes.Type(value = VertexItem.class, name = "VertexDiffItem"),
            @JsonSubTypes.Type(value = EdgeItem.class, name = "EdgeDiffItem"),
            @JsonSubTypes.Type(value = PropertyItem.class, name = "PropertyDiffItem")
    })
    @Getter
    @AllArgsConstructor
    public abstract static class Item {
        private final String type;
        private final SandboxStatus sandboxStatus;
        private boolean deleted;

        @Override
        public String toString() {
            return ClientApiConverter.clientApiToString(this);
        }
    }

    @Getter
    public static class EdgeItem extends Item {
        private String edgeId;
        private String label;
        private String outVertexId;
        private String inVertexId;
        private JsonNode visibilityJson;

        public EdgeItem() {
            super("EdgeDiffItem", SandboxStatus.PRIVATE, false);
        }

        public EdgeItem(
                String edgeId, String label, String outVertexId, String inVertexId, JsonNode visibilityJson,
                SandboxStatus sandboxStatus, boolean deleted) {
            super("EdgeDiffItem", sandboxStatus, deleted);
            this.edgeId = edgeId;
            this.label = label;
            this.outVertexId = outVertexId;
            this.inVertexId = inVertexId;
            this.visibilityJson = visibilityJson;
        }
    }

    @Getter
    public static class VertexItem extends Item {
        private String vertexId;
        private JsonNode visibilityJson;
        private String title;
        private String conceptType;

        public VertexItem() {
            super("VertexDiffItem", SandboxStatus.PRIVATE, false);
        }

        public VertexItem(
                String vertexId,
                String title,
                String conceptType,
                JsonNode visibilityJson,
                SandboxStatus sandboxStatus,
                boolean deleted
        ) {
            super("VertexDiffItem", sandboxStatus, deleted);
            this.vertexId = vertexId;
            this.visibilityJson = visibilityJson;
            this.title = title;
            this.conceptType = conceptType;
        }
    }

    @Getter
    public static class PropertyItem extends Item {
        private String elementType;
        private String elementId;
        private String elementConcept = null;
        private String inVertexId = null;
        private String outVertexId = null;
        private String name;
        private String key;
        private String visibilityString;
        @JsonProperty("old")
        private JsonNode oldData;

        @JsonProperty("new")
        private JsonNode newData;

        public PropertyItem() {
            super("PropertyDiffItem", SandboxStatus.PRIVATE, false);
        }

        public PropertyItem(
                String elementType,
                String elementId,
                String elementConcept,
                String name,
                String key,
                JsonNode oldData,
                JsonNode newData,
                SandboxStatus sandboxStatus,
                boolean deleted,
                String visibilityString
        ) {
            super("PropertyDiffItem", sandboxStatus, deleted);
            this.elementType = elementType;
            this.elementId = elementId;
            this.elementConcept = elementConcept;
            this.name = name;
            this.key = key;
            this.oldData = oldData;
            this.newData = newData;
            this.visibilityString = visibilityString;
        }

        public PropertyItem(
                String elementType,
                String elementId,
                String label,
                String outVertexId,
                String inVertexId,
                String name,
                String key,
                JsonNode oldData,
                JsonNode newData,
                SandboxStatus sandboxStatus,
                boolean deleted,
                String visibilityString
        ) {
            super("PropertyDiffItem", sandboxStatus, deleted);
            this.elementType = elementType;
            this.elementId = elementId;
            this.elementConcept = label;
            this.inVertexId = inVertexId;
            this.outVertexId = outVertexId;
            this.name = name;
            this.key = key;
            this.oldData = oldData;
            this.newData = newData;
            this.visibilityString = visibilityString;
        }
    }
}
