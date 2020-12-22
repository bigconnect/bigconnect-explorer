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
    'public/v1/api', 'react', 'create-react-class', 'swal'
], function(bcApi, React, createReactClass, swal) {
    'use strict';

    const DeleteData = createReactClass({
        getInitialState() {
            return {
                savedSearches: [],
                selectedSearch: '0',
                backup: false
            };
        },

        componentDidMount() {
            this.loadSavedSearches();
        },

        loadSavedSearches() {
            bcApi.connect().then(({ dataRequest }) => {
                dataRequest('search', 'all', '/element/search')
                    .then((savedSearches) => {
                        this.setState({savedSearches});
                        console.log('Saved searches: ');
                        console.log(savedSearches);
                    });
            });
        },

        savedSearchChanged(newSearchId) {
            this.setState({
                selectedSearch: newSearchId
            });
        },

        handleBackupCheckboxChange(event) {
            this.setState({
                backup: event.target.checked
            });
        },

        deleteItems() {
            const searchToDelete = _.find(this.state.savedSearches, s => s.id === this.state.selectedSearch);
            swal({
                title: 'Delete items for saved search',
                text: `Are you sure you want to delete items identified by search: ${searchToDelete.name} ?`,
                type: 'warning',
                showCancelButton: true
            }).then((result) => {
                if (result.value) {
                    bcApi.connect().then(({dataRequest}) => {
                        dataRequest('admin', 'deleteElements', searchToDelete.id, this.state.backup)
                            .then((response) => {
                                console.log('Delete search elements response: ');
                                console.log(response);
                            })
                    })
                }
            });
        },

        restoreItems() {
            const searchToRestore = _.find(this.state.savedSearches, s => s.id === this.state.selectedSearch);
            swal({
                title: 'Restore items for saved search',
                text: `Are you sure you want to restore items previously identified by search: ${searchToRestore.name} ?`,
                type: 'warning',
                showCancelButton: true
            }).then((result) => {
                if (result.value) {
                    bcApi.connect().then(({dataRequest}) => {
                        dataRequest('admin', 'restoreElements', searchToRestore.id)
                            .then((response) => {
                                console.log('Restore search elements response: ');
                                console.log(response);
                            })
                    })
                }
            });
        },

        render() {
            const savedSearchOptions = this.state.savedSearches.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
            ));

            return (
                <div className="container-fluid">
                    <div className="row">
                        <div className="col-md-3">
                            <div className="form-group">
                                <label className="control-label" htmlFor="savedSearchSelector">Saved searches:</label>
                                <select className="custom-select form-control" id="savedSearchSelector"
                                        value={this.state.selectedSearch}
                                        onChange={(e) => { this.savedSearchChanged(e.target.value) }}>
                                    <option key={'0'} value={'0'}>Select search...</option>
                                    {savedSearchOptions}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div className="col-md-12">
                            <div className="form-group">
                                <label>
                                    Backup elements?
                                    <input type="checkbox" id="hasBackup" name="hasBackup" className="custom-checkbox"
                                           checked={this.state.backup}
                                           onChange={this.handleBackupCheckboxChange} />
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-md-2">
                            <div className="form-group">
                                <button disabled={this.state.selectedSearch === '0'}
                                    onClick={() => this.deleteItems()}
                                    className="btn btn-sm btn-primary m-t-1">Delete items</button>
                            </div>
                        </div>
                        <div className="col-md-2">
                            <div className="form-group">
                                <button disabled={this.state.selectedSearch === '0'}
                                        onClick={() => this.restoreItems()}
                                        className="btn btn-sm btn-primary m-t-1">Restore items</button>
                            </div>
                        </div>
                    </div>
                </div>
            )
        }
    });

    return DeleteData;
});

