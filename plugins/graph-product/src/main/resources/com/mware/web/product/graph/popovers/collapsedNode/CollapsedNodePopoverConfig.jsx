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
    'data/web-worker/store/product/selectors'
], function (createReactClass, PropTypes, redux, productSelectors) {
    'use strict';

    const CollapsedNodePopoverConfig = createReactClass({
        propTypes: {
            collapsedNode: PropTypes.object,
            collapsedNodeId: PropTypes.string.isRequired,
            close: PropTypes.func.isRequired,
            onRename: PropTypes.func.isRequired
        },

        getInitialState() {
            return {}
        },

        componentDidMount() {
            $(document).on('keydown.org-bigconnect-graph-collapsed-node-popover', (event) => {
                switch (event.which) {
                    case 13: this.onSubmit(); break; //enter
                    case 27: this.props.close(); break; //esc
                }
            });
        },

        componentWillUnmount() {
            $(document).off('.org-bigconnect-graph-collapsed-node-popover');
        },

        componentWillReceiveProps(nextProps) {
            if (!nextProps.collapsedNode) {
                this.props.close();
            }
        },

        render() {
            const { title } = this.state;
            const { title: initialTitle } = this.props.collapsedNode;
            const hasChanges = title !== undefined && title !== initialTitle;

            return (
                <div className="title-edit">
                    <input
                        className="rename"
                        style={{ flexGrow: 1, flexShrink: 1, margin: 0 }}
                        type="text"
                        placeholder={i18n('org.bigconnect.web.product.graph.collapsedNode.popover.automatic.title')}
                        value={title !== undefined ? title : initialTitle ? initialTitle : ''}
                        onChange={this.onTitleChange}
                    />
                    <button
                        className="btn btn-primary"
                        style={{ flexGrow: 0, flexShrink: 1, flexBasis: '20%', margin: 0, marginLeft: '0.25em'}}
                        disabled={!hasChanges}
                        onClick={this.onSubmit}>
                        {i18n('org.bigconnect.web.product.graph.collapsedNode.popover.rename')}
                    </button>
                </div>
            );
        },

        onTitleChange(event) {
            this.setState({ title: event.target.value });
        },

        onSubmit() {
            this.props.onRename(this.state.title);
            this.props.close();
        }
    });

    return redux.connect(
        (state, props) => {
            const product = productSelectors.getProduct(state);
            const collapsedNode = product.extendedData
                && product.extendedData.compoundNodes
                && product.extendedData.compoundNodes[props.collapsedNodeId];
            return {
                ...props,
                collapsedNode
            }
        }
    )(CollapsedNodePopoverConfig);
});
