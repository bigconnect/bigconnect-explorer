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
    'components/cypherEditor/Codemirror'
], function(createReactClass, PropTypes, Codemirror) {

    const RichText = createReactClass({
        propTypes: {
            item: PropTypes.object.isRequired,
            extension: PropTypes.object.isRequired,
            configurationChanged: PropTypes.func.isRequired,
            configureItem: PropTypes.func.isRequired,
            finishedLoading: PropTypes.func.isRequired,
            showError: PropTypes.func.isRequired,
            bcApi: PropTypes.object.isRequired
        },

        getInitialState() {
            const initialContent = this.props.item.configuration.content ||
                '<p>Toggle the editing mode to get started...</p>';

            return {
                editing: false,
                content: initialContent,
            }
        },

        componentDidMount() {
            this.legacyListeners({
                editRichText: (event, data) => {
                    const { editing } = this.state;
                    this.setState({ editing: !editing })
                }
            })

            this.editorReference = null;
        },

        componentDidUpdate(prevProps, prevState) {
            if(prevState.editing && !this.state.editing) {
                // save data
                const { item, extension } = this.props;
                const configuration = {
                    ...item.configuration,
                    content: this.state.content
                }
                item.configuration = configuration;

                this.props.configurationChanged({
                    item: item,
                    extension: extension
                })
            }
        },

        onChange(content) {
            this.setState({content});
        },

        render() {
            const { editing, content } = this.state;

            const options = {
            }

            return (
                <div className="rich-editor-item">
                    {editing ?
                        <Codemirror
                            options={options}
                            onChange={this.onChange}
                            value={content}
                        />
                        :
                        <div dangerouslySetInnerHTML={{ __html: content }}></div> }
                </div>
            )
        },

        legacyListeners(map) {
            this.removeEvents = [];

            _.each(map, (handler, events) => {
                var node = document;
                var func = handler;
                if (!_.isFunction(handler)) {
                    node = handler.node;
                    func = handler.handler;
                }
                this.removeEvents.push({ node, func, events });
                $(node).on(events, func);
            })
        },

        getCodeMirrorInstance () {
            return codemirror;
        }
    });

    return RichText;
});
