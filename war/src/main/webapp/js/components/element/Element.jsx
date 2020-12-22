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
    'util/vertex/urlFormatters',
    'util/dnd',
    'data/web-worker/store/element/selectors',
    'data/web-worker/store/element/actions',
    'data/web-worker/store/ontology/selectors',
    'data/web-worker/store/selection/actions'
], function(
    createReactClass,
    PropTypes,
    redux,
    F,
    {vertexUrl},
    dnd,
    elementSelectors,
    elementActions,
    ontologySelectors,
    selectionActions) {

    const ClassName = 'org-bc-element';
    const ClassNameLoading = 'org-bc-element-loading';

    const Vertex = function(props) {
        const { vertex, ...rest } = props;

        const title = F.vertex.title(vertex);
        const concept = F.vertex.concept(vertex);
        const url = vertexUrl.url([vertex]);

        return (
            <a href={url}
               className={ClassName}
               title={`${title} \n${i18n('element.draghelp')}`}
               style={{borderBottomColor: concept.color || '#000'}}
               {...rest}
            >{title}</a>
        );
    };

    const Edge = function(props) {
        const { edge, inVertex, outVertex, relationshipLabel, ...rest } = props;
        let title = i18n('bc.loading');
        let titleStr = title;

        if (relationshipLabel && inVertex && outVertex) {
            const outTitle = F.vertex.title(outVertex);
            const inTitle = F.vertex.title(inVertex);
            const label = relationshipLabel.displayName;
            title = (
                <span>
                    {outTitle} <span className="rel-label">{label}</span> {inTitle}
                </span>
            );
            titleStr = `${outTitle} \n${label} \n${inTitle}`;
        }

        const url = vertexUrl.url([edge]);
        return (
            <a href={url}
               className={ClassName}
               title={`${titleStr} \n${i18n('element.draghelp')}`}
               {...rest}
            >{title}</a>
        );
    };

    const Element = createReactClass({
        propTypes: {
            element: PropTypes.shape({
                id: PropTypes.string.isRequired,
                properties: PropTypes.array.isRequired
            })
        },
        componentDidMount() {
            this._loadEdgeVertices(this.props);
        },
        componentWillReceiveProps(nextProps) {
            this._loadEdgeVertices(nextProps);
        },
        render() {
            const { element, relationshipLabel, inVertex, outVertex, ...rest } = this.props;

            if (element) {
                if (element.type === 'vertex') return (
                    <Vertex vertex={element}
                            onMouseEnter={this.onMouseEnter}
                            onMouseLeave={this.onMouseLeave}
                            onDragStart={this.onDragStart}
                            onClick={this.onClick}
                            onDoubleClick={this.onDoubleClick}
                            draggable />
                );
                if (element.type === 'edge') return (
                    <Edge edge={element}
                          onMouseEnter={this.onMouseEnter}
                          onMouseLeave={this.onMouseLeave}
                          onDragStart={this.onDragStart}
                          onClick={this.onClick}
                          onDoubleClick={this.onDoubleClick}
                          inVertex={inVertex}
                          outVertex={outVertex}
                          relationshipLabel={relationshipLabel}
                          draggable />
                );

                throw new Error('Unknown element type: ' + element.type)
            } else if (element === null) {
                return (<span className={ClassNameLoading}>{i18n('element.not_found')}</span>)
            }

            return (<span className={ClassNameLoading}>Loading…</span>)
        },
        onMouseEnter(event) {
            const { element, onFocusElements } = this.props;
            const { id } = element;
            onFocusElements({ vertexIds: [id] });
        },
        onMouseLeave(event) {
            this.props.onFocusElements({});
        },
        onClick(event) {
            event.preventDefault();
        },
        onDoubleClick(event) {
            event.preventDefault();
            window.open(event.target.href);
        },
        onDragStart(event) {
            const { element } = this.props;
            if (element) {
                const data = { elements: [element] }
                dnd.setDataTransferWithElements(event.dataTransfer, data);
            }
        },
        _loadEdgeVertices(props) {
            const { element } = props;
            if (!element || element.type !== 'edge') return;

            const { outVertexId, inVertexId } = element;
            if (!this._loadedEdgeVertexIds) this._loadedEdgeVertexIds = {};

            const vertexIds = [inVertexId, outVertexId].filter(id => {
                const requested = this._loadedEdgeVertexIds[id]
                this._loadedEdgeVertexIds[id] = true;
                return !requested;
            });
            if (vertexIds.length) {
                this.props.onLoadElements({ vertexIds });
            }
        }
    });

    return redux.connect(
        (state, props) => {
            const { element } = props;
            let inVertex, outVertex, relationshipLabel;
            if (element && element.type === 'edge') {
                const { outVertexId, inVertexId } = element;
                const vertices = elementSelectors.getVertices(state);
                inVertex = vertices[inVertexId];
                outVertex = vertices[outVertexId];
                relationshipLabel = ontologySelectors.getRelationships(state)[element.label];
            }
            return {
                inVertex,
                outVertex,
                relationshipLabel,
                ...props
            };
        },

        (dispatch, props) => ({
            onFocusElements(elements) {
                dispatch(elementActions.setFocus(elements));
            },
            onLoadElements(elements) {
                dispatch(elementActions.get(elements));
            }
        })
    )(Element);
});
