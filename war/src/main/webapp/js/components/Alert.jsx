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
    'create-react-class', 'prop-types'
], function(createReactClass, PropTypes) {
    'use strict';

    const Alert = createReactClass({
        propTypes: {
            error: PropTypes.any,
            onDismiss: PropTypes.func
        },

        componentWillReceiveProps(nextProps) {
            if (nextProps.error && nextProps.error !== this.props.error) {
                console.error(nextProps.error);
            }
        },
        renderMessage() {
            const { error } = this.props;

            var info;
            if (_.isString(error)) {
                info = error;
            } else if (error.statusText) {
                info = error.statusText;
            } else {
                info = i18n('admin.plugin.error');
            }

            if (_.isArray(info) && info.length > 1) {
                return (
                    <ul>
                        {info.map((i)=> {
                            return (<li>{i}</li>);
                        })}
                    </ul>
                )
            } else if (_.isArray(info)) {
                return (<div>{info[0]}</div>);
            } else {
                return (<div>{info}</div>);
            }
        },

        renderType() {
            if (this.props.error.type) {
                return (<strong>{this.props.error.type}</strong>);
            }
            return null;
        },

        handleDismissClick(e) {
            if (this.props.onDismiss) {
                this.props.onDismiss(e);
            }
        },

        render() {
            if (!this.props.error) {
                return null;
            }

            return (
                <div className="alert alert-danger">
                    {this.props.onDismiss ?
                        ( <button type="button" className="close" onClick={this.handleDismissClick}>&times;</button> )
                        : null
                    }
                    {this.renderType()}
                    {this.renderMessage()}
                </div>
            );
        }
    });

    return Alert;
});
