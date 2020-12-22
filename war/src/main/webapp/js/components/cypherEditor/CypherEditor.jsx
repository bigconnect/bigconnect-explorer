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
    'react',
    'prop-types',
    'create-react-class',
    'react-redux',
    'data/web-worker/store/ontology/selectors',
    './Codemirror',
    './cypherFunctions'
], function(
    React,
    PropTypes,
    createReactClass,
    redux,
    ontologySelectors,
    Codemirror,
    cypherFunctions) {

    const CypherEditor = createReactClass({
        propTypes: {
            onExecute: PropTypes.func,
            onClearCypher: PropTypes.func
        },

        getInitialState() {
            return {
                historyIndex: -1,
                buffer: '',
                mode: 'cypher',
                notifications: [],
                expanded: false,
                lastPosition: { line: 0, column: 0 }
            }
        },

        componentWillReceiveProps (nextProps) {
            if ( nextProps.content !== null && nextProps.content !== this.getEditorValue() ) {
                this.setEditorValue(nextProps.content)
                this.execCurrent();
            }
        },

        componentDidMount () {
            this.codeMirror = this.editor.getCodeMirror()
            this.codeMirror.on('change', this.triggerAutocompletion)

            if (this.props.content) {
                this.setEditorValue(this.props.content)
            }
        },

        componentDidUpdate () {
            if (this.editor) {
                const editorHeight = this.editor.editorReference.clientHeight
                if (editorHeight !== this.state.editorHeight) {
                    this.setState({ editorHeight })
                }
            }
        },

        triggerAutocompletion (cm, changed) {
            if (changed.text.length !== 1 || !this.props.enableEditorAutocomplete) {
                return
            }

            const text = changed.text[0]
            const triggerAutocompletion =
                text === '.' ||
                text === ':' ||
                text === '[]' ||
                text === '()' ||
                text === '{}' ||
                text === '[' ||
                text === '(' ||
                text === '{'
            if (triggerAutocompletion) {
                cm.execCommand('autocomplete')
            }
        },

        getEditorValue () {
            return this.codeMirror ? this.codeMirror.getValue().trim() : ''
        },

        setEditorValue (cmd) {
            this.codeMirror.setValue(cmd)
            this.updateCode(cmd, undefined, () => {
                this.focusEditor()
            })
        },
        clearCode() {
            this.props.onClearCypher();
        },

        updateCode (newCode, change, cb = () => {}) {
            const mode =
                this.props.cmdchar && newCode.trim().indexOf(this.props.cmdchar) === 0
                    ? 'text'
                    : 'cypher'

            this.clearHints()

            const lastPosition = change && change.to

            this.setState(
                {
                    mode,
                    lastPosition: lastPosition
                        ? { line: lastPosition.line, column: lastPosition.ch }
                        : this.state.lastPosition,
                    editorHeight: this.editor && this.editor.editorReference.clientHeight
                },
                cb
            )
        },

        clearHints () {
            this.setState({ notifications: [] })
        },

        focusEditor () {
            this.codeMirror.focus()
            this.codeMirror.setCursor(this.codeMirror.lineCount(), 0)
        },

        lineNumberFormatter (line) {
            if (!this.codeMirror || this.codeMirror.lineCount() === 1) {
                return '$'
            } else {
                return line
            }
        },

        handleEnter (cm) {
            if (cm.lineCount() === 1) {
                return this.execCurrent(cm)
            }
            this.newlineAndIndent(cm)
        },

        newlineAndIndent (cm) {
            cm.execCommand('newlineAndIndent')
        },

        clearEditor () {
            this.setEditorValue('')
            this.setContentId(null)
        },

        setContentId (id) {
            this.setState({ contentId: id })
        },

        setGutterMarkers () {
            if (this.codeMirror) {
                this.codeMirror.clearGutter('cypher-hints')
                this.state.notifications.forEach(notification => {
                    this.codeMirror.setGutterMarker(
                        (notification.position.line || 1) - 1,
                        'cypher-hints',
                        (() => {
                            let gutter = document.createElement('div')
                            gutter.style.color = '#822'
                            gutter.innerHTML =
                                '<i class="fa fa-exclamation-triangle gutter-warning gutter-warning" aria-hidden="true"></i>'
                            gutter.title = `${notification.title}\n${notification.description}`
                            gutter.onclick = () => {
                                const action = executeSystemCommand(
                                    `EXPLAIN ${this.getEditorValue()}`
                                )
                                action.forceView = viewTypes.WARNINGS
                                this.props.bus.send(action.type, action)
                            }
                            return gutter
                        })()
                    )
                })
            }
        },

        handleUp (cm) {
            if (cm.lineCount() === 1) {
                this.historyPrev(cm)
                this.moveCursorToEndOfLine(cm)
            } else {
                cm.execCommand('goLineUp')
            }
        },

        historyPrev (cm) {
            if (!this.props.history.length) return
            if (this.state.historyIndex + 1 === this.props.history.length) return
            if (this.state.historyIndex === -1) {
                // Save what's currently in the editor
                this.setState({ buffer: cm.getValue() })
            }
            this.setState({
                historyIndex: this.state.historyIndex + 1,
                editorHeight: this.editor && this.editor.editorReference.clientHeight
            })
            this.setEditorValue(this.props.history[this.state.historyIndex])
        },

        historyNext (cm) {
            if (!this.props.history.length) return;
            if (this.state.historyIndex <= -1) return;
            if (this.state.historyIndex === 0) {
                // Should read from buffer
                this.setState({ historyIndex: -1 });
                this.setEditorValue(this.state.buffer);
                return
            }
            this.setState({
                historyIndex: this.state.historyIndex - 1,
                editorHeight: this.editor && this.editor.editorReference.clientHeight
            })
            this.setEditorValue(this.props.history[this.state.historyIndex])
        },

        handleDown (cm) {
            if (cm.lineCount() === 1) {
                this.historyNext(cm)
                this.moveCursorToEndOfLine(cm)
            } else {
                cm.execCommand('goLineDown')
            }
        },

        moveCursorToEndOfLine (cm) {
            cm.setCursor(cm.lineCount(), 0)
        },

        execCurrent () {
            const value = this.getEditorValue();
            if (!value)
                return;

            this.props.onExecute(value);
            this.setState({ historyIndex: -1, buffer: null, expanded: false });
        },

        render () {
            const options = {
                lineNumbers: true,
                mode: this.state.mode,
                theme: 'cypher',
                gutters: ['cypher-hints'],
                lineWrapping: true,
                autofocus: true,
                smartIndent: false,
                lineNumberFormatter: this.lineNumberFormatter,
                lint: true,
                extraKeys: {
                    'Ctrl-Space': 'autocomplete',
                    Enter: this.handleEnter,
                    'Shift-Enter': this.newlineAndIndent,
                    'Cmd-Enter': this.execCurrent,
                    'Ctrl-Enter': this.execCurrent,
                    'Cmd-Up': this.historyPrev,
                    'Ctrl-Up': this.historyPrev,
                    Up: this.handleUp,
                    'Cmd-Down': this.historyNext,
                    'Ctrl-Down': this.historyNext,
                    Down: this.handleDown
                },
                hintOptions: {
                    completeSingle: false,
                    closeOnUnfocus: false,
                    alignWithWord: true,
                    async: true
                },
                autoCloseBrackets: {
                    explode: ''
                }
            };

            const updateCode = (val, change) => this.updateCode(val, change);
            const clearCode = () => this.clearCode();
            this.setGutterMarkers();

            return (
                <Codemirror
                    ref={ref => { this.editor = ref }}
                    onChange={updateCode}
                    onClear={clearCode}
                    options={options}
                    error={this.props.error}
                    schema={this.props.schema}
                    initialPosition={this.state.lastPosition}
                />
            )
        }
    });

    return redux.connect(
        (state, props) => {
            let concepts = ontologySelectors.getVisibleConceptsList(state);
            let relationships = ontologySelectors.getVisibleRelationships(state);
            let properties = ontologySelectors.getVisiblePropertiesList(state);

            return {
                enableEditorAutocomplete: true,
                content: props.content || null,
                schema: {
                    labels: concepts.map(c => `:${c.id}`),
                    relationshipTypes: relationships.map(r => `:${r.title}`),
                    propertyKeys: properties.map(p => p.title),
                    functions: [ ...cypherFunctions ]
                },
                ...props
            };
        }
    )(CypherEditor);
});
