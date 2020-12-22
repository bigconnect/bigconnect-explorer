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
define(['openlayers', 'util/mapConfig'], function(ol, mapConfig) {

    let overlay;
    let innerMap;
    let layer;
    let element;

    return {
        show(ol, map, cluster, styleFn) {
            if (overlay) {
                map.removeOverlay(overlay);
            }

            const coordinates = cluster.get('coordinates');
            const extent = ol.extent.boundingExtent(coordinates)
            const size = getSize(extent)
            const coord = cluster.getGeometry().getCoordinates();
            const pixel = map.getPixelFromCoordinate(coord);
            const offset = 20;
            const flip = pixel[1] < (size[1] + offset)

            if (!element) {
                element = $('<div class="popover"></div>').css({ position: 'relative'}).show()
                element.append('<div class="arrow"></div>')
                element.append('<div class="popover-content" style="padding:0;border-radius: 4px; overflow: hidden;"></div>')
            }
            element.toggleClass('top', !flip).toggleClass('bottom', flip)
            element.find('.popover-content').css({ width: size[0], height: size[1] })

            overlay = new ol.Overlay({
                offset: [0, offset * (flip ? 1 : -1)],
                element: element[0],
            });

            element.show()
            map.addOverlay(overlay);

            overlay.setPosition(coord);
            overlay.setPositioning(flip ? 'top-center' : 'bottom-center');

            if (!innerMap) {
                const { map: _map, layer: _layer } = setupMap(styleFn);
                innerMap = _map;
                layer = _layer;
            }

            innerMap.setSize(size);

            const maxRadius = cluster.get('features').reduce((max, f) => {
                return Math.max(max, f.get('_nodeRadius'))
            }, 0);
            innerMap.getView().fit(extent, {
                size,
                maxZoom: 9,
                padding: [maxRadius, maxRadius, maxRadius, maxRadius]
            })
            layer.setStyle(styleFn);

            const source = layer.getSource();
            source.clear();
            source.addFeatures(cluster.get('features'))
        },

        hide(ol, map) {
            if (overlay) {
                map.removeOverlay(overlay);
            }
        }
    }

    function getSize(extent) {
        const aspect = (extent[2] - extent[0]) / (extent[3] - extent[1]) || 1
        let size = [200, 200]
        if (aspect > 1) {
            size[1] = Math.max(150, size[0] * (1 / aspect))
        } else {
            size[0] = Math.max(150, size[1] * aspect);
        }
        return size;
    }

    function setupMap() {
        const { source, sourceOptions } = mapConfig();
        let baseLayerSource = new ol.source[source](sourceOptions)
        const layer = new ol.layer.Vector({
            source: new ol.source.Vector({
                features: []
            })
        })
        return {
            map: new ol.Map({
                controls: [],
                layers: [
                    new ol.layer.Tile({ source: baseLayerSource }),
                    layer,
                ],
                target: element.find('.popover-content')[0]
            }),
            layer
        };
    }
})
