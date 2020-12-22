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
    'openlayers',
    '../util/layerHelpers',
    'util/mapConfig',
    'util/vertex/formatters'
], function(
    api,
    ol,
    layerHelpers,
    mapConfig,
    F) {
    'use strict';

    const featureCache = {};

    return api.defineComponent(GeoShapePreview);

    function GeoShapePreview() {

        this.attributes({
            ignoreUpdateModelNotImplemented: true
        })

        this.before('initialize', function(node, config) {
            this.element = config.model;
        });

        this.after('initialize', function() {
            this.setupMap();
        })

        this.setupMap = function() {
            const { vectorXhr: layerHelper, tile } = layerHelpers.byType;
            const { source, sourceOptions } = mapConfig();

            const { layer: tileLayer } = tile.configure('base', { source, sourceOptions });
            const { source: olSource, layer: geoShapeLayer } = layerHelper.configure(this.element.id, {
                id: this.element.id,
                element: this.element,
                propName: ONTOLOGY_CONSTANTS.PROP_RAW,
                propKey: '',
                mimeType: F.vertex.prop(this.element, ONTOLOGY_CONSTANTS.PROP_MIME_TYPE),
                sourceOptions: {
                    wrapX: false
                }
            });

            const map = new ol.Map({
                target: this.node,
                layers: [
                    tileLayer,
                    geoShapeLayer
                ],
                controls: [new ol.control.Zoom()],
                view: new ol.View({
                    zoom: 2,
                    minZoom: 1,
                    center: [0, 0],
                })
            });

            this.geoShapeLayer = geoShapeLayer;
            this.map = map;

            let featurePromise = featureCache[this.element.id] || layerHelper.loadFeatures(olSource, geoShapeLayer);

            Promise.resolve(featurePromise).then((features) => {
                const view = this.map.getView();
                const olSource = this.geoShapeLayer.getSource();

                olSource.addFeatures(features);
                this.geoShapeLayer.set('status', 'loaded');

                view.fit(olSource.getExtent());

                if (!featureCache[this.element.id]) {
                    featureCache[this.element.id] = features;
                }
            });
        };

        this.onDetailPaneResize = function() {
            if (this.map) {
                this.map.updateSize();
            }
        }
    }
});
