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
    '../withPopover',
    'openlayers',
    './featureMoveInteraction',
    'util/mapConfig',
    'data/web-worker/store/product/selectors'
], function(
    defineComponent,
    withPopover,
    ol,
    FeatureMoveInteraction,
    mapConfig,
    productSelectors) {
    'use strict';

    var MODE_REGION_SELECTION_MODE_POINT = 1,
        MODE_REGION_SELECTION_MODE_RADIUS = 2,
        MODE_REGION_SELECTION_MODE_RADIUS_DRAGGING = 3;

    return defineComponent(MapSearchPopover, withPopover);

    function MapSearchPopover() {

        this.defaultAttrs({
            mapSelector: '.map',
            closeSelector: '.close'
        });

        this.before('initialize', function(node, config) {
            config.template = 'mapSearch/template';

            this.after('setupWithTemplate', function() {
                var self = this;

                this.positionDialog();
                this.mode = MODE_REGION_SELECTION_MODE_POINT;
                this.setInfo();
                bcData.storePromise.then(store => {
                    this.setupMap(store);
                })
            });
        });

        this.onToggle = function(e) {
            e.stopPropagation();
            this.teardown();
        };

        this.setupMap = function(store) {
            const state = store.getState();
            var currentValue = this.attr.currentValue;
            var { latitude, longitude, radius } = currentValue;
            var existing = true;
            if (_.isUndefined(latitude)) {
                existing = false;
                latitude = 0;
            }
            if (_.isUndefined(longitude)) {
                existing = false;
                longitude = 0;
            }

            let center = ol.proj.transform(
                [longitude, latitude], 'EPSG:4326', 'EPSG:3857'
            );
            let zoom = 1;
            if (!existing) {
                let viewport = productSelectors.getViewport(state);
                if (viewport && _.isArray(viewport.pan)) {
                    center = viewport.pan;
                    zoom = viewport.zoom;
                }
            }

            var { source, sourceOptions } = mapConfig();
            var map = new ol.Map({
                target: this.popover.find(this.attr.mapSelector)[0],
                layers: [
                    new ol.layer.Tile({ source: new ol.source[source](sourceOptions) })
                ],
                controls: [new ol.control.Zoom()],
                view: new ol.View({ center, zoom })
            });
            this.map = map;

            map.on('click', event => this.onMapClicked(event))
            this.on(this.popover, 'click', {
                closeSelector: this.teardown
            })

            if (existing) {
                this.mode = MODE_REGION_SELECTION_MODE_RADIUS;
                this.setInfo();
                this.createCircleInteraction({
                    fit: true,
                    center: ol.proj.fromLonLat([longitude, latitude]),
                    radius: (radius || 100) * 1000
                })
            }
        };

        this.onMapClicked = function(event, map) {
            if (this.blockDoubleTimer) {
                clearTimeout(this.blockDoubleTimer);
                this.blockDoubleTimer = null;
            } else {
                this.blockDoubleTimer = _.delay(() => {
                    this.blockDoubleTimer = null;
                    this.onMapClickedBlockDoubleClicks(event)
                }, 250);
            }
        };

        this.onMapClickedBlockDoubleClicks = function(event) {
            var map = this.map;

            switch (this.mode) {

                case MODE_REGION_SELECTION_MODE_POINT:
                    this.mode = MODE_REGION_SELECTION_MODE_RADIUS;
                    this.createCircleInteraction({ center: event.coordinate, fit: false });
                    break;

            }

            this.setInfo();
        };

        this.update = function() {
            var { center, radius } = this.moveInteraction.getRegion(),
                lonlat = ol.proj.toLonLat(center),
                region = {
                    radius: radius,
                    longitude: lonlat[0],
                    latitude: lonlat[1]
                };
            this.trigger('mapSearchRegionUpdated', { region });
            this.setInfo();
        };

        this.setInfo = function() {
            var $info = this.popover.find('.info');
            switch (this.mode) {
                case MODE_REGION_SELECTION_MODE_POINT:
                    return $info.text(i18n('field.geolocation.radius.search.selectpoint'));
                case MODE_REGION_SELECTION_MODE_RADIUS:
                    return $info.text(i18n('field.geolocation.radius.search.selectradius'));
                case MODE_REGION_SELECTION_MODE_RADIUS_DRAGGING:
                    return $info.text(i18n('field.geolocation.radius.search.dragging',
                        this.radius.toFixed(2),
                        (this.radius * 0.62137).toFixed(2)
                    ));
            }
        };

        this.createCircleInteraction = function(options) {
            this.moveInteraction = new FeatureMoveInteraction(options);
            this.moveInteraction.on('radiusChanged', event => {
                this.mode = MODE_REGION_SELECTION_MODE_RADIUS_DRAGGING;
                this.radius = event.newRadius;
                this.update();
            })
            this.moveInteraction.on('centerChanged', event => {
                this.center = event.newCenter;
                this.update();
            })
            this.map.addInteraction(this.moveInteraction);
            this.update();
        };
    }
});
