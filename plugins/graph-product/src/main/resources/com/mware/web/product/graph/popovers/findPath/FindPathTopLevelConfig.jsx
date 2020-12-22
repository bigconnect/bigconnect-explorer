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
    './FindPathHopsImage'
], function (createReactClass, PropTypes, FindPathHopsImage) {
    'use strict';

    const FindPathTopLevelConfig = createReactClass({
        propTypes: {
            availableEdges: PropTypes.arrayOf(PropTypes.any).isRequired,
            selectedEdgeIris: PropTypes.arrayOf(PropTypes.string).isRequired,
            defaultSelectedEdgeIris: PropTypes.arrayOf(PropTypes.string).isRequired,
            maximumHops: PropTypes.number.isRequired,
            executing: PropTypes.bool,
            onMaximumHopsChange: PropTypes.func.isRequired,
            onExecute: PropTypes.func.isRequired,
            onEdgesValueConfigure: PropTypes.func.isRequired
        },

        handleMaximumHopsChange(event) {
            const value = event.target.value;
            this.props.onMaximumHopsChange(parseInt(value));
        },

        handleExecuteClick() {
            this.props.onExecute();
        },

        handleEdgesValueClick() {
            this.props.onEdgesValueConfigure();
        },

        render(){
            const count = this.props.selectedEdgeIris.length;
            const edgesLabel = this.props.availableEdges.length === count
                ? i18n('org.bigconnect.web.product.graph.findPath.edgesAll')
                : arraysContainsSameItems(this.props.selectedEdgeIris, this.props.defaultSelectedEdgeIris)
                    ? i18n('org.bigconnect.web.product.graph.findPath.edgesDefault')
                    : count === 1
                    ? i18n('org.bigconnect.web.product.graph.findPath.edgesCount.single', count)
                    : i18n('org.bigconnect.web.product.graph.findPath.edgesCount', count);

            return (<div className="find-path-config">
                <div className="field">
                    <div className="field-title-value">
                        <div className="field-title">{i18n('org.bigconnect.web.product.graph.findPath.edges')}</div>
                        <div className="value" onClick={this.handleEdgesValueClick}>{edgesLabel}</div>
                    </div>
                    <div className="subtitle">{i18n('org.bigconnect.web.product.graph.findPath.edgesSubtitle')}</div>
                </div>
                <div className="field">
                    <div className="field-title-value">
                        <div className="field-title">{i18n('org.bigconnect.web.product.graph.findPath.maximumHops')}</div>
                        <div className="value">
                            <div className="select-wrapper">
                                <select value={this.props.maximumHops} onChange={this.handleMaximumHopsChange}>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                    <option value="5">5</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="subtitle">{i18n('org.bigconnect.web.product.graph.findPath.maximumHopsSubtitle')}</div>

                    <FindPathHopsImage
                        hops={this.props.maximumHops}
                        hopsTitle={i18n('org.bigconnect.web.product.graph.findPath.maximumHopsImageAltText', this.props.maximumHops)}
                        onChange={this.props.onMaximumHopsChange}/>
                </div>
                <div>
                    <button
                        className="btn btn-primary btn-raised find-path"
                        disabled={this.props.executing}
                        onClick={this.handleExecuteClick}>{i18n('org.bigconnect.web.product.graph.findPath.execute')}</button>
                </div>
            </div>);
        }
    });

    function arraysContainsSameItems(a1, a2) {
        if (a1.length !== a2.length) {
            return false;
        }
        a1 = a1.sort();
        a2 = a2.sort();
        for (let i = 0; i < a1.length; i++) {
            if (a1[i] !== a2[i]) {
                return false;
            }
        }
        return true;
    }

    return FindPathTopLevelConfig;
});
