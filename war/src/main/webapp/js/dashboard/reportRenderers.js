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
    'configuration/plugins/registry',
    'util/requirejs/promise!util/service/ontologyPromise'
], function(registry, ontology) {
    'use strict';

    registry.registerExtension('org.bigconnect.web.dashboard.reportrenderer', {
        identifier: 'org-bigconnect-element-list',
        supportsResponse: function(data) {
            return data && data.type && data.type === 'TYPE_ELEMENTS';
        },
        label: 'Element List',
        componentPath: 'dashboard/reportRenderers/element-list'
    });

    registry.registerExtension('org.bigconnect.web.dashboard.reportrenderer', {
        identifier: 'org-bigconnect-bar-vertical',
        supportsResponse: function(data) {
            return data && data.type && data.root &&
                data.type === 'TYPE_AGGREGATION' &&
                _.size(data.root) === 1 &&
                _.isFunction(data.root[0].displayName) &&
                _.every(data.root[0].buckets, function(item) {
                    return item.value && ('count' in item.value || 'nestedResults' in item.value) && !('cell' in item.value)
                });
        },
        label: i18n('dashboard.renderers.bar.vertical'),
        componentPath: 'dashboard/reportRenderers/bar'
    });

    registry.registerExtension('org.bigconnect.web.dashboard.reportrenderer', {
        identifier: 'org-bigconnect-bar-horizontal',
        supportsResponse: function(data) {
            return data && data.type && data.root &&
                data.type === 'TYPE_AGGREGATION' &&
                _.size(data.root) === 1 &&
                data.root[0].type !== 'histogram' &&
                _.isFunction(data.root[0].displayName) &&
                _.every(data.root[0].buckets, function(item) {
                    return item.value && ('count' in item.value || 'nestedResults' in item.value) && !('cell' in item.value)
                });
        },
        label: i18n('dashboard.renderers.bar.horizontal'),
        componentPath: 'dashboard/reportRenderers/bar'
    });

    registry.registerExtension('org.bigconnect.web.dashboard.reportrenderer', {
        identifier: 'org-bigconnect-pie',
        supportsResponse: function(data) {
            return data && data.type && data.root &&
                data.type === 'TYPE_AGGREGATION' &&
                _.size(data.root) === 1 &&
                _.isFunction(data.root[0].displayName) &&
                _.every(data.root[0].buckets, function(item) {
                    return item.value && 'count' in item.value && !('nested' in item.value) && !('cell' in item.value)
                });
        },
        label: i18n('dashboard.renderers.pie'),
        componentPath: 'dashboard/reportRenderers/pie'
    });

    registry.registerExtension('org.bigconnect.web.dashboard.reportrenderer', {
        identifier: 'org-bigconnect-tagCloud',
        supportsResponse: function(data) {
            return data && data.type && data.root &&
                data.type === 'TYPE_AGGREGATION' &&
                _.size(data.root) === 1 &&
                data.root[0].type === 'term' &&
                _.isFunction(data.root[0].displayName) &&
                _.every(data.root[0].buckets, function(item) {
                    return item.value && 'count' in item.value && !('nested' in item.value) && !('cell' in item.value)
                });
        },
        label: 'Tag Cloud',
        componentPath: 'dashboard/reportRenderers/tagCloud'
    });

    registry.registerExtension('org.bigconnect.web.dashboard.reportrenderer', {
        identifier: 'org-bigconnect-choropleth',
        label: i18n('dashboard.renderers.choropleth'),
        supportsResponse: function(data) {
            return data && data.type && data.root &&
                data.type === 'TYPE_AGGREGATION' &&
                _.size(data.root) === 1 &&
                _.isFunction(data.root[0].displayName) &&
                ontology.properties.byTitle[data.root[0].field] &&
                _.contains(
                    ontology.properties.byTitle[data.root[0].field].intents || [],
                    'zipCode'
                ) &&
                _.every(data.root[0].buckets, function(item) {
                    return item.value && 'count' in item.value && !('nested' in item.value) && !('cell' in item.value)
                });
        },
        componentPath: 'dashboard/reportRenderers/choropleth'
    });

    registry.registerExtension('org.bigconnect.web.dashboard.reportrenderer', {
        identifier: 'org-bigconnect-text-overview',
        configurationPath: 'dashboard/configs/report/text-overview-config',
        supportsResponse: function(data) {
            return data && data.type && data.root &&
                data.type === 'TYPE_AGGREGATION' &&
                _.size(data.root) === 1 &&
                _.isFunction(data.root[0].displayName) &&
                _.every(data.root[0].buckets, function(item) {
                    return item.value && 'count' in item.value && !('nested' in item.value) && !('cell' in item.value)
                });
        },
        label: i18n('dashboard.renderers.textoverview'),
        componentPath: 'dashboard/reportRenderers/text-overview'
    });

    registry.registerExtension('org.bigconnect.web.dashboard.reportrenderer', {
        identifier: 'org-bigconnect-geohash',
        supportsResponse: function(data) {
            return data && data.type && data.root &&
                data.type === 'TYPE_AGGREGATION' &&
                _.size(data.root) === 1 &&
                _.isFunction(data.root[0].displayName) &&
                _.every(data.root[0].buckets, function(item) {
                    return item.value && ('cell' in item.value && 'count' in item.value && 'point' in item.value);
                });
        },
        label: 'Heatmap',
        componentPath: 'dashboard/reportRenderers/geohash'
    });
});
