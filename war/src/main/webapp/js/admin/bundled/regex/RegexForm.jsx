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
    '../../../components/ontology/ConceptSelector',
], function (React,
             PropTypes,
             createReactClass,
             {default: VirtualizedSelect},
             Alert,
             ConceptSelector) {

    const RegexForm = createReactClass({
        propTypes: {
            changeAppMode: PropTypes.func.isRequired,
            userId: PropTypes.string,
            mode: PropTypes.string.isRequired
        },

        getInitialState() {
            return {
                id: '',
                name: '',
                pattern: '',
                error: null,
            }
        },

        componentWillMount() {
            this.dataRequest = this.props.bcApi.v1.dataRequest;
        },

        componentDidMount() {
            if (this.props.mode === 'edit') {
                this.dataRequest('regex', 'getById', this.props.regexId)
                    .then((regex) => {
                        this.setState({
                            id: regex.id,
                            name: regex.name,
                            pattern: regex.pattern,
                            concept: regex.concept
                        });
                    })
                    .catch((e) => {
                        this.setState({error: e});
                    })
            }
        },
        onConceptSelected(concept) {
            if (concept != null) {
                this.setState({concept: concept.id})
            }
        },
        onSave(e) {
            e.preventDefault();

            var self = this;
            this.dataRequest('regex', 'addOrEdit', this.state, this.props.mode)
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

        render() {
            var modeText = (this.props.mode === 'edit') ? 'Edit' : 'Add';


            return (
                <div className="panel">
                    <div className="panel-heading">
                        <div className="panel-heading-title">{modeText} Expression</div>
                    </div>

                    <div className="panel-body">
                        <form onSubmit={this.onSave} className="form-horizontal">
                        <Alert error={this.state.error} onDismiss={this.handleAlertDismiss}/>

                        <div className="form-group">
                            <label className="col-sm-2 control-label" htmlFor="inputRegexName">Regex Name:</label>
                            <div className="col-sm-5">
                                <input type="text"
                                       className="form-control"
                                       id="inputRegexName"
                                       value={this.state.name}
                                       required
                                       placeholder="Regex name"
                                       onChange={(e) => {
                                           this.setState({name: e.target.value})
                                       }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="col-sm-2 control-label" htmlFor="inputPattern">Pattern:</label>
                            <div className="col-sm-5">
                                <input type="text"
                                       className="form-control"
                                       id="inputPattern"
                                       value={this.state.pattern}
                                       required
                                       placeholder="Pattern"
                                       onChange={(e) => {
                                           this.setState({pattern: e.target.value})
                                       }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="col-sm-2 control-label" htmlFor="inputConceptSelector">Concept:</label>
                            <div className="col-sm-5 regex-concept">
                                <ConceptSelector
                                    clearable={true}
                                    id="inputConceptSelector"s
                                    onSelected={this.onConceptSelected}
                                    value={this.state.concept}/>
                            </div>
                        </div>

                        <div className="form-group">
                            <div className="col-sm-12 text-center">
                                <div className="btn-group">
                                    <button className="btn btn-danger p-x-4" onClick={() => this.props.changeAppMode('list')}>Cancel</button>
                                    <button className="btn btn-primary m-x-1 p-x-4">Save</button>
                                </div>
                            </div>
                        </div>
                    </form>
                    </div>
                </div>
            )
        }
    });

    return RegexForm;
});
