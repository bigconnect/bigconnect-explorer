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
    'classnames',
    'codemirror',
    'cypher-codemirror',
    'codemirror/addon/lint/lint',
    'codemirror/addon/hint/show-hint',
    'codemirror/addon/edit/closebrackets',
], function(React, PropTypes, createReactClass, classNames, codemirror, createCypherEditor) {

    function normalizeLineEndings (str) {
        if (!str) return str;
        return str.replace(/\r\n|\r/g, '\n');
    }

    const CodeMirror = createReactClass({
        getInitialState() {
            return {
                isFocused: true
            }
        },

        getCodeMirrorInstance () {
            return codemirror;
        },

        componentWillMount () {
            this.componentWillReceiveProps = _.debounce(this.componentWillReceiveProps, 0);
        },

        componentDidMount () {
            const textareaNode = this.editorReference
            const { editor, editorSupport } = createCypherEditor.createCypherEditor(
                textareaNode,
                this.props.options
            )

            this.codeMirror = editor
            this.codeMirror.on('change', this.codemirrorValueChanged)
            this.codeMirror.on('focus', this.focusChanged.bind(this, true))
            this.codeMirror.on('blur', this.focusChanged.bind(this, false))
            this.codeMirror.on('scroll', this.scrollChanged)
            this.codeMirror.setValue(this.props.defaultValue || this.props.value || '')
            this.editorSupport = editorSupport
            this.editorSupport.setSchema(this.props.schema)

            if (this.props.initialPosition) {
                this.goToPosition(this.props.initialPosition)
            }
        },

        goToPosition (position) {
            for (let i = 0; i < position.line; i++) {
                this.codeMirror.execCommand('goLineDown')
            }

            for (let i = 0; i <= position.column; i++) {
                this.codeMirror.execCommand('goCharRight')
            }
        },

        componentWillReceiveProps (nextProps) {
            if (
                this.codeMirror &&
                nextProps.value !== undefined &&
                normalizeLineEndings(this.codeMirror.getValue()) !==
                normalizeLineEndings(nextProps.value)
            ) {
                if (this.props.preserveScrollPosition) {
                    const prevScrollPosition = this.codeMirror.getScrollInfo()
                    this.codeMirror.setValue(nextProps.value)
                    this.codeMirror.scrollTo(
                        prevScrollPosition.left,
                        prevScrollPosition.top
                    )
                } else {
                    this.codeMirror.setValue(nextProps.value)
                }
            }
            if (typeof nextProps.options === 'object') {
                for (let optionName in nextProps.options) {
                    if (nextProps.options.hasOwnProperty(optionName)) {
                        this.codeMirror.setOption(optionName, nextProps.options[optionName])
                    }
                }
            }
            if (nextProps.schema) {
                this.editorSupport.setSchema(this.props.schema)
            }
        },

        getCodeMirror () {
            return this.codeMirror
        },

        focus () {
            if (this.codeMirror) {
                this.codeMirror.focus()
            }
        },

        focusChanged (focused) {
            this.setState({
                isFocused: focused
            })
            this.props.onFocusChange && this.props.onFocusChange(focused)
        },

        scrollChanged (cm) {
            this.props.onScroll && this.props.onScroll(cm.getScrollInfo())
        },

        codemirrorValueChanged (doc, change) {
            if (this.props.onChange && change.origin !== 'setValue') {
                this.props.onChange(doc.getValue(), change)
            }
        },
        render () {
            const clearClicked  = () => {
               this.codeMirror.setValue("");
                this.props.onClear();
            };

            var initialClass = 'ReactCodeMirror';
            if (this.props.error != null) {
                initialClass+=" advancedError";
            }

            const editorClassNames = classNames(
                initialClass,
                { 'ReactCodeMirror--focused': this.state.isFocused },
                this.props.classNames
            )

            const setEditorReference = ref => {
                this.editorReference = ref
            }

            return (
                <div className="cypherEditor">
                    <div className={editorClassNames} ref={setEditorReference} />
                    <div className="advancedClear" onClick={clearClicked} />
                </div>
            );
        }
    });

    return CodeMirror;
});
