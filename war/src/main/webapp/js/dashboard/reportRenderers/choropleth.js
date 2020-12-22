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
    'flight/lib/component',
    'util/formatters',
    './withRenderer',
    './withMapTiles',
    'd3'
], function(
    defineComponent,
    F,
    withRenderer,
    withMapTiles,
    d3) {
    'use strict';

    return defineComponent(Choropleth, withRenderer, withMapTiles);

    function Choropleth() {

        this.processData = function(data) {
            var self = this,
                results = data.root[0].buckets,
                zipCodeBoundary = function(params) {
                    return self.dataRequest('dashboard', 'requestData', '/zip-code-boundary', params);
                };

            if (results && results.length) {
                const bucketsByName = _.indexBy(results, 'name');
                const flipCoordinates = c => [c[1], c[0]];
                return zipCodeBoundary({ zipCode: _.pluck(results, 'name') })
                           .then(function(zipCodes) {
                               var min = Infinity,
                                   max = -Infinity,
                                   features = zipCodes.features.map(function({ coordinates: rings, zipCode }) {
                                       const bucket = bucketsByName[zipCode];
                                       const amount = bucket ? bucket.value.count : 0;

                                       min = Math.min(min, amount);
                                       max = Math.max(max, amount);

                                       return {
                                           type: 'Feature',
                                           geometry: {
                                               type: 'Polygon',
                                               coordinates: rings.map(r => r.map(flipCoordinates))
                                           },
                                           properties: {
                                               ...bucket,
                                               label: zipCode,
                                               amount
                                           }
                                       }
                                   });

                               return {
                                   geoJson: {
                                       type: 'FeatureCollection',
                                       features
                                   },
                                   min,
                                   max,
                                   predicate: 'equal',
                                   display: 'normal'
                               };
                           });
            }
            return null;
        };
    }
});
