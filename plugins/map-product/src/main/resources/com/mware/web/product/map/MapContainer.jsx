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
    'react-dom',
    'configuration/plugins/registry',
    'data/web-worker/store/selection/actions',
    'data/web-worker/store/product/actions',
    'data/web-worker/store/product/selectors',
    'data/web-worker/store/ontology/selectors',
    'util/dnd',
    './worker/actions',
    'components/DroppableHOC',
    './Map',
    './util/layerHelpers'
], function(
    redux,
    ReactDom,
    registry,
    selectionActions,
    productActions,
    productSelectors,
    ontologySelectors,
    dnd,
    mapActions,
    DroppableHOC,
    Map,
    layerHelpers) {
    'use strict';

    registry.registerExtension('org.bigconnect.product.toolbar.item', {
        identifier: 'org-bigconnect-map-layers',
        itemComponentPath: 'com/mware/web/product/map/dist/MapLayersContainer',
        placementHint: 'popover',
        label: i18n('org.bigconnect.web.product.map.MapWorkProduct.layers.toolbar.item.label'),
        canHandle: (product) => product.kind === 'org.bigconnect.web.product.map.MapWorkProduct'
    });

    const mimeTypes = [BC_MIMETYPES.ELEMENTS];

    return redux.connect(

        (state, props) => {
            const product = productSelectors.getProduct(state);
            const layerConfig = product.extendedData
                && product.extendedData['org-bigconnect-map-layers']
                && product.extendedData['org-bigconnect-map-layers'].config;

            return {
                ...props,
                workspaceId: state.workspace.currentId,
                configProperties: state.configuration.properties,
                ontologyProperties: ontologySelectors.getProperties(state),
                panelPadding: { top: 0, left: 0, right: 0, bottom: 0 },
                selection: productSelectors.getSelectedElementsInProduct(state),
                viewport: productSelectors.getViewport(state),
                productElementIds: productSelectors.getElementIdsInProduct(state),
                product: productSelectors.getProduct(state),
                elements: productSelectors.getElementsInProduct(state),
                focused: productSelectors.getFocusedElementsInProduct(state),
                pixelRatio: state.screen.pixelRatio,
                mimeTypes,
                style: { height: '100%' },
                layerConfig
            }
        },

        (dispatch, props) => {
            return {
                onClearSelection: () => dispatch(selectionActions.clear()),
                onAddSelection: (selection) => dispatch(selectionActions.add(selection)),
                onSelectElements: (selection) => dispatch(selectionActions.set(selection)),
                onSelectAll: (id) => dispatch(productActions.selectAll(id)),

                onUpdatePreview: (id, dataUrl) => dispatch(productActions.updatePreview(id, dataUrl)),

                // TODO: these should be mapActions
                onUpdateViewport: (id, { pan, zoom }) => dispatch(productActions.updateViewport(id, { pan, zoom })),

                // For DroppableHOC
                onDrop: (event) => {
                    const elements = dnd.getElementsFromDataTransfer(event.dataTransfer);
                    if (elements) {
                        event.preventDefault();
                        event.stopPropagation();

                        dispatch(mapActions.dropElements(props.product.id, elements, { undoable: true }))
                    }
                },

                onDropElementIds(elementIds) {
                    dispatch(mapActions.dropElements(props.product.id, elementIds, { undoable: true }));
                },

                onRemoveElementIds: (elementIds) => {
                    dispatch(mapActions.removeElements(props.product.id, elementIds, { undoable: true }))
                },

                onVertexMenu: (element, vertexId, position) => {
                    $(element).trigger('showVertexContextMenu', { vertexId, position });
                },

                setLayerOrder: (layerOrder) => dispatch(mapActions.setLayerOrder(props.product.id, layerOrder))
            }
        }

    )(DroppableHOC(Map));
});
