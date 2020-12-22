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
    'create-react-class',
    'configuration/plugins/registry',
    'util/withDataRequest',
    'util/parsers'
], function (React, createReactClass, registry, withDataRequest, P) {
    'use strict';

    const BooleanSetting = createReactClass({
        getInitialState() {
            return {
                disabled: true,
                value: false
            }
        },

        componentWillMount() {
            if (this.props.setting.uiPreferenceName) {
                this.setState({
                    disabled: false,
                    value: P.bool.parse(bcData.currentUser.uiPreferences[this.props.setting.uiPreferenceName], false)
                });
            } else if (this.props.setting.getInitialValue) {
                Promise.resolve(this.props.setting.getInitialValue())
                    .then(value => {
                        this.setState({
                            disabled: false,
                            value: P.bool.parse(value)
                        });
                    });
            } else {
                console.error('boolean properties require a "uiPreferenceName" or "getInitialValue"');
            }
        },

        handleCheckboxChange(evt) {
            const checked = evt.target.checked;
            this.setState({
                disabled: true
            });
            this.handleChange(checked)
                .then(newValue => {
                    this.setState({
                        disabled: false,
                        value: P.bool.parse(newValue)
                    });
                });
        },

        handleChange(value) {
            const onChange = this.props.setting.onChange || Promise.resolve;
            return onChange(value)
                .then(value => {
                    if (this.props.setting.uiPreferenceName) {
                        value = value.toString();
                        return withDataRequest.dataRequest('user', 'preference', this.props.setting.uiPreferenceName, value)
                            .then(() => {
                                bcData.currentUser.uiPreferences[this.props.setting.uiPreferenceName] = value;
                                return value;
                            });
                    } else {
                        return value;
                    }
                });
        },

        render() {
            return (<label>
                <div className="display-name">{i18n(this.props.setting.displayName)}</div>
                <input type="checkbox" disabled={this.state.disabled} checked={this.state.value}
                       onChange={this.handleCheckboxChange}/>
            </label>);
        }
    });

    return BooleanSetting;
});
