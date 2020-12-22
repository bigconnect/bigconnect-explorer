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

/**
 * Allows a user to select an ontology relationship from a searchable dropdown component.
 *
 * @module components/RelationshipSelect
 * @flight Dropdown selection component for selecting relationships from the ontology
 * @attr {string} [defaultText=Choose a Relationship...] the placeholder text to display
 * @attr {boolean} [creatable=true] Allow creation of new relationships if the user has ONTOLOGY_ADD privilege
 * @attr {string} [limitParentConceptId=''] Limit edges that contain this concept IRI on one side of the edge
 * @attr {string} [sourceConcept=''] Limit relationships to those that have this concept IRI as the source
 * @attr {string} [targetConcept=''] Limit relationships to those that have this concept IRI as the target
 * @attr {boolean} [focus=false] Activate the field for focus when finished rendering
 * @fires module:components/RelationshipSelect#relationshipSelected
 * @listens module:components/RelationshipSelect#limitParentConceptId
 * @listens module:components/RelationshipSelect#selectRelationshipId
 * @example
 * RelationshipSelect.attachTo(node)
 */
define([
    'flight/lib/component',
    'util/component/attacher'
], function(defineComponent, attacher) {

    return defineComponent(RelationshipSelector);

    function RelationshipSelector() {
        this.after('teardown', function() {
            this.attacher.teardown();
        })

        this.after('initialize', function() {
            if ('maxItems' in this.attr) {
                console.warn('maxItems is no longer supported');
            }
            var self = this;

            /**
             * Trigger to change the list of relationships to filter with this concept.
             *
             * If `conceptId` is specifed source/target should not be.
             *
             * @event module:components/RelationshipSelect#limitParentConceptId
             * @property {object} data
             * @property {string} [data.conceptId=''] The concept IRI to limit by
             * @property {string} [data.sourceConceptId=''] The source concept IRI to limit by
             * @property {string} [data.targetConceptId=''] The dest concept IRI to limit by
             * @example
             * RelationshipSelect.attachTo($node)
             * //...
             * $node.trigger('limitParentConceptId', { conceptId: ONTOLOGY_CONSTANTS.CONCEPT_TYPE_PERSON })
             */
            this.on('limitParentConceptId', function(event, data) {
                const { conceptId, sourceConceptId: sourceId, targetConceptId: targetId } = data;
                const params = self.attacher._params;
                self.attacher.params({ ...params, filter: { ...params.filter, conceptId, sourceId, targetId }}).attach();
            })

            /**
             * Trigger to change the list of properties the component works with.
             *
             * @event module:components/RelationshipSelect#selectRelationshipId
             * @property {object} data
             * @property {string} [data.relationshipId=''] The relationship IRI to select or nothing to clear
             * @example
             * RelationshipSelect.attachTo($node)
             * //...
             * $node.trigger('selectRelationshipId', { relationshipId: '' })
             * @example <caption>Clear selection</caption>
             * $node.trigger('selectRelationshipId')
             */
            this.on('selectRelationshipId', function(event, data) {
                const relationshipId = data && data.relationshipId || null;
                self.attacher.params({ ...self.attacher._params, value: relationshipId }).attach()
            })

            this.attacher = attacher()
                .node(this.node)
                .params({
                    placeholder: this.attr.defaultText,
                    creatable: this.attr.creatable !== false,
                    autofocus: this.attr.focus === true,
                    filter: {
                        conceptId: this.attr.limitParentConceptId,
                        sourceId: this.attr.sourceConcept,
                        targetId: this.attr.targetConcept
                    }
                })
                .behavior({
                    onSelected: (attacher, relationship) => {
                        /**
                         * Triggered when the user selects a relationship from the list.
                         *
                         * @event module:components/RelationshipSelect#relationshipSelected
                         * @property {object} data
                         * @property {object} data.relationship The ontology relationship object that was selected
                         * @example
                         * $node.on('relationshipSelected', function(event, data) {
                         *     console.log(data.relationship)
                         * })
                         * RelationshipSelect.attachTo($node)
                         */
                        this.trigger('relationshipSelected', { relationship })
                    }
                })
                .path('components/ontology/RelationshipSelector')

            this.attacher.attach();
        })
    }
});
