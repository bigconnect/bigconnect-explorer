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
    'react-transition-group',
    'util/vertex/formatters',
    'data/web-worker/store/element/selectors',
    'data/web-worker/store/element/actions'
], function(createReactClass, PropTypes, redux, ReactTransitionGroup, F, elementSelectors, elementActions) {

    const { Transition, TransitionGroup } = ReactTransitionGroup;
    const getHeight = elem => {
        return elem.offsetHeight;
    }
    const forceLayout = node => {
        node.offsetHeight; // eslint-disable-line no-unused-expressions
    }
    const DEFAULT = { justificationText: '', sourceInfo: null };
    const JustificationEditor = createReactClass({
        propTypes: {
            validation: PropTypes.string.isRequired,
            value: PropTypes.shape({
                justificationText: PropTypes.string,
                sourceInfo: PropTypes.object
            }),
            onJustificationChanged: PropTypes.func.isRequired
        },
        getInitialState() {
            return { height: 'auto' };
        },
        componentWillReceiveProps(nextProps) {
            this.checkForPastedSourceInfo(this.props, nextProps)
        },
        componentDidMount() {
            const { value = DEFAULT } = this.props;
            const valid = this.checkValid(value);
            this.props.onJustificationChanged({ value, valid })
            this.checkForPastedSourceInfo(undefined, this.props);
        },
        render() {
            const { value = DEFAULT, validation } = this.props;
            const { height } = this.state;
            const { justificationText, sourceInfo } = value;

            if (validation === 'NONE') {
                return null;
            }

            const duration = 250;
            const showJustification = _.isEmpty(value.sourceInfo);
            const showSourceInfo = !showJustification

            return (
                <div className="justification">
                    <Transition in={showSourceInfo} timeout={duration}
                                onEnter={this.onEnter}
                                onEntering={this.onEntering}
                                onEntered={this.onEntered}
                                onExit={this.onExit}
                                onExiting={this.onExiting}
                                onExited={this.onExited}>
                        {(state) => (
                            <div className="animationwrap" style={{
                                overflow: ['entering', 'exiting'].includes(state) ? 'hidden' : '',
                                position: 'relative',
                                transition: `height ${duration}ms ease-in-out`
                            }}>
                                <div ref={r => {this.textRef = r;}} style={{
                                    display: state === 'entered' ? 'none' : '',
                                    visibility: state === 'entering' ? 'hidden' : ''}}>
                                    {this.renderJustificationInput(justificationText)}
                                </div>
                                {sourceInfo ? (
                                    <div ref={r => {this.sourceInfoRef = r;}} style={{
                                        ...(state === 'entered' ? {} : { position: 'absolute', top: '0', left: '0' })
                                    }}>{this.renderSourceInfo(sourceInfo)}</div>
                                ) : null }
                            </div>
                        )}
                    </Transition>
                </div>
            )
        },
        onEnter(node) {
            node.style.overflow = 'hidden';
            this._justificationHeight = getHeight(node) + 'px';
            this._sourceInfoHeight = getHeight(this.sourceInfoRef) + 'px';
            node.style.overflow = null;
            node.style.height = this._justificationHeight;
            forceLayout(node);
        },
        onEntering(node) {
            node.style.height = this._sourceInfoHeight;
        },
        onEntered(node) {
            this.resetHeight(node);
            $(node).animatePop();
        },
        resetHeight(node) {
            node.style.height = null;
        },
        onExit(node) {
            node.style.height = this._sourceInfoHeight;
            forceLayout(node);
        },
        onExited(node) {
            this.resetHeight(node);
            this._justificationTextInput.focus()
        },
        onEndTransition(node) {
            this._justificationTextInput.focus()
        },
        onExiting(node) {
            node.style.height = this._justificationHeight;
        },
        renderSourceInfo(sourceInfo) {
            const { snippet, vertexId } = sourceInfo;
            const { vertices } = this.props;
            const vertex = vertices && vertices[vertexId];
            const title = vertex ? F.vertex.title(vertex) : vertex === null ?
                i18n('element.entity.not_found') : i18n('bc.loading');

            return (
                <div className="viewing">
                    <div className="text">
                        <div className="text-inner" dangerouslySetInnerHTML={{ __html: snippet }} />
                    </div>
                    <div className="source">
                        <strong>{i18n('justification.field.reference.label')}:</strong>
                        <span title={title} className="ref-title">{title}</span>
                        <button className="remove" onClick={this.onRemoveSourceInfo}>Remove</button>
                    </div>
                </div>
            );
        },
        renderJustificationInput(justificationText) {
            const { validation } = this.props;
            return (
                <input
                    ref={r => {this._justificationTextInput = r;}}
                    data-title={`<strong>${i18n('justification.field.tooltip.title')}</strong><br>${i18n('justification.field.tooltip.subtitle')}`}
                    data-placement="left"
                    data-trigger="focus"
                    data-html="true"
                    className="editing form-control"
                    onChange={this.onChange}
                    onPaste={this.onPaste}
                    placeholder={validation === 'OPTIONAL' ?
                        i18n('justification.field.placeholder.optional') :
                        i18n('justification.field.placeholder.required')
                    }
                    type="text"
                    value={justificationText || ''} />
            )
        },
        onPaste(event) {
            const target = event.target;
            _.defer(() => {
                const sourceInfo = this.sourceInfoForText(target.value);
                if (sourceInfo) {
                    this.setSourceInfo(sourceInfo);
                } else {
                    this.setJustificationText(target.value);
                }
            });
        },
        onChange(event) {
            this.setJustificationText(event.target.value);
        },
        onRemoveSourceInfo() {
            this.setSourceInfo(null);
        },
        setJustificationText(justificationText) {
            const value = { justificationText }
            const valid = this.checkValid(value);
            this.props.onJustificationChanged({ value, valid })
        },
        setSourceInfo(sourceInfo) {
            const value = { sourceInfo }
            const valid = this.checkValid(value);
            if (sourceInfo) {
                this.props.loadVertex(sourceInfo.vertexId);
            }
            this.props.onJustificationChanged({ value, valid })
        },
        checkForPastedSourceInfo(oldProps = {}, newProps = {}) {
            const { pastedValue:oldValue } = oldProps;
            const { pastedValue:newValue } = newProps;

            if (newValue && (!oldValue || newValue !== oldValue)) {
                const sourceInfo = this.sourceInfoForText(newValue);
                if (sourceInfo) {
                    this.setSourceInfo(sourceInfo);
                }
            }
        },
        sourceInfoForText(text) {
            var clipboard = bcData.copiedDocumentText,
                normalizeWhiteSpace = function(str) {
                    return str.replace(/\s+/g, ' ');
                };

            if (clipboard && normalizeWhiteSpace(clipboard.text) === normalizeWhiteSpace(text)) {
                return clipboard;
            }
        },
        checkValid(value) {
            const { validation } = this.props;
            if (validation === 'NONE' || validation === 'OPTIONAL') {
                return true;
            }
            const { justificationText = '', sourceInfo } = value;

            if (!_.isEmpty(sourceInfo)) {
                return true;
            }

            if (justificationText.trim().length) {
                return true;
            }

            return false;
        }
    });

    return redux.connect(
        (state, props) => {
            const { properties } = state.configuration;
            return {
                validation: props.validationOverride || properties['field.justification.validation'],
                vertices: elementSelectors.getVertices(state),
                ...props
            };
        },

        (dispatch, props) => ({
            loadVertex(id) {
                dispatch(elementActions.get({ vertexIds: [id] }));
            }
        })
    )(JustificationEditor);
});
