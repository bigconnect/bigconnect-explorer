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
package com.mware.web.textHighlighting;

import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.core.model.termMention.TermMentionFor;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public abstract class OffsetItem implements Comparable {
    public static final int VIDEO_TRANSCRIPT_INDEX_BITS = 12;
    public static final int VIDEO_TRANSCRIPT_OFFSET_BITS = 20;

    public abstract long getStart();

    public int getVideoTranscriptEntryIndex() {
        return (int) (getStart() >> VIDEO_TRANSCRIPT_OFFSET_BITS);
    }

    public int getVideoTranscriptEntryOffset(int compacted) {
        int offsetMask = (1 << VIDEO_TRANSCRIPT_INDEX_BITS) - 1;
        return compacted & offsetMask;
    }

    public abstract long getEnd();
    public abstract String getId();
    public abstract String getProcess();
    public abstract void setShouldBitShiftOffsetsForVideoTranscript(boolean shouldBitShiftOffsetsForVideoTranscript);
    public String getOutVertexId() {
        return null;
    }
    public String getResolvedToVertexId() {
        return null;
    }
    public String getResolvedFromTermMentionId() {
        return null;
    }
    public String getResolvedToTermMentionId() {
        return null;
    }
    public String getResolvedToEdgeId() {
        return null;
    }
    public abstract TermMentionFor getTermMentionFor();
    public abstract String getTermMentionForElementId();
    public abstract SandboxStatus getSandboxStatus();
    public abstract String getClassIdentifier();
    public abstract String getConceptName();
    public abstract String getType();
    public abstract String getStyle();
    public abstract Double getScore();

    public JSONObject getInfoJson() {
        try {
            JSONObject infoJson = new JSONObject();
            infoJson.put("id", getId());
            infoJson.put("start", getStart());
            infoJson.put("end", getEnd());
            infoJson.put("outVertexId", getOutVertexId());
            infoJson.put("sandboxStatus", getSandboxStatus().toString());
            if (getResolvedToVertexId() != null) {
                infoJson.put("resolvedToVertexId", getResolvedToVertexId());
            }
            if (getResolvedFromTermMentionId() != null) {
                infoJson.put("resolvedFromTermMentionId", getResolvedFromTermMentionId());
            }
            if (getTermMentionForElementId() != null) {
                infoJson.put("termMentionForElementId", getTermMentionForElementId());
            }
            if (getResolvedToEdgeId() != null) {
                infoJson.put("resolvedToEdgeId", getResolvedToEdgeId());
            }
            if (getTermMentionFor() != null) {
                infoJson.put("termMentionFor", getTermMentionFor().toString());
            }
            if(getProcess() != null) {
                infoJson.put("process", getProcess());
            }
            if(getType() != null) {
                infoJson.put("type", getType());
            }
            if(getType() != null) {
                infoJson.put("score", getScore());
            }
            return infoJson;
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    public List<String> getCssClasses() {
        ArrayList<String> classes = new ArrayList<>();

        if (!"sent".equals(this.getType())) {
            boolean resolved = getResolvedToVertexId() != null && getResolvedToEdgeId() != null;
            if (resolved) {
                classes.add("resolved");
            }

            TermMentionFor termMentionFor = getTermMentionFor();
            boolean resolvable = !resolved && termMentionFor == null;
            if (resolvable) {
                classes.add("resolvable");
            } else if (!resolved) {
                classes.add("jref");
            }
            if (resolvable || resolved) {
                classes.add("res");
            }
        }

        if (getClassIdentifier() != null) {
            classes.add(getClassIdentifier());
        }

        return classes;
    }

    public JSONObject toJson() {
        try {
            JSONObject json = new JSONObject();
            json.put("info", getInfoJson());

            JSONArray cssClasses = new JSONArray();
            for (String cssClass : getCssClasses()) {
                cssClasses.put(cssClass);
            }
            json.put("cssClasses", cssClasses);
            return json;
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    public boolean shouldHighlight() {
        // Hide term mentions resolved to entities
        return getResolvedToTermMentionId() == null;
    }

    public String getTitle() {
        return null;
    }

    @Override
    public String toString() {
        return "id: " + getId() + ", start: " + getStart() + ", end: " + getEnd() + ", title: " + getTitle();
    }

    @Override
    public int compareTo(Object o) {
        if (!(o instanceof OffsetItem)) {
            return -1;
        }

        OffsetItem other = (OffsetItem) o;

        if (getOffset(getStart()) != getOffset(other.getStart())) {
            return getOffset(getStart()) < getOffset(other.getStart()) ? -1 : 1;
        }

        if (getOffset(getEnd()) != getOffset(other.getEnd())) {
            return getOffset(getEnd()) < getOffset(other.getEnd()) ? -1 : 1;
        }

        int termMentionForCompare = TermMentionFor.compare(getTermMentionFor(), other.getTermMentionFor());
        if (termMentionForCompare != 0) {
            return termMentionForCompare;
        }

        if (getResolvedToVertexId() == null && other.getResolvedToVertexId() == null) {
            return 0;
        }

        if (getResolvedToVertexId() == null) {
            return 1;
        }

        if (other.getResolvedToVertexId() == null) {
            return -1;
        }

        return getResolvedToVertexId().compareTo(other.getResolvedToVertexId());
    }

    public static long getOffset(long offset) {
        return offset & ((2 << (VIDEO_TRANSCRIPT_OFFSET_BITS - 1)) - 1L);
    }
}
