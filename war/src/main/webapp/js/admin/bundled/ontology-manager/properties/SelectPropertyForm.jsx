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
    'react', 'create-react-class', 'prop-types', '../../../../components/Modal'
], function (React, createReactClass, PropTypes, Modal) {

    const SelectPropertyForm = createReactClass({
        propTypes: {
            properties: PropTypes.array.isRequired
        },

        getInitialState() {
            const selectedProperty = this.props.properties.length > 0 ? this.props.properties[0].title : '';
            return {
                selected: selectedProperty
            }
        },

        componentWillMount() {
            this.promise = new $.Deferred();
        },

        save() {
            this.promise.resolve(_.filter(this.props.properties, p => p.title === this.state.selected)[0]);
        },

        render() {
            return (
                <Modal>
                    <div className='modal-header'>
                        <h4 className='modal-title'>Choose Property</h4>
                    </div>

                    <div className='modal-body form-horizontal'>
                        <div className="form-group">
                            <label htmlFor="property" className="col-md-3 control-label">Property</label>
                            <div className="col-md-9">
                                <select id="property" className="custom-select form-control" required
                                        value={this.state.selected}
                                        onChange={(e) => { this.setState({selected: e.target.value})} }
                                >
                                    {
                                        _.map(this.props.properties, (property, index) => (
                                            <option key={index} value={property.title}>{property.title}</option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>

                    </div>

                    <div className='modal-footer'>
                        <div className='text-center'>
                            <button
                                role='abort'
                                type='button'
                                className='btn btn-danger'
                                onClick={this.promise.reject}
                            >Cancel</button>
                            {' '}
                            <button
                                role='confirm'
                                type='button'
                                disabled={!this.state.selected}
                                className='btn btn-primary'
                                onClick={this.save}
                            >OK</button>
                        </div>
                    </div>
                </Modal>
            );
        }
    });

    return SelectPropertyForm;
});
