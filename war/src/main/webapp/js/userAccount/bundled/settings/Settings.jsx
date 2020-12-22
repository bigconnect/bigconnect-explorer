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
    './BooleanSetting'
], function(React, createReactClass, registry, BooleanSetting) {
    'use strict';

    /**
     * Adds new settings to the general settings page
     *
     * @param {string} identifier Unique identifier for this setting
     * @param {string} group The group i18n message id
     * @param {string} displayName The display name i18n message id
     * @param {string} type One of 'boolean', 'custom'
     * @param {string=} componentPath Required when type=custom
     * @param {string=} uiPreferenceName Required when type=boolean, if getInitialValue and onChange are not provided
     * @param {string=} getInitialValue Required when type=boolean, if uiPreferenceName is not provided
     * @param {string=} onChange Required when type=boolean, if uiPreferenceName is not provided
     */
    registry.documentExtensionPoint('org.bigconnect.user.account.page.setting',
        'Add new settings to the general settings page',
        function(e) {
            if (!(('identifier' in e) && ('group' in e) && ('displayName' in e) && ('type' in e))) {
                return false;
            }
            switch (e.type) {
                case 'boolean':
                    return ('uiPreferenceName' in e) || (('getInitialValue' in e) && ('onChange' in e));

                case 'custom':
                    return ('componentPath' in e);

                default:
                    return false;
            }
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/user-profile-section'
    );

    const TIMEZONE_SETTING = {
        identifier: 'org.bigconnect.user.account.page.setting.timezone',
        group: 'useraccount.page.settings.setting.group.locale',
        displayName: 'useraccount.page.setting.timezone.displayName',
        type: 'custom',
        componentPath: 'userAccount/bundled/settings/TimeZoneSetting'
    };

    const SettingsSetting = createReactClass({
        getInitialState() {
            return {
                component: null
            };
        },

        componentWillMount() {
            this.update(this.props);
        },

        componentWillReceiveProps(nextProps) {
            this.update(nextProps);
        },

        update(props) {
            if (props.setting) {
                const setting = props.setting;
                switch (setting.type) {
                    case 'boolean':
                        this.setState({
                            component: BooleanSetting
                        });
                        break;

                    case 'custom':
                        if (setting.componentPath) {
                            require([setting.componentPath], component => {
                                this.setState({
                                    component: component
                                });
                            });
                        } else {
                            console.error('custom settings must include "componentPath"');
                        }
                        break;

                    default:
                        console.error(`invalid setting type "${setting.type}"`);
                        break;
                }
            }
        },

        render() {
            return (<li className="setting">
                {this.state.component ? (<this.state.component setting={this.props.setting}/>) : (<div></div>)}
            </li>);
        }
    });

    const SettingsGroup = createReactClass({
        render() {
            const settings = _.sortBy(this.props.settings, s => i18n(s.displayName));

            return (<li>
                <h4 className="settings-group-title">{i18n(this.props.groupKey)}</h4>
                <ul className="settings-group">
                    {settings.map(setting => {
                        return (<SettingsSetting key={setting.identifier} setting={setting}/>);
                    })}
                </ul>
            </li>);
        }
    });

    const Settings = createReactClass({
        getSettingsExtensions() {
            const settings = registry.extensionsForPoint('org.bigconnect.user.account.page.setting');

            if (!_.findWhere(settings, {identifier: TIMEZONE_SETTING.identifier})) {
                registry.registerExtension('org.bigconnect.user.account.page.setting', TIMEZONE_SETTING);
                settings.push(TIMEZONE_SETTING);
            }

            return settings;
        },

        render() {
            const settings = this.getSettingsExtensions();
            const groups = _.groupBy(settings, s => s.group);
            const groupKeys = _.sortBy(Object.keys(groups), key => i18n(key));

            return (
                <div>
                    <div className='profile-page-title'>
                        <h1>Settings</h1>
                        <hr/>
                    </div>

                    <div className='profile-page-content'>
                        <ul className="general-settings">
                            {groupKeys.map(groupKey => {
                                return (<SettingsGroup key={groupKey} groupKey={groupKey} settings={groups[groupKey]}/>);
                            })}
                        </ul>
                    </div>
                </div>
            );
        }
    });

    return Settings;
});
