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
    './BaseSelect',
    'data/web-worker/store/user/selectors',
    'data/web-worker/store/ontology/selectors',
    'data/web-worker/store/ontology/actions'
], function(
    createReactClass,
    PropTypes,
    redux,
    BaseSelect,
    userSelectors,
    ontologySelectors,
    ontologyActions) {

    const ConceptsSelector = createReactClass({
        propTypes: {
            filter: PropTypes.shape({
                conceptId: PropTypes.string,
                relatedToConceptId: PropTypes.string,
                showAncestors: PropTypes.bool,
                userVisible: PropTypes.bool,
                searchable: PropTypes.bool
            }),
            conceptAncestors: PropTypes.object.isRequired,
            concepts: PropTypes.array.isRequired,
            privileges: PropTypes.object.isRequired,
            placeholder: PropTypes.string,
            value: PropTypes.string
        },
        getDefaultProps() {
            return { creatable: true, placeholder: i18n('concept.field.placeholder') }
        },
        render() {
            const {
                conceptAncestors,
                concepts,
                conceptsToConcepts,
                filter,
                privileges,
                creatable,
                ...rest
            } = this.props;

            var options = concepts;
            if (filter) {
                options = concepts.filter(o => {
                    return (
                            filter.conceptId ?
                                (o.id === filter.conceptId ||
                                (!filter.showAncestors || conceptAncestors[filter.conceptId].includes(o.id))) : true
                        ) && (
                            filter.userVisible === undefined || filter.userVisible === true ?
                                o.userVisible !== false : true
                        ) && (
                            filter.searchable === true ?
                                o.searchable !== false : true
                        ) && (
                            filter.relatedToConceptId ?
                                (
                                    conceptsToConcepts[filter.relatedToConceptId] &&
                                    conceptsToConcepts[filter.relatedToConceptId].includes(o.id)
                                ) : true
                        );
                })
            }
            return (
                <BaseSelect
                    createForm={'components/ontology/ConceptForm'}
                    options={options}
                    creatable={creatable && Boolean(privileges.ONTOLOGY_ADD)}
                    {...rest} />
            );
        }
    });

    return redux.connect(
        (state, props) => {
            var otherFilters = props.filter;
            var concepts = ontologySelectors.getVisibleConceptsList(state);
            var conceptsToConcepts;
            var depthKey = 'depth';
            var pathKey = 'path';

            if (otherFilters) {
                const { userVisible, ...rest } = otherFilters;
                otherFilters = rest;
                const showAdmin = userVisible === null;
                if (showAdmin) {
                    concepts = ontologySelectors.getConceptsList(state);
                    depthKey = 'fullDepth';
                    pathKey = 'fullPath';
                }
                if (otherFilters.relatedToConceptId) {
                    conceptsToConcepts = ontologySelectors.getConceptsByRelatedConcept(state);
                }
            }
            return {
                privileges: userSelectors.getPrivileges(state),
                concepts,
                conceptAncestors: ontologySelectors.getConceptAncestors(state),
                iriKeys: ontologySelectors.getConceptKeyIris(state),
                filter: otherFilters,
                conceptsToConcepts,
                depthKey,
                pathKey,
                ...props
            };
        },

        (dispatch, props) => ({
            onCreate: (concept, options) => {
                dispatch(ontologyActions.addConcept(concept, options));
            }
        })
    )(ConceptsSelector);
});
