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
    'react-dom',
    'create-react-class',
], function(React, ReactDOM, createReactClass) {
    'use strict';

    const Modal = createReactClass({
        statics: {
            showModal : function (Component, props = {}) {
                let wrapper = document.body.appendChild(document.createElement('div'));
                let component = ReactDOM.render(<Component {...props}/>, wrapper);
                let cleanup = function() {
                    ReactDOM.unmountComponentAtNode(wrapper);
                    return setTimeout(function() {
                        return wrapper.remove();
                    });
                };
                return component.promise.always(cleanup).promise();
            }
        },

        backdrop: function() {
            return <div className='modal-backdrop in' />;
        },

        modal: function() {
            var style = {display: 'block'};
            return (
                <div
                    className='modal in'
                    tabIndex='-1'
                    role='dialog'
                    aria-hidden='false'
                    ref='modal'
                    style={style}
                >
                    <div className='modal-dialog' style={{width: this.props.width || '600px'}}>
                        <div className='modal-content'>
                            {this.props.children}
                        </div>
                    </div>
                </div>
            );
        },

        render: function() {
            return (
                <div>
                    {this.backdrop()}
                    {this.modal()}
                </div>
            );
        }
    });

    return Modal;
});
