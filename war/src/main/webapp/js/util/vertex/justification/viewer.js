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

/**
 * Renders the json justification object. Could be either justification text or
 * full source info with link to source.
 *
 * One of `justificationMetadata` or `sourceMetadata` must be provided.
 * If both justificationMetadata and sourceMetadata are given, only justificationMetadata is used.
 *
 * @module components/JustificationViewer
 * @flight Displays justification information
 * @attr {boolean} [linkToSource=true] Show the source link if available
 * @attr {object} [justificationMetadata]
 * @attr {string} justificationMetadata.justificationText The text to display
 * @attr {object} [sourceMetadata]
 * @attr {string} sourceMetadata.snippet The snippet from source material to display
 * @attr {string} sourceMetadata.textPropertyKey The property key of the text property in source
 * @attr {string} sourceMetadata.textPropertyName The property name of the text property in source
 * @attr {string} sourceMetadata.startOffset The character start index of snippet in source
 * @attr {string} sourceMetadata.endOffset The character end index of snippet in source
 * @attr {string} sourceMetadata.vertexId The vertexId of the source
 * @example <caption>Text</caption>
 * JustificationViewer.attachTo(node, {
 *     justificationMetadata: {
 *         justificationText: 'Justification for property here'
 *     }
 * })
 * @example <caption>Source Reference</caption>
 * JustificationViewer.attachTo(node, {
 *     sourceMetadata: {
 *         snippet: '[html snippet]',
 *         vertexId: vertexId,
 *         textPropertyKey: textPropertyKey,
 *         textPropertyName: textPropertyName,
 *         startOffset: 0,
 *         endOffset: 42
 *     }
 * })
 */
define([
    'flight/lib/component',
    'util/component/attacher',
    'components/justification/JustificationViewer'
], function(defineComponent, Attacher, JustificationViewerReact) {

    return defineComponent(JustificationViewer);

    function JustificationViewer() {

        this.before('teardown', function() {
            if (this.attacher) {
                this.attacher.teardown();
                this.attacher = null;
            }
        })

        this.after('initialize', function() {

            const { linkToSource = true, sourceMetadata: sourceInfo, justificationMetadata } = this.attr;
            const params = {
                linkToSource,
                value: {}
            }

            if (sourceInfo) {
                params.value.sourceInfo = sourceInfo;
            } else if (justificationMetadata) {
                params.value.justificationText = justificationMetadata.justificationText;
            }

            this.attacher = Attacher()
                .component(JustificationViewerReact)
                .node(this.node)
                .params(params)
            this.attacher.attach();
        });

    }
});
