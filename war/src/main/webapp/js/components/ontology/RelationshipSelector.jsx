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

    const filterList = (conceptDescendents, relationships, relationshipKeys, filter) => relationships.filter(r => {
        const domainRanges = _.flatten(relationshipKeys.map(k => r[k]));
        return _.any(domainRanges, iri => {
            return (
                filter === iri ||
                (conceptDescendents[iri] && conceptDescendents[iri].includes(filter))
            );
        });
    });
    const RelationshipSelector = createReactClass({
        propTypes: {
            conceptDescendents: PropTypes.object.isRequired,
            relationships: PropTypes.array.isRequired,
            filter: PropTypes.shape({
                sourceId: PropTypes.string,
                targetId: PropTypes.string,
                conceptId: PropTypes.string,
                relationshipId: PropTypes.string
            }),
            placeholder: PropTypes.string
        },
        getDefaultProps() {
            return { creatable: true, placeholder: i18n('relationship.field.placeholder') }
        },
        render() {
            const {
                conceptDescendents,
                relationshipAncestors,
                privileges,
                relationships,
                filter,
                creatable,
                ...rest
            } = this.props;
            const formProps = { ...filter };

            var options = relationships;

            if (filter) {
                const { conceptId, sourceId, targetId, relationshipId } = filter;
                if (conceptId && (sourceId || targetId)) {
                    throw new Error('only one of conceptId or source/target can be sent');
                }
                if (relationshipId) {
                    options = options.filter(o => o.title === relationshipId || relationshipAncestors[relationshipId].includes(o.title));
                }
                if (conceptId) {
                    options = filterList(conceptDescendents, options, ['domainConceptIris', 'rangeConceptIris'], conceptId);
                } else {
                    if (sourceId) {
                        options = filterList(conceptDescendents, options, ['domainConceptIris'], sourceId);
                    }
                    if (targetId) {
                        options = filterList(conceptDescendents, options, ['rangeConceptIris'], targetId);
                    }
                }
            }

            return (
                <BaseSelect
                    createForm={'components/ontology/RelationshipForm'}
                    formProps={formProps}
                    options={options}
                    creatable={creatable && Boolean(privileges.ONTOLOGY_ADD)}
                    {...rest} />
            );
        }
    });

    return redux.connect(
        (state, props) => {
            return {
                privileges: userSelectors.getPrivileges(state),
                conceptDescendents: ontologySelectors.getConceptDescendents(state),
                relationshipAncestors: ontologySelectors.getRelationshipAncestors(state),
                relationships: ontologySelectors.getVisibleRelationships(state),
                iriKeys: ontologySelectors.getRelationshipKeyIris(state),
                ...props
            };
        },

        (dispatch, props) => ({
            onCreate: (relationship, options) => {
                dispatch(ontologyActions.addRelationship(relationship, options));
            }
        })
    )(RelationshipSelector);
});

