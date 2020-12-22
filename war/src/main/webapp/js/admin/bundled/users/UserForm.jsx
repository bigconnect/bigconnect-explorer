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
    'react-virtualized-select',
    '../../../components/Alert',
    '../../../util/defaultPrivileges'
], function(
    React,
    PropTypes,
    createReactClass,
    { default: VirtualizedSelect },
    Alert) {

    const UserForm = createReactClass({
        propTypes: {
            changeAppMode: PropTypes.func.isRequired,
            userId: PropTypes.string,
            mode: PropTypes.string.isRequired
        },

        getInitialState() {
            return {
                id: '',
                userName: '',
                displayName: '',
                email: '',
                password: '',
                confirmPassword: '',
                error: null,
                roles: '',
                privileges: 'READ',
                allRoles: []
            }
        },

        componentWillMount() {
            this.dataRequest = this.props.bcApi.v1.dataRequest;
        },

        componentDidMount() {
            if(this.props.mode === 'edit') {
                this.dataRequest('user', 'getById', this.props.userId)
                    .then((user) => {
                        let privs = user.privileges.toString();
                        let rls = user.authorizations.toString();
                        this.setState({
                            id: user.id,
                            userName: user.userName,
                            displayName: user.displayName,
                            email: user.email,
                            roles: rls,
                            privileges: privs
                        });
                    })
                    .catch((e) => {
                        this.setState({error: e});
                    })
            }

            this.dataRequest('role', 'all')
                .then((roles) => {
                    let allRoles = roles.map((role) => {
                        return {
                            value: role.roleName, label: role.roleName
                        }
                    });

                    this.setState({allRoles: allRoles});
                })
                .catch((e) => {
                    this.setState({error: e});
                })
        },

        onSave(e) {
            e.preventDefault();

            if(this.state.password != this.state.confirmPassword) {
                this.setState({ error: {statusText: 'Passwords do not match'}});
                return;
            }

            var self = this;
            this.dataRequest('user', 'addOrEdit', this.state, this.props.mode)
                .then(() => {
                    self.props.changeAppMode('list');
                })
                .catch((e) => {
                    this.setState({error: e});
                })
        },

        handleAlertDismiss() {
            this.setState({
                error: null
            });
        },

        render () {
            var modeText = (this.props.mode === 'edit') ? 'Edit' : 'Add';
            var passwordRequired = (this.props.mode == 'create');

            var allPrivileges = _.map(PRIVILEGES, (p) => {
                return { value: p, label: p }
            });

            return (
                <div className="panel">
                    <div className="panel-heading">
                        <div className="panel-heading-title">{modeText} User</div>
                    </div>

                    <div className="panel-body">
                        <form onSubmit={this.onSave} className="form-horizontal">
                        <Alert error={this.state.error} onDismiss={this.handleAlertDismiss}/>

                        <div className="form-group">
                            <label className="col-sm-2 control-label" htmlFor="inputUsername">Username:</label>
                            <div className="col-sm-3">
                                <input type="text"
                                       className="form-control"
                                       id="inputUsername"
                                       value={this.state.userName}
                                       required
                                       placeholder="Username"
                                       onChange={(e) => { this.setState({ userName: e.target.value }) }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="col-sm-2 control-label" htmlFor="inputDisplayName">Display name:</label>
                            <div className="col-sm-4">
                                <input type="text"
                                       className="form-control"
                                       id="inputDisplayName"
                                       value={this.state.displayName}
                                       required
                                       placeholder="Display name"
                                       onChange={(e) => { this.setState({ displayName: e.target.value }) }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="col-sm-2 control-label" htmlFor="inputEmail">Email:</label>
                            <div className="col-sm-3">
                                <input type="text"
                                       className="form-control"
                                       id="inputEmail"
                                       value={this.state.email}
                                       required
                                       placeholder="Email"
                                       onChange={(e) => { this.setState({ email: e.target.value }) }}
                                />
                                </div>
                        </div>

                        <div className="form-group">
                            <label className="col-sm-2 control-label" htmlFor="inputPassword">Password:</label>
                            <div className="col-sm-3">
                                <input type="password"
                                       className="form-control"
                                       id="inputPassword"
                                       value={this.state.password}
                                       required={passwordRequired}
                                       placeholder="Password"
                                       onChange={(e) => { this.setState({ password: e.target.value }) }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="col-sm-2 control-label" htmlFor="inputConfirmPassword">Confirm Password:</label>
                            <div className="col-sm-3">
                                <input type="password"
                                       className="form-control"
                                       id="inputConfirmPassword"
                                       value={this.state.confirmPassword}
                                       required={passwordRequired}
                                       placeholder="Confirm password"
                                       onChange={(e) => { this.setState({ confirmPassword: e.target.value }) }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="col-sm-2 control-label" htmlFor="inputPrivileges">Privileges:</label>
                            <div className="col-sm-9">
                                <VirtualizedSelect
                                    id="inputPrivileges"
                                    name="form-field-prvileges"
                                    options={allPrivileges}
                                    multi={true}
                                    value={this.state.privileges}
                                    onChange={(val) => { this.setState({privileges: val}) }}
                                    clearable
                                    simpleValue
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="col-sm-2 control-label" htmlFor="inputRoles">Roles:</label>
                            <div className="col-sm-9">
                                <VirtualizedSelect
                                    id="inputRoles"
                                    name="form-field-roles"
                                    options={this.state.allRoles}
                                    multi={true}
                                    value={this.state.roles}
                                    onChange={(val) => { this.setState({roles: val}) }}
                                    searchable
                                    clearable
                                    simpleValue
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <div className="col-sm-9 text-center">
                                <div className="btn-group">
                                    <button className="btn btn-danger m-x-1" onClick={(e) => { this.props.changeAppMode('list') }}>Cancel</button>
                                    <button className="btn btn-primary">Save</button>
                                </div>
                            </div>
                        </div>
                    </form>
                    </div>
                </div>
            )
        }
    });

    return UserForm;

});
