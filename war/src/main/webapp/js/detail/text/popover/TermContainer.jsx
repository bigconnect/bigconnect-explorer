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
    'data/web-worker/store/user/selectors',
    'data/web-worker/store/selection/actions',
    'data/web-worker/store/element/actions',
    'data/web-worker/store/ontology/selectors',
    'data/web-worker/store/element/selectors',
    './TermList',
    './forms/Resolve',
    './forms/Unresolve',
    './forms/Property',
    './forms/Relationship',
    './forms/Delete'
], function(
    createReactClass,
    PropTypes,
    redux,
    userSelectors,
    selectionActions,
    elementActions,
    ontologySelectors,
    elementSelectors,
    TermList,
    Resolve,
    Unresolve,
    Property,
    Relationship,
    Delete) {

    const THING = ONTOLOGY_CONSTANTS.THING_CONCEPT;

    const isVertex = ({termMentionFor, termMentionForElementId, resolvedToVertexId}) =>
        Boolean(termMentionFor === 'VERTEX' || termMentionForElementId === resolvedToVertexId);

    const TermContainer = createReactClass({
        propTypes: {
            onOpen: PropTypes.func.isRequired,
            onFullscreen: PropTypes.func.isRequired,
            onComment: PropTypes.func.isRequired,
            artifactId: PropTypes.string.isRequired,
            propertyKey: PropTypes.string.isRequired,
            propertyName: PropTypes.string.isRequired,
            terms: PropTypes.array,
            selection: PropTypes.object,
            sourceVertexId: PropTypes.string,
            targetVertexId: PropTypes.string
        },
        getInitialState() {
            const { terms, selection, sourceVertexId, targetVertexId } = this.props;
            if (terms || selection) {
                return { viewing: { type: 'list' } };
            }
            if (sourceVertexId && targetVertexId) {
                return { viewing: { type: 'relationship', data: { sourceVertexId, targetVertexId } }};
            }
            throw new Error('Invalid props given: must have terms/selection or source/target');
        },
        componentDidMount() {
            this._checkForElementsNeeded(this.props);
        },
        componentWillUnmount() {
            this.props.onHoverTerm();
        },
        componentWillReceiveProps(nextProps) {
            this._checkForElementsNeeded(nextProps);
        },
        render() {
            return (
                <div>
                    {this.getContent()}
                </div>
            )
        },
        getContent() {
            const { terms, selection, onOpen, onComment, onFullscreen, concepts, ...rest } = this.props;
            const { viewing, error, loading } = this.state;
            const formState = { error, loading };
            const actions = {
                onOpen,
                onFullscreen,
                onComment,
                onUnresolve: this.onUnresolve,
                onDelete: this.onDelete,
                onResolve: this.onResolve,
                onProperty: this.onProperty
            };

            rest.getConceptOrDefault = function(iri = THING) {
                return concepts[iri] || concepts[THING];
            }

            switch (viewing.type) {

                case 'list':
                    return (
                        <TermList actions={actions} selection={selection} terms={terms} {...rest} />
                    );

                case 'resolve':
                    return (
                        <Resolve
                            onResolve={this.doResolve}
                            onCancel={this.onViewList}
                            {...viewing.data}
                            {...rest}
                            {...formState} />
                    );

                case 'unresolve':
                    return (
                        <Unresolve
                            onUnresolve={this.doUnresolve}
                            onCancel={this.onViewList}
                            {...viewing.data}
                            {...rest}
                            {...formState} />
                    );

                case 'delete':
                    return (
                        <Delete
                            onDelete={this.doDelete}
                            onCancel={this.onViewList}
                            {...viewing.data}
                            {...rest}
                            {...formState} />
                    )

                case 'property':
                    return (
                        <Property
                            onSave={this.doProperty}
                            onCancel={this.onViewList}
                            {...viewing.data}
                            {...rest}
                            {...formState} />
                    )

                case 'relationship':
                    return (
                        <Relationship
                            onSave={this.doRelationship}
                            onCancel={this.doClose}
                            {...viewing.data}
                            {...rest}
                            {...formState} />
                    )
            }
        },
        onViewList() {
            this.setState({ error: null, viewing: { type: 'list' } });
        },
        _dataForTerm(term) {
            const { artifactId, propertyName, propertyKey } = this.props;
            const data = {
                ...term,
                artifactId,
                propertyName,
                propertyKey
            };
            return data;
        },
        onUnresolve(term) {
            this.setState({
                viewing: { type: 'unresolve', data: this._dataForTerm(term) }
            })
        },
        onDelete(term) {
            this.setState({
                viewing: { type: 'delete', data: this._dataForTerm(term) }
            })
        },
        onResolve(term) {
            this.setState({
                viewing: { type: 'resolve', data: this._dataForTerm(term) }
            });
        },
        onProperty(term) {
            const { artifactId, propertyName, propertyKey } = this.props;
            const { snippet, mentionEnd, mentionStart, sign } = term;
            this.setState({
                viewing: {
                    type: 'property',
                    data: {
                        attemptToCoerceValue: sign,
                        sourceInfo: {
                            startOffset: mentionStart,
                            endOffset: mentionEnd,
                            snippet,
                            vertexId: artifactId,
                            textPropertyKey: propertyKey,
                            textPropertyName: propertyName
                        }
                    }
                }
            })
        },
        doResolve(data) {
            this._do('vertex', 'resolveTerm', data)
        },
        doUnresolve(termMentionId) {
            this._do('vertex', 'unresolveTerm', { termMentionId })
        },
        doDelete(termMentionId) {
            this._do('vertex', 'deleteTerm', { termMentionId })
        },
        doProperty(data) {
            const { element, property } = data;
            const { viewing } = this.state;
            this.setState({
                viewing: {
                    type: 'property',
                    data: { ...viewing.data, element, property }
                }
            });
            this._do(element.type, 'setProperty', element.id, property);
        },
        doRelationship(data) {
            this._do('edge', 'create', data);
        },
        doClose() {
            this.props.closeDialog();
        },
        _do(...params) {
            this.setState({ error: null, loading: true })
            this.props.bcApi.v1.dataRequest(...params)
                .then(result => {
                    this.props.reloadText();
                    this.doClose();
                })
                .catch(error => {
                    console.error(error)
                    this.setState({ error, loading: false })
                })
        },
        _onlyOneTerm() {
            const { terms, selection } = this.props;
            return terms.length === 1 && !selection;
        },
        _checkForElementsNeeded(props) {
            if (!this._requestingIds) {
                this._requestingIds = {};
            }
            const { terms, sourceVertexId, targetVertexId } = props;
            const types = { vertices: [], edges: [] };
            const { vertices, edges } = types;
            const add = (type, id) => {
                if (type && id && !(id in props[type]) && !(id in this._requestingIds)) {
                    this._requestingIds[id] = true;
                    types[type].push(id);
                }
            }

            if (terms) {
                terms.forEach(term => {
                    const { termMentionFor, termMentionForElementId, resolvedToVertexId } = term;

                    add(isVertex(term) ? 'vertices' : 'edges', termMentionForElementId);
                });
            }

            if (sourceVertexId) {
                add('vertices', sourceVertexId);
            }

            if (targetVertexId) {
                add('vertices', targetVertexId);
            }

            if (vertices.length || edges.length) {
                props.requestElements({ vertices, edges })
            }
        }
    });

    return redux.connect(
        (state, props) => {
            return {
                privileges: userSelectors.getPrivileges(state),
                concepts: ontologySelectors.getConcepts(state),
                vertices: elementSelectors.getVertices(state),
                edges: elementSelectors.getEdges(state),
                ...props
            }
        },

        (dispatch, {
            closeDialog,
            comment,
            openFullscreen,
            artifactId,
            propertyKey,
            propertyName
        }) => ({
            onFocusElements: ({ vertexIds = [], edgeIds = [] }) => {
                dispatch(elementActions.setFocus({ vertexIds, edgeIds }));
            },
            requestElements({ vertices, edges }) {
                dispatch(elementActions.get({ vertexIds: vertices, edgeIds: edges }));
            },
            onComment({ mentionStart, mentionEnd, snippet }) {
                closeDialog();
                comment({
                    startOffset: mentionStart,
                    endOffset: mentionEnd,
                    snippet,
                    vertexId: artifactId,
                    textPropertyKey: propertyKey,
                    textPropertyName: propertyName
                });
            },
            onFullscreen(term) {
                const id = term.termMentionForElementId;
                const elements = {
                    [isVertex(term) ? 'vertexIds' : 'edgeIds']: [id]
                };
                openFullscreen(elements);
            },
            onOpen(term) {
                closeDialog();
                const id = term.termMentionForElementId;
                const elements = {
                    [isVertex(term) ? 'vertices' : 'edges']: [id]
                };
                dispatch(selectionActions.set(elements));
            }
        })
    )(TermContainer);
});
