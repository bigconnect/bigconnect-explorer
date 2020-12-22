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
    'data/web-worker/store/user/selectors',
    '../Attacher',
    '../RegistryInjectorHOC',
    'public/v1/api',
    'react-virtualized-select'
], function(createReactClass, PropTypes, redux, userSelectors, Attacher, RegistryInjectorHOC, bcApi, { default: VirtualizedSelect }) {

    const DEFAULT_FLIGHT_EDITOR = 'util/visibility/default/edit';

    const VisibilityEditor = createReactClass({
        componentDidMount() {

            bcApi.connect().then(({ dataRequest }) => {
                dataRequest('role', 'all')
                .then((roles) => {
                    let allRoles = roles.map((role) => {
                        return {
                            value: role.roleName, label: role.roleName
                        }
                    });

                    allRoles.unshift({value: "", label: "Public"});
                    this.setState({allRoles: allRoles});
                })
                .catch((e) => {
                    this.setState({error: e});
                })
            });
        },
        propTypes: {
            onVisibilityChanged: PropTypes.func
        },
        getDefaultProps() {
            return { value: '', placeholder: i18n('visibility.label') }
        },
        getInitialState() {
            return { value: this.props.value, valid: true }
        },
        componentWillReceiveProps({ value }) {
            if (value !== this.state.value) {
                this.setState({ value, valid: this.checkValid(value) })
            }
        },
        render() {
            const { registry, style, value: oldValue, placeholder, ...rest } = this.props;
            const { value, valid } = this.state;
            const custom = _.first(registry['org.bigconnect.visibility']);

            // Use new react visibility renderer as default if no custom exists
            if (custom && custom.editorComponentPath !== DEFAULT_FLIGHT_EDITOR) {
                return (
                    <Attacher
                        value={value}
                        placeholder={placeholder}
                        componentPath={custom.editorComponentPath}
                        {...rest} />
                );
            }

            const selectClass = valid ? '' : 'invalid';

            return (
                <VirtualizedSelect
                    className={selectClass}
                    options={this.state.allRoles}
                    multi={false}
                    value={value}
                    onChange={this.onChange}
                />
            )
        },
        onChange(event) {
            const value = event != null ? event.value : "";
            const valid = this.checkValid(value)
            this.setState({ value, valid })
            this.props.onVisibilityChanged({ value, valid })
        },
        checkValid(value) {
            return Boolean(!value.length || this.state.allRoles.map(obj => obj.value).indexOf(value) >= 0);
        }
    });

    return redux.connect(
        (state, props) => {
            return {
                authorizations: userSelectors.getAuthorizations(state),
                ...props
            };
        },

        (dispatch, props) => ({
        })
    )(RegistryInjectorHOC(VisibilityEditor, [
        'org.bigconnect.visibility'
    ]));
});
