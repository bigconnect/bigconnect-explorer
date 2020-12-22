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
    './ScrollButtons'
], function(
    createReactClass,
    PropTypes,
    ScrollButtons) {
    'use strict';

    const Tabs = createReactClass({
        propTypes: {
            tabs: PropTypes.object.isRequired,
            activeTab: PropTypes.string,
            onTabClick: PropTypes.func
        },

        getInitialState() {
            return { offset: 0 }
        },

        componentDidMount() {
            this.setState({  overflow: this._container.offsetWidth < this._tabs.scrollWidth });
        },

        onScrollClick(direction) {
            const { offset } = this.state;
            const width = this._container.offsetWidth;
            const totalWidth = this._tabs.scrollWidth;
            const newOffset = direction === 'left' ? Math.max(offset - width, 0) : Math.min(offset + width, totalWidth - width);
            this.setState({ offset: newOffset, overflow: totalWidth - newOffset > width });
        },

        render() {
            const { offset, overflow } = this.state;
            const { tabs, activeTab, onTabClick } = this.props;

            return (
                <div className="tabs">
                    <div className="list-container" ref={(ref) => {this._container = ref}}>
                        <ul className="tab-list" ref={(ref) => {this._tabs = ref}} style={{marginLeft: -offset + 'px'}}>
                            {Object.keys(tabs).map((key) => {
                                const { count, displayName } = tabs[key];
                                const tabClass = key === activeTab ? 'active' : '';

                                return (
                                    <li onClick={() => onTabClick(key)} key={key} className={tabClass}>
                                        <span className="name">{displayName}</span>
                                        <span className="count">{count}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                    <ScrollButtons offset={offset} overflow={overflow} onScrollClick={this.onScrollClick}/>
                </div>
            );
        }
    });

    return Tabs;
});
