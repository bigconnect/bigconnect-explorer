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

import com.mware.core.exception.BcException;
import com.mware.core.ingest.video.VideoFrameInfo;
import com.mware.core.ingest.video.VideoPropertyHelper;
import com.mware.core.ingest.video.VideoTranscript;
import com.mware.core.model.clientapi.dto.SandboxStatus;
import com.mware.ge.Authorizations;
import com.mware.ge.Vertex;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;
import org.apache.commons.lang3.StringEscapeUtils;
import org.json.JSONObject;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class EntityHighlighter {
    private static final int KB = 1024;
    public static final int BUFFER_SIZE = 500 * KB;

    public enum Options {
        IncludeStyle
    }

    public static final EnumSet<Options> DefaultOptions = EnumSet.of(Options.IncludeStyle);

    public void transformHighlightedText(InputStream text, OutputStream output, Iterable<Vertex> termMentions, String workspaceId, Authorizations authorizations) {
        List<OffsetItem> offsetItems = convertTermMentionsToOffsetItems(termMentions, workspaceId, authorizations);
        transformToHighlightedText(text, output, offsetItems);
    }

    public static String getHighlightedText(String text, List<OffsetItem> offsetItems) {
        return getHighlightedText(text, offsetItems, null);
    }

    public static String getHighlightedText(String text, List<OffsetItem> offsetItems, EnumSet<Options> options) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            transformToHighlightedText(IOUtils.toInputStream(text, StandardCharsets.UTF_8.name()), out, offsetItems, options);
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (IOException e) {
            throw new BcException("Unable to transform to highlighted text", e);
        }
    }

    public static void transformToHighlightedText(InputStream text, OutputStream output, List<OffsetItem> offsetItems) {
        transformToHighlightedText(text, output, offsetItems, DefaultOptions);
    }

    public static void transformToHighlightedText(InputStream text, OutputStream output, List<OffsetItem> offsetItems, EnumSet<Options> options) {
        try (
                InputStreamReader in = new InputStreamReader(text);
                OutputStream filteredSpaces = new NonBreakingSpaceFilteredOutputStream(output);
                OutputStreamWriter out = new OutputStreamWriter(filteredSpaces);
        ) {
            if (offsetItems == null) {
                offsetItems = new ArrayList<>();
            }
            List<OffsetItem> started = new ArrayList<>();
            List<OffsetItem> items = offsetItems.stream()
                    .filter(offsetItem -> offsetItem.shouldHighlight())
                    .sorted((o1, o2) -> {
                        long c;
                        c = o1.getStart() - o2.getStart();
                        if (c == 0)
                            c = o2.getEnd() - o1.getEnd();
                        return c > 0 ? 1 : c < 0 ? -1 : 0;
                    })
                    .collect(Collectors.toList());

            if (options == null) {
                options = DefaultOptions;
            }

            char buffer[] = new char[BUFFER_SIZE];
            int offset = 0;
            int maxDepth = 0;

            do {
                int len = in.read(buffer, 0, BUFFER_SIZE);
                if (len == -1) {
                    break;
                } else {
                    int innerOffset = 0;

                    Iterator<OffsetItem> itemsIterator = items.iterator();
                    List<OffsetItem> toRemove = new ArrayList<>();

                    // Open tags in buffer
                    while (itemsIterator.hasNext()) {
                        OffsetItem item = itemsIterator.next();

                        long start = item.getStart();
                        if (indexInsideCurrentBuffer(start, offset, innerOffset, len)) {

                            // Close
                            started.sort((o1, o2) -> {
                                long c = o1.getEnd() - o2.getEnd();
                                return c > 0 ? 1 : c < 0 ? -1 : 0;
                            });
                            Iterator<OffsetItem> others = started.iterator();
                            while (others.hasNext()) {
                                OffsetItem otherItem = others.next();
                                if (otherItem != item) {
                                    long end = otherItem.getEnd();
                                    if (end < start) {
                                        innerOffset = getInnerOffset(out, started, items, toRemove, buffer, offset, innerOffset, others, otherItem, (int) end);
                                    }
                                }
                            }

                            innerOffset = writePrefixToIndex(started, items, out, (int) start, offset, innerOffset, buffer);
                            addOffsetItemSpan(out, started, items, item, true);
                            started.add(item);
                            maxDepth = Math.max(maxDepth, started.size());
                        }
                    }

                    items.removeAll(toRemove);

                    // Close tags in buffer
                    started.sort((o1, o2) -> {
                        long c = o1.getEnd() - o2.getEnd();
                        if (c == 0)
                            c = o2.getStart() - o1.getStart();
                        return c > 0 ? 1 : c < 0 ? -1 : 0;
                    });
                    Iterator<OffsetItem> openedIterator = started.iterator();
                    while (openedIterator.hasNext()) {
                        OffsetItem opened = openedIterator.next();
                        long end = opened.getEnd();
                        if (indexInsideCurrentBuffer(end, offset, innerOffset, len)) {
                            innerOffset = getInnerOffset(out, started, items, items, buffer, offset, innerOffset, openedIterator, opened, (int) end);
                        }
                    }

                    if (innerOffset < len) {
                        writeBuffer(started, items, out, buffer, innerOffset, len - innerOffset);
                    }
                    offset += len;
                }
            } while (true);

            if (options.contains(Options.IncludeStyle)) {
                writeStyle(out, maxDepth);
            }

        } catch (IOException e) {
            throw new BcException("Unable to transform to highlighted text", e);
        }
    }

    private static void writeStyle(OutputStreamWriter out, int maxDepth) throws IOException {
        out.write("<style>");
        StringBuilder selector = new StringBuilder(".text");
        int outset = 0;
        int lineHeight = 18;
        for (int depth = 1; depth <= maxDepth; depth++) {
            selector.append(" .res");
            out.write(selector.toString());
            out.write("{");
            out.write("border-image-outset: 0 0 " + outset + "px 0;");
            if (depth == 1) {
                out.write("border-bottom: 1px solid black;");
                out.write("border-image-source: linear-gradient(to right, black, black);");
                out.write("border-image-slice: 0 0 1 0;");
                out.write("border-image-width: 0 0 1px 0;");
                out.write("border-image-repeat: repeat;");
            }
            if (depth > 1) {
                double lineHeightDec = (double)lineHeight / 10;
                out.write("line-height: " + lineHeightDec + ";");
            }
            out.write("}");
            if (depth == 1) {
                out.write(selector + ".resolvable");
                out.write("{");
                out.write("border-image-source: repeating-linear-gradient(to right, transparent, transparent 1px, rgb(0,0,0) 1px, rgb(0,0,0) 3px);");
                out.write("}");
            }
            if (depth >= 2) {
                lineHeight += 1;
            }
            outset += 2;
        }
        out.write("</style>");
    }

    private static int getInnerOffset(OutputStreamWriter out, List<OffsetItem> started, List<OffsetItem> all, List<OffsetItem> toRemove, char[] buffer, int offset, int innerOffset, Iterator<OffsetItem> removeIterator, OffsetItem opened, int end) throws IOException {
        innerOffset = writePrefixToIndex(started, all, out, end, offset, innerOffset, buffer);

        removeIterator.remove();
        toRemove.remove(opened);

        // Close other tags that are opened
        List toClose = started.stream().filter(offsetItem -> {
            return offsetItem.getStart() > opened.getStart() || offsetItem.getEnd() < opened.getStart();
        }).collect(Collectors.toList());
        addClosingOffsetItems(out, toClose);

        // Close this tag
        addClosingOffsetItemSpan(out, opened);

        // Re-open other tags
        addOffsetItems(out, started, all, toClose);
        return innerOffset;
    }

    private static int writePrefixToIndex(List<OffsetItem> opened, List<OffsetItem> all, OutputStreamWriter out, int index, int offset, int innerOffset, char[] buffer) throws IOException {
        int preLength = index - innerOffset - offset;
        if (preLength > 0) {
            writeBuffer(opened, all, out, buffer, innerOffset, preLength);
            innerOffset += preLength;
        }
        return innerOffset;
    }

    private static void writeBuffer(List<OffsetItem> started, List<OffsetItem> all, OutputStreamWriter out, char[] buffer, int offset, int len) throws IOException {
        String strBuffer = new String(buffer, offset, len);
        out.write(StringEscapeUtils.escapeXml11(strBuffer));
    }

    private static boolean indexInsideCurrentBuffer(long index, int offset, int innerOffset, int len) {
        return index >= offset && (index - offset) < BUFFER_SIZE;
    }

    private static void addOffsetItems(OutputStreamWriter out, List<OffsetItem> opened, List<OffsetItem> all, Collection<OffsetItem> items) throws IOException {
        for (OffsetItem otherOpened : items) {
            addOffsetItemSpan(out, opened, all, otherOpened);
        }
    }

    private static void addClosingOffsetItems(OutputStreamWriter out, Collection<OffsetItem> items) throws IOException {
        for (OffsetItem otherOpened : items) {
            addClosingOffsetItemSpan(out, otherOpened);
        }
    }

    private static void addOffsetItemSpan(OutputStreamWriter out, List<OffsetItem> opened, List<OffsetItem> all, OffsetItem item) throws IOException {
        addOffsetItemSpan(out, opened, all, item, false, false);
    }

    private static void addOffsetItemSpan(OutputStreamWriter out, List<OffsetItem> opened, List<OffsetItem> all, OffsetItem item, boolean fullInfo) throws IOException {
        addOffsetItemSpan(out, opened, all, item, fullInfo, false);
    }

    private static void addClosingOffsetItemSpan(OutputStreamWriter out, OffsetItem item) throws IOException {
        addOffsetItemSpan(out, null, null, item, false, true);
    }

    private static void addOffsetItemSpan(OutputStreamWriter out, List<OffsetItem> opened, List<OffsetItem> all, OffsetItem item, boolean fullInfo, boolean closing) throws IOException {
        if (!closing) {
            JSONObject infoJson = item.getInfoJson();

            out.write("<span");
            out.write(" class=\"");
            out.write(StringUtils.join(item.getCssClasses(), " "));
            out.write("\"");

            if (item.getScore() != null) {
                out.write(" data-score=\"" + item.getScore() + "\"");
            }

            if (!StringUtils.isEmpty(item.getType())) {
                out.write(" data-type=\"" + item.getType() + "\"");
            }

            if (item.getTitle() != null) {
                out.write(" title=\"");
                out.write(StringEscapeUtils.escapeXml11(item.getTitle()));
                out.write("\"");
            }

            String classIdentifier = item.getClassIdentifier();
            if (fullInfo) {
                if (infoJson != null) {
                    out.write(" data-info=\"");
                    out.write(StringEscapeUtils.escapeXml11(infoJson.toString()));
                    out.write("\"");
                }
                if (classIdentifier != null) {
                    out.write(" data-ref-id=\"" + classIdentifier + "\"");
                }
            } else if (classIdentifier != null) {
                out.write(" data-ref=\"" + classIdentifier + "\"");
            }

            if (!StringUtils.isEmpty(item.getStyle())) {
                out.write(" style=\"" + item.getStyle() + "\"");
            }

            out.write(">");
        } else {
            out.write("</span>");
        }
    }

    public VideoTranscript getHighlightedVideoTranscript(VideoTranscript videoTranscript, Iterable<Vertex> termMentions, String workspaceId, Authorizations authorizations) {
        List<OffsetItem> offsetItems = convertTermMentionsToOffsetItems(termMentions, workspaceId, authorizations);
        return getHighlightedVideoTranscript(videoTranscript, offsetItems);
    }

    private VideoTranscript getHighlightedVideoTranscript(VideoTranscript videoTranscript, List<OffsetItem> offsetItems) {
        Map<Integer, List<OffsetItem>> videoTranscriptOffsetItems = convertOffsetItemsToVideoTranscriptOffsetItems(videoTranscript, offsetItems);
        return getHighlightedVideoTranscript(videoTranscript, videoTranscriptOffsetItems);
    }

    private VideoTranscript getHighlightedVideoTranscript(VideoTranscript videoTranscript, Map<Integer, List<OffsetItem>> videoTranscriptOffsetItems) {
        VideoTranscript result = new VideoTranscript();
        int entryIndex = 0;
        for (VideoTranscript.TimedText videoTranscriptEntry : videoTranscript.getEntries()) {
            VideoTranscript.TimedText entry = videoTranscript.getEntries().get(entryIndex);

            List<OffsetItem> offsetItems = videoTranscriptOffsetItems.get(entryIndex);
            String highlightedText;
            highlightedText = getHighlightedText(entry.getText(), offsetItems);
            result.add(videoTranscriptEntry.getTime(), highlightedText);
            entryIndex++;
        }
        return result;
    }

    private Map<Integer, List<OffsetItem>> convertOffsetItemsToVideoTranscriptOffsetItems(VideoTranscript videoTranscript, List<OffsetItem> offsetItems) {
        Map<Integer, List<OffsetItem>> results = new HashMap<>();
        for (OffsetItem offsetItem : offsetItems) {
            Integer videoTranscriptEntryIndex = getVideoTranscriptEntryIndex(videoTranscript, offsetItem);
            offsetItem.setShouldBitShiftOffsetsForVideoTranscript(true);
            List<OffsetItem> currentList = results.get(videoTranscriptEntryIndex);
            if (currentList == null) {
                currentList = new ArrayList<>();
                results.put(videoTranscriptEntryIndex, currentList);
            }
            currentList.add(offsetItem);
        }
        return results;
    }

    private static int getVideoTranscriptEntryIndex(VideoTranscript videoTranscript, OffsetItem offsetItem) {
        Integer videoTranscriptEntryIndex = null;
        VideoFrameInfo videoFrameInfo = VideoPropertyHelper.getVideoFrameInfo(offsetItem.getId());
        if (videoFrameInfo != null) {
            videoTranscriptEntryIndex = videoTranscript.findEntryIndexFromStartTime(videoFrameInfo.getFrameStartTime());
        }
        if (videoTranscriptEntryIndex == null) {
            videoTranscriptEntryIndex = offsetItem.getVideoTranscriptEntryIndex();
        }
        return videoTranscriptEntryIndex;
    }

    public List<OffsetItem> convertTermMentionsToOffsetItems(Iterable<Vertex> termMentions, String workspaceId, Authorizations authorizations) {
        ArrayList<OffsetItem> termMetadataOffsetItems = new ArrayList<>();
        for (Vertex termMention : termMentions) {
            String visibility = termMention.getVisibility().getVisibilityString();
            SandboxStatus sandboxStatus = SandboxStatus.getFromVisibilityString(visibility, workspaceId);
            termMetadataOffsetItems.add(new VertexOffsetItem(termMention, sandboxStatus, authorizations));
        }
        return termMetadataOffsetItems;
    }


    private static class NonBreakingSpaceFilteredOutputStream extends FilterOutputStream {
        private static Pattern NonBreakingSpacePattern = Pattern.compile("(&amp;nbsp;)", Pattern.CASE_INSENSITIVE);
        private static String Replacement = " ";
        private static byte[] breakBytes = "\n<br>".getBytes(StandardCharsets.UTF_8);

        private ByteArrayOutputStream buffer = new ByteArrayOutputStream();

        public NonBreakingSpaceFilteredOutputStream(OutputStream outputStream) {
            super(outputStream);
        }

        @Override
        public void write(byte[] data, int offset, int length) throws IOException
        {
            for (int i = offset; i < offset + length; i++) {
                this.write(data[i]);
            }
        }

        @Override
        public void write(byte[] b) throws IOException {
            write(b, 0, b.length);
        }

        @Override
        public void close() throws IOException {
            replaceLine();
            out.flush();
            super.close();
        }

        @Override
        public void write(int b) throws IOException {
            if (b == '\n') {
                buffer.write(breakBytes);
                replaceLine();
            } else {
                buffer.write(b);
            }
        }

        private void replaceLine() throws IOException {
            String workingLine = buffer.toString();
            buffer.reset();

            Matcher matcher = NonBreakingSpacePattern.matcher(workingLine);

            boolean foundMatch = matcher.find();
            if (foundMatch) {
                StringBuffer stringBuffer = new StringBuffer();

                while(foundMatch) {
                    matcher.appendReplacement(stringBuffer, Replacement);
                    foundMatch = matcher.find();
                }
                matcher.appendTail(stringBuffer);
                out.write(stringBuffer.toString().getBytes(StandardCharsets.UTF_8));
            } else {
                out.write(workingLine.getBytes(StandardCharsets.UTF_8));
            }
        }

    }


}
