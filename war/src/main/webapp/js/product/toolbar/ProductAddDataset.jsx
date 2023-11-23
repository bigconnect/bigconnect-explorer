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
    'public/v1/api',
    'data/web-worker/store/product/actions',
    'px/extensions/growl'
], function(createReactClass, PropTypes, bcApi, productActions) {
    'use strict';

    const AddDataset = createReactClass({
        getInitialState() {
            return {
                searchId: '',
                searches: []
            }
        },

        componentWillMount() {
            this.props.dataRequest('search', 'all')
                .then((searches) => {
                    this.setState({ searches });
                });
        },

        addDatasetToProduct() {
            if('none' != this.state.searchId) {
                this.props.dataRequest('product', 'addDataset', this.props.product.id, this.state.searchId)
                    .then(result => {
                        if(result.resultsTruncated) {
                            $.growl.warning({
                                message: `More than ${result.threshold} vertices in the dataset, truncated to ${result.threshold}`,
                            });
                        }

                        bcData.storePromise.then(store => {
                            store.dispatch(productActions.updateNeedsLayout(this.props.product.id, true));
                        });
                    })
                    .catch(e => $.growl.error({message: e}));
            }
        },

        render() {
            return (
                <div className='input-group'>
                    <select className="custom-select form-control" onChange={(e) => { this.setState({searchId : e.target.value}) }}>
                        <option key={'none'} value={'none'}>Incarca set de date...</option>
                        {this.state.searches.map(search => {
                            return (<option key={search.id} value={search.id}>{search.name}</option>)
                        })}
                    </select>
                    <span className="input-group-btn">
                        <button
                            className={'btn btn-info'}
                            onClick={() => { this.addDatasetToProduct() }}
                            disabled={!this.state.searchId || this.state.searchId === 'none'}
                        >Add</button>
                    </span>
                </div>
            )
        }
    });


    return bcApi.connectReact()(AddDataset);;
})
