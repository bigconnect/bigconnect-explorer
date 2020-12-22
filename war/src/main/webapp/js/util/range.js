
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
define([
    'rangy-core',
    'rangy-text'
], function(rangy) {
    'use strict';

    if (!rangy.initialized) {
        console.warn('Rangy should have been initialized by ClipboardManager…')
        rangy.init();
    }

    var api = {

        clearSelection: function() {
            rangy.getSelection().removeAllRanges();
        },

        highlightOffsets: function(textElement, offsets) {
            const spans = textElement.querySelectorAll('span[data-info]');

            let found = null;
            for (var i = 0; i < spans.length; i++) {
                const info = JSON.parse(spans[i].dataset.info);
                if (info.start === offsets[0] && info.end === offsets[1]) {
                    found = spans[i]
                    break;
                }
            }

            if (!found) {
                console.warn('Unable to find term mention at offsets', offsets)
                return;
            }

            var newEl = found,
                $newEl = $(newEl),
                scrollParent = $newEl.scrollParent(),
                scrollTo = newEl.offsetTop;

            scrollParent.clearQueue().animate({
                scrollTop: scrollTo - 100
            }, {
                duration: 'fast',
                easing: 'easeInOutQuad',
                complete: function() {
                    $newEl.on(ANIMATION_END, function(e) {
                        $newEl.removeClass('fade-slow');
                    });
                    $newEl.addClass('fade-slow');
                }
            });
        },

        getNodesWithinRange: function(range) {
            var r = rangy.createRange();

            r.setStart(range.startContainer, range.startOffset);
            r.setEnd(range.endContainer, range.endOffset);

            return r.getNodes()
        },

        createSnippetFromNode: function(node, numberWords, limitToContainer) {
            var range = document.createRange();

            if (node.nodeType === 1) {
                node.normalize();
                range.selectNode(node);
            } else {
                throw new Error('node must be nodeType=1');
            }

            return api.createSnippetFromRange(range, numberWords, limitToContainer);
        },

        createSnippetFromRange: function(range, numberWords, limitToContainer) {
            var output = {},
                numberOfWords = numberWords || 4,
                text = range.toString(),
                contextRange = api.expandRangeByWords(range, numberOfWords, output, limitToContainer),
                context = contextRange.toString(),
                transform = function(str, prependEllipsis) {
                    if (str.match(/^[\s\n]*$/)) {
                        return '';
                    }

                    var words = $.trim(str).split(/\s+/);
                    if (words.length < numberOfWords) {
                        return str;
                    }

                    if (prependEllipsis) {
                        return '…' + str;
                    }

                    return str + '…';
                },
                contextHighlight = transform(output.before, true) +
                    '<span class="selection">' + text + '</span>' +
                    transform(output.after, false);

            return contextHighlight;
        },

        expandRangeByWords: function(range, numberWords, splitBeforeAfterOutput, limitToContainer) {

            var e = rangy.createRange(),
                i = 0,
                options = {
                    includeBlockContentTrailingSpace: false,
                    includePreLineTrailingSpace: false,
                    includeTrailingSpace: false
                },
                maxLoop = 1000;

            e.setStart(range.startContainer, range.startOffset);
            e.setEnd(range.endContainer, range.endOffset);

            // Move range start to include n more of words
            e.moveStart('word', -numberWords, options);
            if (limitToContainer) {
                i = 0;
                while (e.startContainer !== limitToContainer &&
                $(e.startContainer).closest(limitToContainer).length === 0) {
                    if (++i > maxLoop) break;
                    e.moveStart('character', 1, options);
                }
                if (i) {
                    e.moveStart('character', -1, options);
                }
            }

            // Move range end to include n more words
            e.moveEnd('word', numberWords, options);

            if (limitToContainer) {
                i = 0;
                while (e.endContainer !== limitToContainer &&
                $(e.endContainer).closest(limitToContainer).length === 0) {
                    if (++i > maxLoop) break;
                    e.moveEnd('character', -1, options);
                }
            }

            // Calculate what we just included and send that back
            if (splitBeforeAfterOutput) {
                var output = rangy.createRange();
                output.setStart(e.startContainer, e.startOffset);
                output.setEnd(range.startContainer, range.startOffset);
                splitBeforeAfterOutput.before = output.text();

                output.setStart(range.endContainer, range.endOffset);
                output.setEnd(e.endContainer, e.endOffset);
                splitBeforeAfterOutput.after = output.text();
            }

            return e;
        }
    };

    return api;
});
