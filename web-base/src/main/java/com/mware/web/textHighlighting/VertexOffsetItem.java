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

import com.google.common.hash.Hashing;
import com.mware.core.model.Name;
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.core.model.properties.BcSchema;
import com.mware.core.model.termMention.TermMentionFor;
import com.mware.core.model.termMention.TermMentionRepository;
import com.mware.core.util.SourceInfoSnippetSanitizer;
import com.mware.ge.Authorizations;
import com.mware.ge.Direction;
import com.mware.ge.Vertex;
import org.json.JSONException;
import org.json.JSONObject;

import static com.google.common.base.Preconditions.checkArgument;
import static com.mware.ge.util.IterableUtils.singleOrDefault;

public class VertexOffsetItem extends OffsetItem {
    private final Vertex termMention;
    private final SandboxStatus sandboxStatus;
    private final Authorizations authorizations;
    private final String classIdentifier;
    private boolean shouldBitShiftOffsetsForVideoTranscript = false;

    public VertexOffsetItem(Vertex termMention, SandboxStatus sandboxStatus, Authorizations authorizations) {
        this.termMention = termMention;
        this.sandboxStatus = sandboxStatus;
        this.authorizations = authorizations;
        this.classIdentifier = "tm-" + Hashing.sha1().hashUnencodedChars(termMention.getId()).toString();

        String[] authArray = this.authorizations.getAuthorizations();
        boolean hasTermMentionAuth = false;
        for (String auth : authArray) {
            if (TermMentionRepository.VISIBILITY_STRING.equals(auth)) {
                hasTermMentionAuth = true;
            }
        }
        checkArgument(hasTermMentionAuth, TermMentionRepository.VISIBILITY_STRING + " is a required auth");
    }

    @Override
    public void setShouldBitShiftOffsetsForVideoTranscript(boolean shouldBitShiftOffsetsForVideoTranscript) {
        this.shouldBitShiftOffsetsForVideoTranscript = shouldBitShiftOffsetsForVideoTranscript;
    }

    @Override
    public long getStart() {
        long start = BcSchema.TERM_MENTION_START_OFFSET.getPropertyValue(termMention, 0);
        if (shouldBitShiftOffsetsForVideoTranscript) {
            return getVideoTranscriptEntryOffset((int) start);
        }
        return start;
    }

    @Override
    public long getEnd() {
        long end = BcSchema.TERM_MENTION_END_OFFSET.getPropertyValue(termMention, 0);
        if (shouldBitShiftOffsetsForVideoTranscript) {
            return getVideoTranscriptEntryOffset((int) end);
        }
        return end;
    }

    public String getConceptName() {
        return BcSchema.TERM_MENTION_CONCEPT_TYPE.getPropertyValue(termMention);
    }

    @Override
    public String getType() {
        return BcSchema.TERM_MENTION_TYPE.getPropertyValue(termMention);
    }

    @Override
    public String getStyle() {
        return BcSchema.TERM_MENTION_STYLE.getPropertyValue(termMention);
    }

    @Override
    public Double getScore() {
        return BcSchema.TERM_MENTION_SCORE.getPropertyValue(termMention);
    }

    public String getSnippet() {
        return SourceInfoSnippetSanitizer.sanitizeSnippet(
                BcSchema.TERM_MENTION_SNIPPET.getPropertyValue(termMention, null)
        );
    }

    @Override
    public String getId() {
        return termMention.getId();
    }

    @Override
    public String getProcess() {
        String process = BcSchema.TERM_MENTION_PROCESS.getPropertyValue(termMention);
        if (process == null) {
            return null;
        }

        try {
            Class cls = Class.forName(process);
            Name nameAnnotation = (Name) cls.getAnnotation(Name.class);
            if (nameAnnotation != null) {
                return nameAnnotation.value();
            }
            return cls.getSimpleName();
        } catch (ClassNotFoundException cnf) {
            return process;
        }
    }

    @Override
    public String getOutVertexId() {
        return singleOrDefault(termMention.getVertexIds(Direction.IN, BcSchema.TERM_MENTION_LABEL_HAS_TERM_MENTION, this.authorizations), null);
    }

    @Override
    public String getResolvedToVertexId() {
        return singleOrDefault(termMention.getVertexIds(Direction.OUT, BcSchema.TERM_MENTION_LABEL_RESOLVED_TO, this.authorizations), null);
    }

    @Override
    public String getResolvedFromTermMentionId() {
        return singleOrDefault(termMention.getVertexIds(Direction.OUT, BcSchema.TERM_MENTION_RESOLVED_FROM, this.authorizations), null);
    }

    @Override
    public String getResolvedToTermMentionId() {
        return singleOrDefault(termMention.getVertexIds(Direction.IN, BcSchema.TERM_MENTION_RESOLVED_FROM, this.authorizations), null);
    }

    @Override
    public String getResolvedToEdgeId() {
        return BcSchema.TERM_MENTION_RESOLVED_EDGE_ID.getPropertyValue(termMention);
    }

    @Override
    public TermMentionFor getTermMentionFor() {
        return BcSchema.TERM_MENTION_FOR_TYPE.getPropertyValue(termMention);
    }

    @Override
    public String getTermMentionForElementId() {
        return BcSchema.TERM_MENTION_FOR_ELEMENT_ID.getPropertyValue(termMention);
    }

    @Override
    public SandboxStatus getSandboxStatus() {
        return sandboxStatus;
    }

    @Override
    public String getClassIdentifier() {
        return classIdentifier;
    }

    public String getTitle() {
        return BcSchema.TERM_MENTION_TITLE.getPropertyValue(termMention);
    }

    @Override
    public boolean shouldHighlight() {
        if (!super.shouldHighlight()) {
            return false;
        }
        return true;
    }

    @Override
    public JSONObject getInfoJson() {
        try {
            JSONObject infoJson = super.getInfoJson();
            infoJson.put("title", getTitle());
            infoJson.putOpt("conceptType", getConceptName());
            infoJson.putOpt("snippet", getSnippet());
            return infoJson;
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
}
