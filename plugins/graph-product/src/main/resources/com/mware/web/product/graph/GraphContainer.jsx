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
    'data/web-worker/store/selection/actions',
    'data/web-worker/store/user/selectors',
    'data/web-worker/store/product/actions',
    'data/web-worker/store/product/selectors',
    'data/web-worker/store/ontology/selectors',
    'components/DroppableHOC',
    'configuration/plugins/registry',
    'util/retina',
    'util/dnd',
    'util/parsers',
    './worker/actions',
    './Graph'
], function(
    redux,
    ReactDom,
    selectionActions,
    userSelectors,
    productActions,
    productSelectors,
    ontologySelectors,
    DroppableHOC,
    registry,
    retina,
    dnd,
    parsers,
    graphActions,
    Graph) {
    'use strict';

    /**
     * @deprecated Use {@link org.bigconnect.product.toolbar.item} instead
     */
    registry.documentExtensionPoint('org.bigconnect.graph.options',
        'Add components to the graph product toolbar',
        function(e) {
            return ('identifier' in e) && ('optionComponentPath' in e);
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/graph-options'
    );

    /**
     * Add to the cytoscape stylesheet. [Cytoscape docs](http://js.cytoscape.org/#function-format)
     *
     * This is used to adjust the styling of all graph elements: Nodes, Edges,
     * Decorations, etc.
     *
     * The default stylesheet is defined in [styles.js](web/plugins/graph-product/src/main/resources/com/mware/web/product/graph/styles.js#L46)
     *
     * @param {org.bigconnect.graph.style~StyleFn} config Cytoscape style function
     * @example
     * registry.registerExtension('org.bigconnect.graph.style', function(cytoscapeStylesheet) {
     *     // Changes selected nodes color to red
     *     cytoscapeStylesheet.selector('node:selected')
     *         .style({
     *             color: '#FF0000'
     *         })
     * });
     */
    registry.documentExtensionPoint('org.bigconnect.graph.style',
        'Apply additional cytoscape styles',
        function(e) {
            return _.isFunction(e);
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/graph-style'
    );

    /**
     * Graph decorations are additional detail to display around a vertex
     * when displayed in a graph. These decorations are implemented as
     * [cytoscape.js](http://js.cytoscape.org) nodes inside of compound nodes.
     * That allows them to be styled just like vertices using {@link org.bigconnect.graph.style} extensions.
     *
     * @param {object} alignment Where the decoration is attached
     * @param {string} alignment.h Where the decoration is attached on the
     * horizontal axis: `left`, `center`, `right`
     * @param {string} alignment.v Where the decoration is attached on the vertical axis: `top`, `center`, `bottom`
     * @param {object|org.bigconnect.graph.node.decoration~data} data The cytoscape data object for the decoration node
     * @param {string|org.bigconnect.graph.node.decoration~classes} [classes]
     * Classes to add to the cytoscape node, useful for styling with {@link org.bigconnect.graph.style}
     *
     * Include multiple `classes` using space-separated string
     * @param {org.bigconnect.graph.node.decoration~applyTo} [applyTo] Whether the
     * decoration should be added to certain nodes.
     * @param {object} [padding] Offset the decoration from the bounds of the
     * node.
     *
     * Useful when the decoration is styled with known width/height that won't
     * work with defaults `8x8`.
     * @param {number} [padding.x=8] X offset
     * @param {number} [padding.y=8] Y offset
     * @param {org.bigconnect.graph.node.decoration~onClick} [onClick] This function is called on click events
     * @param {org.bigconnect.graph.node.decoration~onMouseOver} [onMouseOver] This function is called on mouseover events
     * @param {org.bigconnect.graph.node.decoration~onMouseOut} [onMouseOut] This function is called on mouseout events
     * @example
     * registry.registerExtension('org.bigconnect.graph.node.decoration', {
     *     applyTo: function(v) { return true; },
     *     alignment: { h: 'left', v: 'top' },
     *     classes: 'custom',
     *     data: function(vertex) {
     *         return {
     *             label: vertex.properties.length
     *         }
     *     }
     * });
     */
    registry.documentExtensionPoint('org.bigconnect.graph.node.decoration',
        'Add decoration text/images around the node',
        function(e) {
            if (e.applyTo && !_.isFunction(e.applyTo)) return false;
            if (!_.isObject(e.alignment)) return false;
            if (!_.contains(['left', 'center', 'right'], e.alignment.h)) return false;
            if (!_.contains(['top', 'center', 'bottom'], e.alignment.v)) return false;
            return true;
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/graph-node-decoration'
    );

    /**
     * Allows a custom component to render to configure how to export.
     *
     * @param {string} menuItem The string to display in the context menu
     * @param {string} componentPath The path to {@link org.bigconnect.graph.export~Exporter|exporter component}
     * to render when user selects the menu option.
     * @param {boolean} [showPopoverTitle=true] If the popover should display a title
     * @param {boolean} [showPopoverCancel=true] If the popover displays cancel button
     * @param {function} [attributes] Function that can transform the properties that the component receives.
     */
    registry.documentExtensionPoint('org.bigconnect.graph.export',
        'Add menu options to export graph / workspace',
        function(e) {
            return ('menuItem' in e) && ('componentPath' in e);
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/graph-export'
    );

    /**
     * Add custom cytoscape selection menu items. Graph provides select all, none, and invert by default.
     *
     * The text displayed to the user uses the message bundle key:
     *
     *      graph.selector.[identifier].displayName=Selection Text to Display
     *
     * @param {function} config Function that does the custom selection
     * @param {string} config.identifier Unique id for selection
     * @param {string} [config.visibility] When should the item be available based on
     * the current selection
     *
     * * `selected` When there is currently something selected
     * * `none-selected` When nothing is selected
     * * `always` Always show this option regardless of selection state
     * @example
     * var doRandomSelection = function(cy) {
     *     var nodes = cy.nodes().unselect(),
     *         randomIndex = Math.floor(Math.random() * nodes.length);
     *     nodes[randomIndex].select();
     * }
     * doRandomSelection.identifier = 'myRandomSelector';
     * // optionally: doRandomSelection.visibility = 'always';
     * registry.registerExtension('org.bigconnect.graph.selection', doRandomSelection);
     */
    registry.documentExtensionPoint('org.bigconnect.graph.selection',
        'Add custom graph selection menu items',
        function(e) {
            return ('identifier' in e) &&
                _.contains(
                    ['selected', 'none-selected', 'always'],
                    e.visibility
                );
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/graph-selection'
    );

    /**
     * Extension to add new graph [layouts](http://js.cytoscape.org/#layouts) that are accesible from the layout
     * context menu.
     *
     * the `identifier` is used for the menu option text and should be in the
     * plugins message bundle:
     *
     *      graph.layout.myLayout.displayName=My Layout
     *
     * @param {function} config A cytoscape layout object constructor.
     * @param {string} config.identifier The layout identifier
     * @param {function} config.run Instance method to run the layout.
     * @example
     * MyLayout.identifier = 'myLayout';
     * function MyLayout(options) {
     *     this.options = options;
     * }
     *
     * MyLayout.prototype.run = function() {
     *     var cy = this.options.cy;
     *
     *     // Layout nodes
     *     // Note: Use util/retina to convert from points to pixels (Hi-DPI displays)
     *     cy.nodes()[0].renderedPosition({x:100,y:100})
     *
     *     // Must call ready and stop callbacks
     *     cy.one("layoutready", options.ready);
     *     cy.emit("layoutready");
     *
     *     cy.one("layoutstop", options.stop);
     *     cy.emit("layoutstop");
     *
     *     return this;
     * };
     * registry.registerExtension('org.bigconnect.graph.layout', MyLayout);
     */
    registry.documentExtensionPoint('org.bigconnect.graph.layout',
        'Add new cytoscape layouts to graph menu',
        function(e) {
            return ('identifier' in e);
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/graph-layout'
    );

    /**
     * Plugin to add custom view components which overlay the graph. Used for toolbars, etc., that interact with the graph.
     *
     * Views can be Flight or React components and should be styled to be
     * absolutely positioned. The absolute position given is relative to the
     * graph. `0,0` is top-left corner of graph     *
     *
     * @param {string} componentPath Path to component to render
     * component
     */
    registry.documentExtensionPoint('org.bigconnect.graph.view',
        'Add components to graph container',
        function(e) {
            return ('componentPath' in e);
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/graph-view'
    );

    /**
     * Register a function that can add or remove classes from cytoscape collapsed nodes for custom styling.
     *
     * @param {org.bigconnect.graph.collapsed.class~classFn} config
     */
    registry.documentExtensionPoint('org.bigconnect.graph.collapsed.class',
        'Function that can change cytoscape classes of nodes',
        function(e) {
            return _.isFunction(e);
        },
        'http://docs.bigconnect.org/extension-points/front-end/graphCollapsedNode/class.html'
    );

    /**
     * Register a function that can add or remove classes from cytoscape nodes for custom styling.
     *
     * @param {org.bigconnect.graph.node.class~classFn} config
     */
    registry.documentExtensionPoint('org.bigconnect.graph.node.class',
        'Function that can change cytoscape classes of nodes',
        function(e) {
            return _.isFunction(e);
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/graph-node-class'
    );

    /**
     * Register a function that can add or remove classes from cytoscape edges for custom styling.
     *
     * @param {org.bigconnect.graph.edge.class~classFn} config
     */
    registry.documentExtensionPoint('org.bigconnect.graph.edge.class',
        'Function that can change cytoscape classes of edges',
        function(e) {
            return _.isFunction(e);
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/graph-edge-class'
    );

    /**
     * Allows extensions to adjust the `data` attribute of cytoscape nodes.
     * @param {org.bigconnect.graph.node.transformer~transformerFn} config
     */
    registry.documentExtensionPoint('org.bigconnect.graph.node.transformer',
        'Function that can change cytoscape node structure',
        function(e) {
            return _.isFunction(e);
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/graph-node-transformer'
    );

    /**
     * Allows extensions to adjust the `data` attribute of cytoscape edges.
     * @param {org.bigconnect.graph.edge.transformer~transformerFn} config
     */
    registry.documentExtensionPoint('org.bigconnect.graph.edge.transformer',
        'Function that can change cytoscape edge structure',
        function(e) {
            return _.isFunction(e);
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/graph-edge-transformer'
    );
    registry.registerExtension('org.bigconnect.product.toolbar.item', {
        identifier: 'toggleEdgeLabel',
        itemComponentPath: 'com/mware/web/product/graph/dist/EdgeLabel',
        canHandle: (product) => product.kind === 'org.bigconnect.web.product.graph.GraphWorkProduct'
    });
    registry.registerExtension('org.bigconnect.product.toolbar.item', {
        identifier: 'toggleNodeLabel',
        itemComponentPath: 'com/mware/web/product/graph/dist/NodeLabel',
        canHandle: (product) => product.kind === 'org.bigconnect.web.product.graph.GraphWorkProduct'
    });
    registry.registerExtension('org.bigconnect.product.toolbar.item', {
        identifier: 'toggleNodeImage',
        itemComponentPath: 'com/mware/web/product/graph/dist/NodeImage',
        canHandle: (product) => product.kind === 'org.bigconnect.web.product.graph.GraphWorkProduct'
    });
    registry.registerExtension('org.bigconnect.product.toolbar.item', {
        identifier: 'toggleSnapToGrid',
        itemComponentPath: 'com/mware/web/product/graph/dist/SnapToGrid',
        canHandle: (product) => product.kind === 'org.bigconnect.web.product.graph.GraphWorkProduct'
    });
    registry.registerExtension('org.bigconnect.vertex.menu', {
        label: i18n('vertex.contextmenu.add_related'),
        event: 'addRelatedItems',
        shortcut: 'alt+r',
        shouldDisable: function(selection, vertexId, target) {
            if (!bcData.currentWorkspaceEditable) {
                return true;
            }
            var graph = document.querySelector('.org-bigconnect-graph');
            if (graph) {
                return !graph.contains(target)
            }
            return true;
        },
        options: {
            insertIntoMenuItems: function(item, items) {
                const index = _.findIndex(items, { label: i18n('vertex.contextmenu.search') });
                if (index >= 0) {
                    items.splice(index + 1, 0, item);
                } else {
                    items.push(item);
                }
            }
        }
    });
    registry.registerExtension('org.bigconnect.vertex.menu', {
        cls: 'requires-EDIT',
        label: i18n('vertex.contextmenu.connect'),
        shortcut: 'CTRL+drag',
        event: 'startVertexConnection',
        selection: 1,
        args: {
            connectionType: 'CreateConnection'
        },
        shouldDisable: function(selection, vertexId, target) {
            return $(target).closest('.org-bigconnect-graph').length === 0;
        },
        options: {
            insertIntoMenuItems: function(item, items) {
                items.splice(0, 0, item);
            }
        }
    })
    registry.registerExtension('org.bigconnect.vertex.menu', {
        label: i18n('vertex.contextmenu.find_path'),
        shortcut: 'CTRL+drag',
        event: 'startVertexConnection',
        selection: 1,
        args: {
            connectionType: 'FindPath'
        },
        shouldDisable: function(selection, vertexId, target) {
            return $(target).closest('.org-bigconnect-graph').length === 0;
        },
        options: {
            insertIntoMenuItems: function(item, items) {
                items.splice(1, 0, item, 'DIVIDER');
            }
        }
    });
    registry.registerExtension('org.bigconnect.vertex.menu', {
        label: i18n('vertex.contextmenu.show_path'),
        event: 'startVertexConnection',
        selection: 1,
        args: {
            connectionType: 'ShowPath'
        },
        shouldDisable: function(selection, vertexId, target) {
            return $(target).closest('.org-bigconnect-graph').length === 0;
        },
        options: {
            insertIntoMenuItems: function(item, items) {
                items.splice(1, 0, item, 'DIVIDER');
            }
        }
    });
    registry.registerExtension('org.bigconnect.vertex.menu', {
        label: i18n('vertex.contextmenu.open.preview'),
        subtitle: i18n('vertex.contextmenu.open.preview.subtitle'),
        event: 'previewVertex',
        shortcut: 'alt+p',
        shouldDisable: function(selection, vertexId, target) {
            return $(target).closest('.org-bigconnect-graph').length === 0;
        },
        options: {
            insertIntoMenuItems: function(item, items) {
                var openItem = _.findWhere(items, { label: i18n('vertex.contextmenu.open') });
                if (openItem) {
                    openItem.submenu.splice(0, 0, item);
                }
            }
        }
    });

    registry.registerExtension('org.bigconnect.graph.export', {
        menuItem: i18n('graph.export'),
        componentPath: 'com/mware/web/product/graph/dist/ExportGraph',
        showPopoverCancel: false
    });

    $(() => {
        $(document).trigger('registerKeyboardShortcuts', {
            scope: i18n('graph.help.scope'),
            shortcuts: {
                '-': { fire: 'zoomOut', desc: i18n('graph.help.zoom_out') },
                '=': { fire: 'zoomIn', desc: i18n('graph.help.zoom_in') },
                'alt-f': { fire: 'fit', desc: i18n('graph.help.fit') },
                'alt-n': { fire: 'createVertex', desc: i18n('graph.help.create_vertex') },
                'alt-p': { fire: 'previewVertex', desc: i18n('graph.help.preview_vertex') }
            }
        });
    });

    const mimeTypes = [BC_MIMETYPES.ELEMENTS];
    const style = { height: '100%' };

    const GraphContainer = redux.connect(

        (state, props) => {
            var pixelRatio = 1,
                concepts = ontologySelectors.getConcepts(state), // Used in F.vertex.image
                properties = ontologySelectors.getProperties(state),
                relationships = ontologySelectors.getRelationships(state),
                panelPadding = { top: 0, left: 0, right: 0, bottom: 0 },
                ghosts = state['org-bigconnect-graph'].animatingGhosts,
                uiPreferences = userSelectors.getPreferences(state),
                rootId = props.product.localData && props.product.localData.rootId || 'root',
                needsLayoutObj = productSelectors.getNeedsLayout(state),
                needsLayout = needsLayoutObj[props.product.id] || false;

            const prefs = {
                edgeLabels: parsers.bool.parse(uiPreferences.edgeLabels, true),
                nodeLabels: parsers.bool.parse(uiPreferences.nodeLabels, true),
                nodeImages: parsers.bool.parse(uiPreferences.nodeImages, true)
            };

            return {
                ...props,
                selection: productSelectors.getSelectedElementsInProduct(state),
                focusing: productSelectors.getFocusedElementsInProduct(state),
                interacting: productSelectors.getInteracting(state),
                needsLayout,
                ghosts,
                pixelRatio,
                concepts,
                properties,
                relationships,
                panelPadding,
                rootId,
                productElementIds: productSelectors.getElementIdsInProduct(state),
                elements: productSelectors.getElementsInProduct(state),
                workspace: state.workspace.byId[state.workspace.currentId],
                mimeTypes,
                style,
                ...prefs
            }
        },

        function(dispatch, props) {
            return {
                onAddSelection: (selection) => dispatch(selectionActions.add(selection)),
                onRemoveSelection: (selection) => dispatch(selectionActions.remove(selection)),
                onSetSelection: (selection) => dispatch(selectionActions.set(selection)),
                onClearSelection: () => dispatch(selectionActions.clear()),

                onUpdatePreview: (productId, dataUrl) => dispatch(productActions.updatePreview(productId, dataUrl)),

                onUpdateRootId: (productId, nodeId) => dispatch(productActions.updatePreview(productId, nodeId)),

                onCollapseNodes: (productId, collapseData) => dispatch(graphActions.collapseNodes(productId, collapseData, { undoable: true })),
                onUncollapseNodes: (productId, collapsedNodeId) => dispatch(graphActions.uncollapseNodes(productId, collapsedNodeId, { undoable: true })),
                onRenameCollapsedNode: (productId, collapsedNodeId, title) => dispatch(graphActions.renameCollapsedNode(productId, collapsedNodeId, title)),

                onAddRelated: (productId, vertices) => dispatch(graphActions.addRelated(productId, vertices)),
                onUpdatePositions: (productId, positions) => dispatch(graphActions.updatePositions(productId, positions, { undoable: true })),
                onNeedsLayout: (productId, needsLayout) => dispatch(productActions.updateNeedsLayout(productId, needsLayout)),
                onSearch(event) {
                    event.preventDefault();
                    if (!$('.search-pane.visible').length) {
                        $(document).trigger('menubarToggleDisplay', { name: 'search' })
                    }
                },
                onGhostFinished(id) {
                    dispatch(graphActions.removeGhost(id))
                },
                onDrop: (event, position) => {
                    const { dataTransfer } = event;
                    const elements = dnd.getElementsFromDataTransfer(dataTransfer);
                    if (elements) {
                        event.preventDefault();
                        event.stopPropagation();
                        dispatch(graphActions.dropElements(props.product.id, elements, position, props.rootId))
                    }
                },
                onDropElementIds: (elementIds, position) => {
                    dispatch(graphActions.dropElements(props.product.id, elementIds, position, props.rootId))
                },
                onRemoveElementIds: (elementIds) => {
                    dispatch(graphActions.removeElements(props.product.id, elementIds, { undoable: true }));
                },
                onCollapsedItemMenu: (element, collapsedItemId, position) => {
                    $(element).trigger('showCollapsedItemContextMenu', { collapsedItemId, position });
                },
                onVertexMenu: (element, vertexId, position) => {
                    $(element).trigger('showVertexContextMenu', { vertexId, position });
                },
                onEdgeMenu: (element, edgeIds, position) => {
                    $(element).trigger('showEdgeContextMenu', { edgeIds, position });
                }
            }
        },
        null,
        { withRef: true }
    )(DroppableHOC(Graph, '.org-bigconnect-graph'));

    return GraphContainer;
});
