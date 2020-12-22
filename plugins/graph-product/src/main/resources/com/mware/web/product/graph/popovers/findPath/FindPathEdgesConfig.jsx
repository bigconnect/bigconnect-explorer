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
    'prop-types'
], function(createReactClass, PropTypes) {

    const FindPathEdgesConfig = createReactClass({
        propTypes: {
            availableEdges: PropTypes.arrayOf(PropTypes.any).isRequired,
            selectedEdgeIris: PropTypes.arrayOf(PropTypes.string).isRequired,
            defaultSelectedEdgeIris: PropTypes.arrayOf(PropTypes.string).isRequired,
            onCancel: PropTypes.func.isRequired,
            onLimit: PropTypes.func.isRequired
        },

        getInitialState() {
            return {
                selectedEdgeIris: [],
                filter: ''
            };
        },

        handleCancel() {
            this.props.onCancel();
        },

        handleLimitClick() {
            this.props.onLimit(this.state.selectedEdgeIris);
        },

        componentWillMount() {
            this.setState({
                selectedEdgeIris: this.props.selectedEdgeIris
            });
        },

        handleEdgeChecked(edge, event) {
            const checked = event.target.checked;
            if (checked && this.state.selectedEdgeIris.indexOf(edge.title) < 0) {
                this.setState({
                    selectedEdgeIris: this.state.selectedEdgeIris.concat([edge.title])
                });
            } else if (!checked) {
                this.setState({
                    selectedEdgeIris: this.state.selectedEdgeIris.filter((iri) => {
                        return iri !== edge.title;
                    })
                });
            }
        },

        handleSelectAllClicked() {
            this.setState({
                selectedEdgeIris: this.props.availableEdges.map((e) => {
                    return e.title;
                })
            });
        },

        handleSelectNoneClicked() {
            this.setState({
                selectedEdgeIris: []
            });
        },

        handleSelectResetClicked() {
            this.setState({
                selectedEdgeIris: this.props.defaultSelectedEdgeIris
            });
        },

        handleSelectFilterChange(event) {
            const filter = event.target.value;
            this.setState({
                filter: filter
            });
        },

        render() {
            const edges = this.props.availableEdges
                .filter((e) => {
                    if (this.state.filter && this.state.filter.length > 0) {
                        return e.displayName.toLocaleLowerCase().indexOf(this.state.filter.toLocaleLowerCase()) >= 0;
                    }
                    return true;
                });

            return (<div className="find-path-edges-config">
                <div className="header">
                    <div className="title">{i18n('org.bigconnect.web.product.graph.findPath.edges.title')}</div>
                    <div className="actions">
                        <button
                            onClick={this.handleCancel}
                            className="btn btn-link">{i18n('org.bigconnect.web.product.graph.findPath.edges.cancel')}</button>
                    </div>
                </div>
                <div className="selection">
                    <div className="edge-list-header">
                        <div className="buttons">
                            <button
                                onClick={this.handleSelectAllClicked}
                                className="btn btn-mini">{i18n('org.bigconnect.web.product.graph.findPath.edges.select.all')}</button>
                            <button
                                onClick={this.handleSelectNoneClicked}
                                className="btn btn-mini">{i18n('org.bigconnect.web.product.graph.findPath.edges.select.none')}</button>
                            <button onClick={this.handleSelectResetClicked}
                                    className="btn btn-mini">{i18n('org.bigconnect.web.product.graph.findPath.edges.select.reset')}</button>
                        </div>
                        <input onChange={this.handleSelectFilterChange}/>
                    </div>
                    <div className="edge-list">
                        {edges.map((edge) => {
                            return (
                                <label key={edge.title}>
                                    <input type="checkbox"
                                           checked={this.state.selectedEdgeIris.indexOf(edge.title) >= 0}
                                           onChange={this.handleEdgeChecked.bind(this, edge)}/>
                                    {edge.displayName}
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="actions">
                    <button onClick={this.handleLimitClick}
                            disabled={this.state.selectedEdgeIris.length === 0}
                            className="btn">{
                                this.state.selectedEdgeIris.length === 1 ?
                                i18n('org.bigconnect.web.product.graph.findPath.edges.ok.single') :
                                i18n('org.bigconnect.web.product.graph.findPath.edges.ok', this.state.selectedEdgeIris.length)
                            }</button>
                </div>
            </div>);
        }
    });

    return FindPathEdgesConfig;
});
