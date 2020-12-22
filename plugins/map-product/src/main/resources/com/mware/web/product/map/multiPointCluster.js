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
 * This file is a fork of http://openlayers.org/en/master/apidoc/ol.source.Cluster.html
 * with support for multi-point clusters.
 */
define(['openlayers'], function(ol) {
    'use strict';

    var MultiPointCluster = function(options) {
        ol.source.Vector.call(this, {
            attributions: options.attributions,
            extent: options.extent,
            logo: options.logo,
            projection: options.projection,
            wrapX: options.wrapX
        });

        this.resolution = undefined;
        this.distance = 20 * devicePixelRatio;
        this.features = [];
        this.geometryFunction = options.geometryFunction || (feature => feature.getGeometry());
        this.source = options.source;
        this.refresh = _.debounce(this.refresh.bind(this), 100);
        this.source.on('change', this.refresh);
    };

    ol.inherits(MultiPointCluster, ol.source.Vector);

    MultiPointCluster.prototype.refresh = function() {
        this.clear();
        this.cluster();
        this.addFeatures(this.features);
        this.changed();
    }

    MultiPointCluster.prototype.getSource = function() {
        return this.source;
    }

    MultiPointCluster.prototype.loadFeatures = function(extent, resolution, projection) {
        this.source.loadFeatures(extent, resolution, projection);
        this.updateResolution(resolution);
    }

    MultiPointCluster.prototype.updateResolution = function(resolution) {
        if (resolution !== this.resolution) {
            this.clear();
            this.resolution = resolution;
            this.cluster();
            this.addFeatures(this.features);
        }
    }

    MultiPointCluster.prototype.setDistance = function(distance) {
        this.distance = distance;
        this.refresh();
    }

    MultiPointCluster.prototype.cluster = function() {
        var self = this;
        if (this.resolution === undefined) {
            return;
        }
        const resolution = this.resolution;
        const distance = this.distance;
        this.features.length = 0;
        var source = this.source;
        var features = source.getFeatures();
        var clustered = {};

        const getRadius = feature => {
            const radius = feature.get('_nodeRadius') * devicePixelRatio;
            return radius || distance;
        }
        const maxRadius = features.reduce((max, f) => {
            const radius = getRadius(f);
            return Math.max(max, radius)
        }, 0);
        const countStats = { max: 0, min: Number.MAX_VALUE };
        this.source.countStats = countStats;

        for (let i = 0; i < features.length; i++) {
            clusterFeature(features[i]);
        }

        function clusterFeature(feature) {
            const radius = getRadius(feature);
            var mapDistanceSearch = (radius + maxRadius) * resolution;
            var mapDistance = radius * resolution;
            var geometry = self.geometryFunction(feature);
            if (geometry) {
                var coordinates = geometry.getCoordinates();
                for (let i = 0; i < coordinates.length; i++) {
                    clusterCoordinate(coordinates[i], i);
                }
            }

            function clusterCoordinate(coordinate, coordinateIndex) {
                if (!((feature.getId().toString() + '_' + coordinateIndex) in clustered)) {

                    // Search radius is this feature box + max size
                    const extentSearch = ol.extent.boundingExtent([coordinate])
                    ol.extent.buffer(extentSearch, mapDistanceSearch, extentSearch);

                    // Exact bounds to further match for collision
                    const extent1 = ol.extent.boundingExtent([coordinate])
                    ol.extent.buffer(extent1, mapDistance, extent1);

                    var neighbors = source.getFeaturesInExtent(extentSearch),
                        coords = [],
                        count = 0;

                    const featuresToCluster = neighbors.filter(function(neighbor) {
                        var neighborGeometry = self.geometryFunction(neighbor);
                        var neighborCoordinates = neighborGeometry.getCoordinates();
                        var neighborUid = neighbor.getId().toString() + '_';

                        var coordsInCluster = neighborCoordinates.filter(function(coordinate, coordinateIndex) {
                            var uid = neighborUid + coordinateIndex;

                            const extent2 = ol.extent.boundingExtent([coordinate])
                            ol.extent.buffer(extent2, getRadius(neighbor) * resolution, extent2);

                            if (ol.extent.intersects(extent1, extent2)) {
                                if (!(uid in clustered)) {
                                    coords.push(coordinate)
                                    clustered[uid] = true;
                                    return true;
                                }
                            }
                            return false;
                        }).length
                        count += coordsInCluster;
                        return coordsInCluster > 0;
                    });

                    countStats.max = Math.max(count, countStats.max);
                    countStats.min = Math.min(count, countStats.min);
                    self.features.push(self.createCluster(featuresToCluster, coords, count));
                }
            }
        }
    };

    MultiPointCluster.prototype.createCluster = function(features, coordinates, count) {
        const focusStats = { some: 0, all: false, dim: false };
        features.forEach(feature => {
            const focused = feature.get('focused')
            focusStats.some += (focused ? 1 : 0);
            focusStats.all = focusStats.all && focused;
            focusStats.dim = focusStats.dim || feature.get('focusedDim');
        })
        const centers = coordinates.reduce((sums, c) => sums.map((s, i) => s + c[i]), [0, 0]);
        const average = centers.map(val => val / coordinates.length);
        const geometry = new ol.geom.Point(average);

        return new ol.Feature({ geometry, features, coordinates, count, focusStats });
    };

    return MultiPointCluster;
});
