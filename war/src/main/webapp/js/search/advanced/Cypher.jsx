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
    'public/v1/api',
    'react',
    'create-react-class',
    'prop-types',
    'react-redux',
    'components/cypherEditor/CypherEditor',
    'util/component/attacher'
], function(bcApi, React, createReactClass, PropTypes, redux, CypherEditor, attacher) {
    'use strict';

    const MAX_HISTORY_ITEMS = 50;

    const Cypher = createReactClass({
        propTypes: {
            renderResults: PropTypes.func.isRequired,
            setCurrentSearchForSaving: PropTypes.func.isRequired,
            updateQueryStatus: PropTypes.func.isRequired,
            initialParameters: PropTypes.object
        },

        getInitialState() {
            return {
                error: null,
                searchResults: null,
                query: null,
                loading: false,
                resultsPerPage: 10,
                currentPage: 1,
                history: []
            }
        },

        componentDidMount() {
            const comp = $('.advanced-search-type-desc');
            comp.show();
            attacher()
                .node(comp)
                .params({
                    onVisualSearch: this.onVisualSearch
                })
                .path('search/advanced/cypherVisualGlue')
                .attach();
        },

        componentWillReceiveProps(nextProps) {
            if (nextProps.initialParameters && nextProps.initialParameters.query) {
                this.setState({
                    query: nextProps.initialParameters.query,
                    searchResults: null,
                    currentPage: 1
                })
            }
        },

        componentDidUpdate(prevProps, prevState) {
            const stateChanged = prevState.error != this.state.error
                || prevState.searchResults != this.state.searchResults
                || prevState.resultsPerPage != this.state.resultsPerPage
                || prevState.currentPage != this.state.currentPage
                || prevState.query != this.state.query;

            if(stateChanged && this.state.searchResults) {
                // re-render only of something changed in the query params
                this.props.setCurrentSearchForSaving({
                    url: '/search/advanced/cypher',
                    parameters: {
                        query: this.state.query
                    }
                });

                this.props.renderResults(resultsNode => {
                    this.resultsNode = resultsNode;
                    this.props.updateQueryStatus({
                        success: true,
                        message: "Query successful"
                    });

                    const content = $(resultsNode)
                        .show()
                        .find('.adv-content');

                    $('.advanced-search-type-desc').hide();

                    attacher()
                        .node(content)
                        .teardown();

                    if (this.state.searchResults.elements) {
                        $('.search-export').show();
                        attacher()
                            .node(content)
                            .params({
                                items: this.state.searchResults.elements,
                                currentPage: this.state.currentPage,
                                resultsPerPage: this.state.resultsPerPage,
                                totalTime: this.state.searchResults.totalTime,
                                onChangeResultsPerPage: this.onChangeResultsPerPage,
                                onChangePage: this.onChangePage
                            })
                            .path('search/advanced/cypherResultList')
                            .attach();
                    } else {
                        $('.search-export').hide();
                        attacher()
                            .node(content)
                            .params({
                                columns: this.state.searchResults.columns,
                                currentPage: this.state.currentPage,
                                rows: this.state.searchResults.rows,
                                resultsPerPage: this.state.resultsPerPage,
                                onChangeResultsPerPage: this.onChangeResultsPerPage,
                                onChangePage: this.onChangePage
                            })
                            .path('search/advanced/ResultTable')
                            .attach();
                    }
                })
            } else if(this.state.query == null) {
                if(this.resultsNode) {
                    const content = $(this.resultsNode)
                        .hide()
                        .find('.adv-content');

                    attacher()
                        .node(content)
                        .teardown();
                }

                $('.advanced-search-type-desc').show();
            }

            if(this.state.query && this.state.loading && this.resultsNode) {
                let $loadingDiv = $(".cy-loading");
                if(!$loadingDiv.length) {
                    const $content = $(this.resultsNode).find('.adv-content'),
                        $loadingDiv = $("<div></div>").attr("class", "cy-loading").text("Se incarca...");

                    $loadingDiv.appendTo($content);
                }

                $loadingDiv.show();
            } else if (!this.state.loading) {
                $(".cy-loading").hide();
            }
        },

        onChangeResultsPerPage(resultsPerPage) {
            this.setState({resultsPerPage, currentPage: 1, searchResults: null},
                () => this.executeQuery(this.state.query));
        },

        onVisualSearch(data) {
            this.executeQuery(data.query)
        },

        onChangePage(currentPage) {
            this.setState({currentPage, searchResults: null},
                () => this.executeQuery(this.state.query));
        },

        render() {
            let query = this.state.query;

            return (
                <div className="cypher-search">
                    <CypherEditor
                        content={query}
                        error={this.state.error}
                        history={this.state.history}
                        onClearCypher={this.clearSearch}
                        onExecute={this.executeQueryFromEditor}/>
                </div>
            )
        },

        clearSearch() {
            this.setState({searchResults: null, query: null, error: null});
        },

        executeQueryFromEditor(query) {
            this.setState({currentPage: 1}, () => this.executeQuery(query));
        },

        executeQuery(query) {
            if (this.state.loading) {
                return;
            }
            const nextOffset = (this.state.currentPage - 1) * this.state.resultsPerPage;

            this.setState({loading: true, query});
            this.addHistoryHelper(query);

            bcApi.connect().then(({ dataRequest }) => {
                dataRequest('search', 'execCypherQuery', query, this.state.resultsPerPage, nextOffset)
                    .then(result => {
                        this.setState({searchResults: result, query, loading: false});
                    })
                    .catch(error => {
                        this.setState({searchResults: null, error, loading: false});
                    })
            });
        },

        addHistoryHelper (query) {
            const prevHistory = this.state.history;

            // If it's the same as the last entry, don't add it
            if (prevHistory.length && prevHistory[0] === query) {
                return;
            }

            let newHistory = [...prevHistory]
            newHistory.unshift(query)

            this.setState({history: newHistory.slice(0, MAX_HISTORY_ITEMS)})
        }
    });

    return Cypher;
});
