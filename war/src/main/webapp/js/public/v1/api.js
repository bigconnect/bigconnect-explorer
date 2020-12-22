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
 * Plugins should `require` this module for access to BigConnect Explorer components and
 * helpers.
 *
 * @module public/v1/api
 * @classdesc BigConnect Explorer Top-Level API
 * @example
 * require(['public/v1/api'], function(bcApi) {
 *     // ...
 * })
 */
define([
    'flight/lib/component',
    'configuration/plugins/registry',
    'public/connectReact'
], function(
    defineComponent,
    registry,
    connectReact) {
    'use strict';

    /**
     * @alias module:public/v1/api
     */
    return {

        /**
         * Connect to secondary dependencies
         *
         * @function
         * @returns {Promise.<(module:public/v1/api.connected)>} The connected objects
         */
        connect: connect,

        /**
         * {@link module:public/connectReact|Higher-order component}
         * for React that automcatically loads `connect`.
         *
         * @see module:public/connectReact
         */
        connectReact: connectReact,

        /**
         * Reference to Flight `defineComponent`
         *
         * @function
         * @deprecated React is now the preferred component model.
         * @example
         * // Creating react component
         * define(['create-react-class'], function(createReactClass) {
         *  return createReactClass({
         *      render() {
         *          return <h1>Hello</h1>
         *      }
         *  })
         * })
         * @example
         * // Creating flightjs component
         * define([], function() {
         *  return defineComponent(MyFlightComp);
         *
         *  function MyFlightComp() {
         *     this.after('initialize', function() {
         *         this.$node.html('<h1>Hello</h1>');
         *     }
         *  }
         * })
         */
        defineComponent: defineComponent,

        /**
         * {@link module:registry|Extension Registry}
         * component allows plugins to configure extension points.
         * @see module:registry
         */
        registry: registry
    };

    function connect() {
        return Promise.all([
            'util/element/list',
            'util/ontology/conceptSelect',
            'util/ontology/propertySelect',
            'util/ontology/relationshipSelect',
            'util/vertex/formatters',
            'util/vertex/justification/viewer',
            'util/visibility/edit',
            'util/visibility/view',
            'util/withDataRequest'
        ].map(function(module) {
            return Promise.require(module);
        })).spread(function(
            List,
            ConceptSelector,
            PropertySelector,
            RelationshipSelector,
            F,
            JustificationViewer,
            VisibilityEditor,
            VisibilityViewer,
            withDataRequest) {

            /**
             * BigConnect Explorer Second-Level API
             *
             * @alias module:public/v1/api.connected
             * @namespace
             * @example
             * require(['public/v1/api'], function(api) {
             *     api.then(function(connected) {
             *         // ...
             *     })
             * })
             */
            var connected = {

                /**
                 * Shared user interface components
                 *
                 * @namespace
                 */
                components: {

                    /**
                     * Display justification values
                     *
                     * Reference to {@link module:components/JustificationViewer|JustificationViewer}
                     *
                     * @see module:components/JustificationViewer
                     */
                    JustificationViewer: JustificationViewer,

                    /**
                     * Render lists of elements
                     *
                     * Reference to {@link module:components/List|List}
                     *
                     * @see module:components/List
                     */
                    List: List,

                    /**
                     * Concept select dropdown
                     *
                     * Reference to {@link
                     * module:components/ConceptSelect|ConceptSelect}
                     *
                     * @see module:components/ConceptSelect
                     */
                    OntologyConceptSelector: ConceptSelector,

                    /**
                     * Property select dropdown
                     *
                     * Reference to {@link module:components/PropertySelect|PropertySelect}
                     *
                     * @see module:components/PropertySelect
                     */
                    OntologyPropertySelector: PropertySelector,

                    /**
                     * Relationship select dropdown
                     *
                     * Reference to {@link module:components/RelationshipSelect|RelationshipSelect}
                     *
                     * @see module:components/RelationshipSelect
                     */
                    OntologyRelationshipSelector: RelationshipSelector
                },

                /**
                 * Helpful utities for formatting datatypes to user
                 * displayable values
                 *
                 * Reference to {@link module:formatters|Formatters}
                 *
                 * @see module:formatters
                 */
                formatters: F,

                /**
                 * Make service requests on web worker thread
                 *
                 * Reference to {@link module:dataRequest}
                 *
                 * @see module:dataRequest
                 */
                dataRequest: withDataRequest.dataRequest
            };

            return connected
        });
    }
});
