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
    'react-redux',
    'data/web-worker/store/selection/actions',
    'data/web-worker/store/product/actions',
    'data/web-worker/store/product/selectors',
    'data/web-worker/store/ontology/selectors',
    '../worker/actions',
    './MapLayers'
], function(
    redux,
    selectionActions,
    productActions,
    productSelectors,
    ontologySelectors,
    mapActions,
    MapLayers) {
    'use strict';

    const mimeTypes = [BC_MIMETYPES.ELEMENTS];
    const LAYERS_EXTENDED_DATA_KEY = 'org-bigconnect-map-layers';

    return redux.connect(
        (state, props) => {
            const { product, map, cluster, layersWithSources, ...injectedProps } = props;
            const editable = state.workspace.byId[state.workspace.currentId].editable;
            const baseLayer = map.getLayers().item(0);
            const layers = map.getLayers().getArray().slice(1).reverse();
            const layerIds = layers.reduce((order, layer) => {
                order.push(layer.get('id'));
                return order;
            }, []);
            const layersExtendedData = product.extendedData && product.extendedData[LAYERS_EXTENDED_DATA_KEY] || {};
            const layerOrder = layersExtendedData.layerOrder || [];
            const layersConfig = layersExtendedData.config || {};

            return {
                ...injectedProps,
                product,
                map,
                baseLayer,
                layersConfig,
                layerOrder,
                layerIds,
                layers,
                editable
            };
        },

        (dispatch, props) => {
            return {
                setLayerOrder: (layerOrder) => dispatch(mapActions.setLayerOrder(props.product.id, layerOrder)),
                updateLayerConfig: (config, layerId) => {
                    const extendedData = props.product.extendedData[LAYERS_EXTENDED_DATA_KEY];
                    const layersConfig = { ...(extendedData.config || {}), [layerId]: config };

                    dispatch(productActions.updateExtendedData(
                        props.product.id,
                        LAYERS_EXTENDED_DATA_KEY,
                        { ...extendedData, config: layersConfig }
                    ));
                }
            };
        }
    )(MapLayers)
});
