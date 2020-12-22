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
define(['util/requirejs/promise!./service/propertiesPromise'], function(config) {
    'use strict';

    return getTilePropsFromConfiguration;

    function getTilePropsFromConfiguration() {
        const getOptions = function(providerName) {
            try {
                var obj,
                    prefix = `map.provider.${providerName}.`,
                    options = _.chain(config)
                    .pick((val, key) => key.indexOf(`map.provider.${providerName}.`) === 0)
                    .tap(o => { obj = o })
                    .pairs()
                    .map(([key, value]) => {
                        if (/^[\d.-]+$/.test(value)) {
                            value = parseFloat(value, 10);
                        } else if ((/^(true|false)$/).test(value)) {
                            value = value === 'true'
                        } else if ((/^\[[^\]]+\]$/).test(value) || (/^\{[^\}]+\}$/).test(value)) {
                            value = JSON.parse(value)
                        }
                        return [key.replace(prefix, ''), value]
                    })
                    .object()
                    .value()
                return options;
            } catch(e) {
                console.error(`${prefix} options could not be parsed. input:`, obj)
                throw e;
            }
        };

        var source = config['map.provider'] || 'osm';
        var sourceOptions;

        if (source === 'google') {
            console.warn('google map.provider is no longer supported, switching to OpenStreetMap provider');
            source = 'osm';
        }

        if (source === 'osm') {
            // Legacy configs accepted csv urls, warn and pick first
            var osmURL = config['map.provider.osm.url'];
            if (osmURL && osmURL.indexOf(',') >= 0) {
                console.warn('Comma-separated Urls not supported, using first url. Use urls with {a-c} for multiple CDNS');
                console.warn('For Example: https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png');
                config['map.provider.osm.url'] = osmURL.split(',')[0].trim().replace(/[$][{]/g, '{');
            }
            sourceOptions = getOptions('osm');
            source = 'OSM';
        } else if (source === 'ArcGIS93Rest') {
            var urlKey = 'map.provider.ArcGIS93Rest.url';
            // New OL3 ArcGIS Source will throw an error if url doesn't end
            // with [Map|Image]Server
            if (config[urlKey]) {
                config[urlKey] = config[urlKey].replace(/\/export(Image)?\/?\s*$/, '');
            }
            sourceOptions = { params: { layers: 'show:0,1,2' }, ...getOptions(source) };
            source = 'TileArcGISRest'
        } else {
            sourceOptions = getOptions(source)
        }

        return { source, sourceOptions };
    }
});

