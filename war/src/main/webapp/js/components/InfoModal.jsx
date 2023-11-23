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
    'prop-types',
    'create-react-class',
    './Modal'
], function(React, ReactDOM, PropTypes, createReactClass, Modal) {
    'use strict';

    var InfoModal = createReactClass({
        propTypes: {
            title: PropTypes.string.isRequired,
            content: PropTypes.element,
            loadData: PropTypes.any,
            buttonLabel: PropTypes.string
        },

        statics: {
            showDialog: function (options) {
                var cleanup, component, props, wrapper;
                if (options === null) {
                    options = {};
                }
                wrapper = document.body.appendChild(document.createElement('div'));
                component = ReactDOM.render(<InfoModal {...options}/>, wrapper);
                cleanup = function() {
                    ReactDOM.unmountComponentAtNode(wrapper);
                    return setTimeout(function() {
                        return wrapper.remove();
                    });
                };
                return component.promise.always(cleanup).promise();
            }
        },

        getInitialState() {
            return {
                loading: false,
                asyncComponent: null
            }
        },

        getDefaultProps() {
            return {
                buttonLabel: 'OK'
            };
        },

        componentWillMount() {
            if(this.props.loadData) {
                this.setState({loading: true});
                Promise.resolve(this.props.loadData)
                    .then(comp => {
                        this.setState({asyncComponent: comp});
                    })
                    .done(() => {
                        this.setState({loading: false});
                    });
            }
        },

        componentDidMount() {
            this.promise = new $.Deferred();
            return ReactDOM.findDOMNode(this.refs.close).focus();
        },

        close() {
            return this.promise.resolve();
        },

        dialogContent() {
            if(this.props.content) {
                return this.props.content
            } else {
                if(this.state.loading) {
                    return (<div>Se incarca...</div>);
                } else {
                    return this.state.asyncComponent
                }
            }
        },

        render() {
            return (
                <Modal>
                    <div className='modal-header'>
                        <h4 className='modal-title'>
                            {this.props.title}
                        </h4>
                    </div>
                    <div className='modal-body'>
                        {this.dialogContent()}
                    </div>
                    <div className='modal-footer'>
                        <div className='text-right'>
                            <button
                                role='close'
                                type='button'
                                ref='close'
                                className='btn btn-primary'
                                onClick={this.close}
                            >
                                {this.props.buttonLabel}
                            </button>
                        </div>
                    </div>
                </Modal>
            );
        }
    });

    return InfoModal;
});
