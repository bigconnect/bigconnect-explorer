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
    'create-react-class',
    'prop-types',
    'react-redux',
    'util/vertex/formatters',
    'data/web-worker/store/element/selectors',
    'data/web-worker/store/element/actions',
    'data/web-worker/store/selection/actions'
], function(createReactClass, PropTypes, redux, F, elementSelectors, elementActions, selectionActions) {

    const JustificationViewer = createReactClass({
        propTypes: {
            value: PropTypes.shape({
                justificationText: PropTypes.string,
                sourceInfo: PropTypes.object
            })
        },
        componentDidMount() {
            this._checkForTitle(this.props);
        },
        componentWillReceiveProps(nextProps) {
            this._checkForTitle(nextProps);
        },
        render() {
            const { value } = this.props;
            const { justificationText, sourceInfo } = value;

            if (justificationText) {
                return this.renderJustificationText(justificationText);
            }
            if (sourceInfo) {
                return this.renderSourceInfo(sourceInfo);
            }

            return null;
        },
        renderJustificationText(justificationText) {
            return (
                <div className="viewing">
                    <div className="text"><div className="text-inner">{justificationText}</div></div>
                </div>
            );
        },
        renderSourceInfo(sourceInfo) {
            const { sourceInfoVertex, linkToSource } = this.props;
            const { snippet } = sourceInfo;
            const title = sourceInfoVertex ? F.vertex.title(sourceInfoVertex) : sourceInfoVertex === null ? i18n('element.entity.not_found') : i18n('bc.loading');

            return (
                <div className="viewing">
                    { snippet && (<div className="text"><div className="text-inner" dangerouslySetInnerHTML={{ __html: snippet }} /></div>) }
                    <div className="source" title={title}>
                        <strong>{i18n('justification.field.reference.label')}: </strong>{
                        linkToSource !== false ?
                            (<button className="ref-title btn btn-link" onClick={this.onClick}>{title}</button>) :
                            (<span className="ref-title">{title}</span>)
                    }</div>
                </div>
            );
        },
        onClick(event) {
            event.preventDefault();
            event.stopPropagation();
            const { openSourceInfo, value } = this.props;
            openSourceInfo(value.sourceInfo);
        },
        _checkForTitle(props) {
            const { value, sourceInfoVertex, loadVertex } = props;
            if (!value) return;

            const { sourceInfo } = value;
            if (!sourceInfo) return;
            if (sourceInfoVertex) return;

            const { vertexId } = sourceInfo;
            if (!this._toRequest) this._toRequest = {};
            if (vertexId in this._toRequest) return;

            this._toRequest[vertexId] = true;
            loadVertex(vertexId);
        }
    });

    return redux.connect(
        (state, props) => {
            let sourceInfoVertex;
            if (props.value) {
                const { sourceInfo } = props.value;
                if (sourceInfo) {
                    const vertices = elementSelectors.getVertices(state);
                    sourceInfoVertex = vertices[sourceInfo.vertexId];
                }
            }
            return {
                sourceInfoVertex,
                ...props
            };
        },

        (dispatch, props) => ({
            openSourceInfo(sourceInfo) {
                const vertexId = sourceInfo.vertexId;
                const textPropertyKey = sourceInfo.textPropertyKey;
                const textPropertyName = sourceInfo.textPropertyName;
                const offsets = [sourceInfo.startOffset, sourceInfo.endOffset];
                dispatch(selectionActions.set({
                    vertices: [vertexId],
                    options: {
                        focus: {
                            vertexId,
                            textPropertyKey,
                            textPropertyName,
                            offsets
                        }
                    }
                }));
            },
            loadVertex(id) {
                dispatch(elementActions.get({ vertexIds: [id] }));
            }
        })
    )(JustificationViewer);
});
