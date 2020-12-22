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
    'create-react-class',
    'prop-types',
    'underscore',
    'cytoscape',
    'cytoscape-dagre',
    'cytoscape-cola',
    './d3Layout/D3Layout',
    'fast-json-patch',
    'product/toolbar/ProductToolbar',
    'colorjs',
    './Menu',
    'util/formatters',
    'util/retina',
    'antd'
], function(
    createReactClass,
    PropTypes,
    _,
    cytoscape,
    cyDagre,
    cyCola,
    cyd3,
    jsonpatch,
    ProductToolbar,
    colorjs,
    Menu,
    F,
    retina,
    antd) {

    const { Spin } = antd;
    const ANIMATION = { duration: 400, easing: 'spring(250, 20)' };
    const ANIMATION_SLOW = { ...ANIMATION, duration: 800 };
    const LAYOUT_SPACING = 0.75;
    const LAYOUT_ANIMATION_SPEED = 1000;
    const LAYOUT_MAX_EDGES_ANIMATION = 3000;

    const PanelPaddingBorder = 35;
    const MAX_ELEMENTS_BEFORE_NO_ANIMATE = 50;
    const DEFAULT_PNG = Object.freeze({
        bg: 'white',
        full: true,
        maxWidth: 300,
        maxHeight: 300
    });
    const PREVIEW_DEBOUNCE_SECONDS = 3;
    const EVENTS = {
        drag: 'onDrag',
        free: 'onFree',
        grab: 'onGrab',
        position: 'onPosition',
        layoutstop: 'onLayoutStop',
        mouseover: 'onMouseOver',
        mouseout: 'onMouseOut',
        remove: 'onRemove',
        tap: 'onTap',
        tapstart: 'onTapStart',
        tapend: 'onTapEnd',
        taphold: 'onTapHold',
        cxttap: 'onContextTap',
        cxttapstart: 'onCxtTapStart',
        cxttapend: 'onCxtTapEnd',
        pan: 'onPan',
        zoom: 'onZoom',
        fit: 'onFit',
        change: 'onChange',
        select: 'onSelect',
        unselect: 'onUnselect'
    };
    const eventPropTypes = {};
    _.each(EVENTS, propKey => { eventPropTypes[propKey] = PropTypes.func })
    const DrawEdgeNodeId = 'DrawEdgeNodeId';

    const isEdge = data => (data.source !== undefined)
    const isNode = _.negate(isEdge)

    const Cytoscape = createReactClass({

        propTypes: {
            hasPreview: PropTypes.bool,
            editable: PropTypes.bool,
            onCollapseSelectedNodes: PropTypes.func.isRequired,
            requestUpdate: PropTypes.func.isRequired,
            ...eventPropTypes
        },

        getDefaultProps() {
            const eventProps = _.mapObject(_.invert(EVENTS), () => () => {})
            return {
                ...eventProps,
                animate: true,
                config: {},
                elements: { nodes: [], edges: [] },
                fit: false,
                hasPreview: false,
                panelPadding: { left:0, right:0, top:0, bottom:0 },
                onReady() {},
                onGhostFinished() {},
                onUpdatePreview() {}
            }
        },

        getInitialState() {
            return {
                layoutRunning: false,
                showGraphMenu: false,
                controlDragSelection: null
            };
        },

        componentDidMount() {
            this.moving = {};
            this.updatePreview = this.props._disablePreviewDelay ?
                this._updatePreview :
                _.debounce(this._updatePreview, PREVIEW_DEBOUNCE_SECONDS * 1000);
            this.previousConfig = this.prepareConfig();
            const cy = cytoscape(this.previousConfig);
            const updateControlDragSelection = (nodeId = null) => this.setState({ controlDragSelection: nodeId });

            cytoscape.use( cyCola );
            cytoscape.use( cyDagre );
            cytoscape.use( cyd3 );

            this.clientRect = this.refs.cytoscape.getBoundingClientRect();
            this.setState({ cy })

            cy.on('tap mouseover mouseout', 'node.decoration', event => {
                this.props.onDecorationEvent(event);
            });
            cy.on('position grab free', 'node.v,node.ancillary', ({ target }) => {
                if (target.isChild()) {
                    this.updateDecorationPositions(target);
                }
            })
            cy.on('mousemove', (event) => {
                const { controlDragSelection } = this.state;
                const { drawEdgeToMouseFrom } = this.props;
                const { target, cy } = event;
                const targetIsNode = target !== cy && target.is('node.v');

                if (drawEdgeToMouseFrom) {
                    if (targetIsNode && !drawEdgeToMouseFrom.toVertexId) {
                        if (target.data().id !== controlDragSelection) {
                            updateControlDragSelection(target.id());
                        }
                    } else if (controlDragSelection) {
                        updateControlDragSelection();
                    }

                    if (!drawEdgeToMouseFrom.toVertexId) {
                        const { pageX, pageY } = event.originalEvent;
                        const { left, top } = this.clientRect;
                        const node = cy.getElementById(DrawEdgeNodeId);

                        if (targetIsNode) {
                            node.position(target.position());
                        } else {
                            node.renderedPosition({ x: pageX - left, y: pageY - top });
                        }
                    }
                } else if (!drawEdgeToMouseFrom && controlDragSelection) {
                    updateControlDragSelection();
                }
            });
        },

        componentWillUnmount() {
            if (this.state.cy) {
                this.state.cy.destroy();
                this.unmounted = true;
            }
        },

        componentDidUpdate(prevProps, prevState) {
            const { cy } = this.state;
            const { elements, drawEdgeToMouseFrom, hasPreview, drawPaths: newPaths } = this.props;
            const oldPaths = prevProps.drawPaths;
            const newData = { elements };
            const oldData = cy.json()
            const disableSelection = Boolean(drawEdgeToMouseFrom);
            const newProduct = (!this.previousProductId) || (this.props.product.id !== this.previousProductId);
            this.previousProductId = this.props.product.id

            if (oldPaths && oldPaths !== newPaths) {
                cy.$('.path-edge').removeStyle('display opacity line-color source-arrow-color target-arrow-color');
            }

            this.drawEdgeToMouseFrom(newData);
            this.drawPaths(newData);
            this.drawControlDragSelection(newData);

            // Create copies of objects because cytoscape mutates :(
            const getAllData = nodes => nodes.map(({data, selected, grabbable, selectable, locked, position, renderedPosition, classes}) => ({
                data: {...data},
                selected: selected || false,
                classes,
                position: position && {...position},
                grabbable, selectable, locked,
                renderedPosition: renderedPosition && {...renderedPosition}
            }))
            const getTypeData = elementType => [oldData, newData].map(n => getAllData(n.elements[elementType] || []) )
            const [oldNodes, newNodes] = getTypeData('nodes')
            const [oldEdges, newEdges] = getTypeData('edges')

            this.updateConfiguration(this.previousConfig, this.props.config);
            let deferredNodes = [], decorations = [], ghostAnimations = [];
            let nodeChanges, edgeChanges;
            cy.batch(() => {
                nodeChanges = this.makeChanges(oldNodes, newNodes, newProduct, deferredNodes, decorations, ghostAnimations)
                edgeChanges = this.makeChanges(oldEdges, newEdges, newProduct);
            })
            deferredNodes.forEach(n => n());
            cy.batch(() => decorations.forEach(n => n()));
            cy.batch(() => this.updatePathStyles(oldPaths, newPaths));

            cy.autounselectify(disableSelection)

            if (newProduct) {
                _.defer(() => {
                    this.fit(null, { animate: false });
                })
            }

            if ((newProduct && !hasPreview) || nodeChanges || edgeChanges) {
                this.updatePreview();
            }
            ghostAnimations.forEach(a => a());

            if(nodeChanges && this.props.needsLayout) {
                _.defer(() => {
                    this.onMenuLayout('cose');
                });
            }
        },

        _updatePreview() {
            if (this.idleUpdatePosition) {
                cancelIdleCallback(this.idleUpdatePosition);
            }

            this.idleUpdatePosition = requestIdleCallback(() => {
                if (this.unmounted) return;
                const { cy } = this.state;
                    const png = cy.png(DEFAULT_PNG);

                    this.props.onUpdatePreview(png);
            })
        },

        prepareConfig() {
            const defaults = {
                container: this.refs.cytoscape,
                boxSelectionEnabled: true,
                ready: (event) => {
                    var { cy } = event;

                    _.each(EVENTS, (name, key) => {
                        cy.on(key, (e) => {
                            if (this[key + 'Disabled'] !== true) {
                                this.props[name](e)
                            }
                        });
                    });
                    cy.on('position', () => {
                        this.updatePreview();
                    })
                    cy.on('cxttap', (event) => {
                        const {target, cy} = event;
                        if (cy === target) {
                            this.setState({ showGraphMenu: event })
                        }
                    })
                    cy.on('tap', (event) => {
                        const {target, cy} = event;
                        if (cy === target && event.originalEvent.ctrlKey) {
                            this.setState({ showGraphMenu: event })
                        }
                    })
                    cy._private.originalMinZoom = cy._private.minZoom;
                    cy._private.originalMaxZoom = cy._private.maxZoom;
                    this.props.onReady(event)
                }
            }
            var { config } = this.props;
            if (config) {
                return { ...defaults, ...config }
            }
            return defaults;
        },

        render() {
            const { showGraphMenu, layoutRunning } = this.state;
            const { editable, product } = this.props;

            const menu = showGraphMenu ? (
                <Menu event={showGraphMenu}
                      editable={editable}
                      onEvent={this.onMenu}
                      cy={this.state.cy}/>
            ) : null;

            const spinner = layoutRunning ? (<Spin size="large"/>) : null;

            return (
                <div onMouseDown={this.onMouseDown} style={{height: '100%'}}>
                    <div style={{height: '100%', opacity: layoutRunning ? 0.25 : 1}} ref="cytoscape"></div>
                    {this.state.cy ? (
                        <ProductToolbar
                            rightOffset={this.props.panelPadding.right}
                            injectedProductProps={this.getInjectedToolProps()}
                            product={product}
                            showNavigationControls={true}
                            onFit={this.onControlsFit}
                            onZoom={this.onControlsZoom}
                        />
                    ) : null}
                    {menu}
                    {spinner}
                </div>
            )
        },

        updateDecorationPositions(cyNode, options = {}) {
            const { animate = false, toPosition } = options;

            if (cyNode.isChild() && !cyNode.hasClass('decoration')) {
                const decorations = cyNode.siblings().filter('.decoration');
                if (decorations && decorations.length) {
                    const specs = specsForNode(cyNode, toPosition);
                    if (animate) {
                        decorations.forEach(function(decoration) {
                            const position = calculatePosition(decoration.data('padding'), decoration.data('alignment'), decoration, specs);
                            decoration.stop().animate({ position }, { ...ANIMATION });
                        })
                    } else {
                        this.state.cy.batch(function() {
                            decorations.forEach(function(decoration) {
                                decoration.position(calculatePosition(decoration.data('padding'), decoration.data('alignment'), decoration, specs));
                            })
                        })
                    }
                }
            }
        },

        onMouseDown(event) {
            if (this.state.showGraphMenu) {
                this.setState({ showGraphMenu: false })
            }
        },

        _zoom(factor, dt = 1) {
            const { cy } = this.state;

            cy.zoom({
                level: cy.zoom() + factor * dt,
                renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
            })
        },

        onMenu(event) {
            this.setState({ showGraphMenu: false })

            const dataset = event.target.dataset;
            const args = (dataset.args ? JSON.parse(dataset.args) : []).concat([event])
            const fnName = `onMenu${dataset.func}`;
            if (fnName in this) {
                this[fnName](...args);
            } else if (fnName in this.props) {
                this.props[fnName](...args);
            } else {
                console.warn('No handler for menu item', fnName, args)
            }
        },

        onMenuZoom(level) {
            const { cy } = this.state;
            const zoom1 = cy._private.zoom;
            const zoom2 = level;
            const pan1 = cy._private.pan;
            cy.invalidateDimensions();
            const bb = cy.renderer().containerBB;
            const pos = { x: bb.width / 2, y: bb.height / 2 }
            const pan2 = {
                x: -zoom2 / zoom1 * (pos.x - pan1.x) + pos.x,
                y: -zoom2 / zoom1 * (pos.y - pan1.y) + pos.y
            };

            cy.animate({ zoom: zoom2, pan: pan2 }, { ...ANIMATION, queue: false });
        },

        onMenuFitToWindow() {
            this.fit();
        },

        onMenuCollapseSelectedNodes() {
            const { cy } = this.state;
            const selectedNodes = cy.nodes().filter(':selected');
            this.props.onCollapseSelectedNodes(selectedNodes);
        },

        onMenuLayout(layout, options) {
            const { cy } = this.state;
            const onlySelected = options && options.onlySelected;
            const elements = cy.collection(
                cy.$(onlySelected ? '.v:selected,.c:selected,.e' : '.v,.c,.e')
            );

            const ids = _.map(elements, node => node.id())
            this.moving = _.indexBy([...Object.keys(this.moving), ...ids]);

            if (layout === 'cola') {
                this.graphApplyLayoutCola(elements, onlySelected);
            } else if (layout === 'breadthfirstCircle') {
                this.graphApplyLayoutBreadthFirst(elements, onlySelected, true);
            } else if (layout === 'breadthfirstTree') {
                this.graphApplyLayoutBreadthFirst(elements, onlySelected, false);
            } else if (layout === 'dagre') {
                this.graphApplyLayoutDagre(elements, onlySelected);
            } else if (layout === 'concentric') {
                this.graphApplyLayoutConcentric(elements, onlySelected);
            } else if (layout === 'circle') {
                this.graphApplyLayoutCircle(elements, onlySelected);
            } else if (layout === 'grid') {
                this.graphApplyLayoutGrid(elements, onlySelected);
            } else if (layout === 'random') {
                this.graphApplyLayoutRandom(elements, onlySelected);
            }  else if (layout === 'd3') {
                this.graphApplyLayoutD3(elements, onlySelected);
            }
        },

        graphApplyLayoutRandom(elements, onlySelected) {
            const layout = elements.makeLayout({
                name: 'random',
                fit: !onlySelected,
                animate: function(els) {
                    return els.length < LAYOUT_MAX_EDGES_ANIMATION;
                },
                animationDuration: LAYOUT_ANIMATION_SPEED, // duration of animation in ms if enabled
                spacingFactor: LAYOUT_SPACING
            });
            this.applyLayout(layout, !onlySelected);
        },

        graphApplyLayoutGrid(elements, onlySelected) {
            const layout = elements.makeLayout({
                name: 'grid',
                fit: !onlySelected,
                animate: function(els) {
                    return els.length < LAYOUT_MAX_EDGES_ANIMATION;
                },
                animationDuration: LAYOUT_ANIMATION_SPEED, // duration of animation in ms if enabled
                spacingFactor: LAYOUT_SPACING
            });
            this.applyLayout(layout, !onlySelected);
        },

        graphApplyLayoutCircle(elements, onlySelected) {
            const layout = elements.makeLayout({
                name: 'circle',
                fit: !onlySelected,
                animate: function(els) {
                    return els.length < LAYOUT_MAX_EDGES_ANIMATION;
                },
                animationDuration: LAYOUT_ANIMATION_SPEED, // duration of animation in ms if enabled
                spacingFactor: LAYOUT_SPACING
            });
            this.applyLayout(layout, !onlySelected);
        },

        graphApplyLayoutConcentric(elements, onlySelected) {
            const layout = elements.makeLayout({
                name: 'concentric',
                fit: !onlySelected,
                concentric: function(node) { return node.degree(); },
                levelWidth: function(nodes) { return nodes.maxDegree() / 4; },
                minNodeSpacing: LAYOUT_SPACING, // min spacing between outside of nodes (used for radius adjustment)
                padding: 3,
                animate: function(els) {
                    return els.length < LAYOUT_MAX_EDGES_ANIMATION;
                },
                animationDuration: LAYOUT_ANIMATION_SPEED, // duration of animation in ms if enabled
                animationEasing: undefined, // easing of animation if enabled
                ready: undefined, // callback on layoutready
                spacingFactor: LAYOUT_SPACING + 1
            });
            this.applyLayout(layout, !onlySelected);
        },

        graphApplyLayoutDagre(elements, onlySelected) {
            const layout = elements.makeLayout({
                name: 'dagre',
                animate: function(els) {
                    return els.length < LAYOUT_MAX_EDGES_ANIMATION;
                },
                animationDuration: LAYOUT_ANIMATION_SPEED, // duration of animation in ms if enabled
                // dagre algo options, uses default value on undefined
                nodeSep: undefined, // the separation between adjacent nodes in the same rank
                edgeSep: undefined, // the separation between adjacent edges in the same rank
                rankSep: undefined, // the separation between adjacent nodes in the same rank
                rankDir: 'BT', // 'TB' for top to bottom flow, 'LR' for left to right
                minLen: function(edge) { return 1; }, // number of ranks to keep between the source and target of the edge
                edgeWeight: function(edge) { return 1; }, // higher weight edges are generally made shorter and straighter than lower weight edges

                // general layout options
                fit: !onlySelected, // whether to fit to viewport
                padding: 3, // fit padding
                spacingFactor: LAYOUT_SPACING,
                animationEasing: undefined, // easing of animation if enabled
                boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
                ready: function() { }, // on layoutready
            });

            this.applyLayout(layout, !onlySelected);
        },

        graphApplyLayoutD3(elements, onlySelected) {
            const layout = elements.makeLayout({
                name: 'd3-force',
                animate: false,
                fit: !onlySelected,
                linkId: (d) => {
                    return d.id;
                },
                linkDistance: 100,
                manyBodyStrength: -500,
                randomize: false,
                infinite: false
            });

            this.applyLayout(layout, !onlySelected);
        },

        graphApplyLayoutCola(elements, onlySelected) {
            const layout = elements.makeLayout({
                name: 'cola',
                animate: function(els) {
                    return els.length < LAYOUT_MAX_EDGES_ANIMATION;
                },
                maxSimulationTime: LAYOUT_ANIMATION_SPEED + 2000, // duration of animation in ms if enabled
                refresh: 1, // number of ticks per frame; higher is faster but more jerky
                ungrabifyWhileSimulating: false, // so you can't drag nodes during layout
                fit: !onlySelected, // on every layout reposition of nodes, fit the viewport
                padding: 3, // padding around the simulation
                boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }

                // positioning options
                randomize: false, // use random node positions at beginning of layout
                avoidOverlap: true, // if true, prevents overlap of node bounding boxes
                handleDisconnected: true, // if true, avoids disconnected components from overlapping
                nodeSpacing: LAYOUT_SPACING, // extra spacing around nodes
                flow: undefined, // use DAG/tree flow layout if specified, e.g. { axis: 'y', minSeparation: 30 }
                alignment: undefined, // relative alignment constraints on nodes, e.g. function( node ){ return { x: 0, y: 1 } }

                // different methods of specifying edge length
                // each can be a constant numerical value or a function like `function( edge ){ return 2; }`
                edgeLength: undefined, // sets edge length directly in simulation
                edgeSymDiffLength: undefined, // symmetric diff edge length in simulation
                edgeJaccardLength: undefined, // jaccard edge length in simulation

                // iterations of cola algorithm; uses default values on undefined
                unconstrIter: undefined, // unconstrained initial layout iterations
                userConstIter: undefined, // initial layout iterations with user-specified constraints
                allConstIter: undefined, // initial layout iterations with all constraints including non-overlap

                // infinite layout options
                infinite: false // overrides all other options for a forces-all-the-time mode
            });

            this.applyLayout(layout, !onlySelected);
        },

        graphApplyLayoutBreadthFirst(elements, onlySelected, circle) {
            const layout = elements.makeLayout({
                name: 'breadthfirst',
                fit: !onlySelected, // whether to fit the viewport to the graph
                directed: false, // whether the tree is directed downwards (or edges can point in any direction if false)
                padding: 50, // padding on fit !!! try 30 !!!
                circle: circle, // put depths in concentric circles if true, put depths top down if false
                spacingFactor: LAYOUT_SPACING + 1, // positive spacing factor, larger => more space between nodes (N.B. n/a if causes overlap)
                nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
                boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
                avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
                roots: undefined, // the roots of the trees
                maximalAdjustments: 0, // how many times to try to position the nodes in a maximal way (i.e. no backtracking)
                animate: function(els) {
                    return els.length < LAYOUT_MAX_EDGES_ANIMATION;
                },
                animationDuration: LAYOUT_ANIMATION_SPEED, // duration of animation in ms if enabled
                animateFilter: function(node, i) { return true; },
                transform: function(node, position) { return position; },
            });

            this.applyLayout(layout, !onlySelected);
        },

        applyLayout(layout, shouldFit) {
            const { cy } = this.state;
            this.layoutDone = false;
            this.setState({ layoutRunning: true });

            cy.$('.e').addClass('invisible');
            layout.pon('layoutstop').then((event) => {
                // rendering again all the edges
                cy.$('.e').removeClass('invisible');
                // clearing the timeout
                clearTimeout(this.runningLayoutTimeout);

                this.layoutDone = true;
                if (!shouldFit) {
                    this.fit();
                }
                this.setState({ layoutRunning: false });
            });

            this.runningLayoutTimeout = setTimeout(() => {
                layout.stop();
            }, 3000);

            setTimeout(() => {
                layout.run();
            }, 100);
        },

        onMenuSizeNodes(strategy, options) {
            const STD_SIZE = 30 * 1, //retina.devicePixelRatio,
                MAX_SISZE = STD_SIZE * 3,
                MIN_SIZE = 10;
            const { cy } = this.state;
            const allNodes = cy.elements();
            let func = null;
            switch (strategy) {
                case 'standard':
                    func = () => 1;
                case 'pageRank':
                    func = allNodes.pageRank().rank;
                    break;
                case 'degreeCentrality':
                    func = allNodes.degreeCentralityNormalized().degree;
                    break;
                case 'closenessCentrality':
                    func = allNodes.closenessCentralityNormalized().closeness;
                    break;
                case 'betweennessCentrality':
                    func = allNodes.bc().betweenness;
                    break;
            }

            if(strategy != 'standard') {
                cy.nodes().forEach((ele, i) => {
                    let sizeCoef = func(ele);
                    ele.data('sizeCoef', sizeCoef);
                });

                let sorted = _.sortBy(cy.nodes(), e => e.data('sizeCoef')).reverse(),
                    topValue = sorted[0].data('sizeCoef');

                _.each(sorted, e => {
                    let newSize = (e.data('sizeCoef') / topValue) * MAX_SISZE;
                    if (newSize < MIN_SIZE)
                        newSize = MIN_SIZE

                    e.animate({
                        style: {
                            width: newSize,
                            height: newSize
                        },
                        duration: 300
                    });
                });
            } else {
                // reset size to standard size
                cy.nodes().forEach((e, i) => {
                    e.animate({
                        style: {
                            width: STD_SIZE,
                            height: STD_SIZE
                        },
                        duration: 300
                    });
                });
            }
        },

        onControlsZoom(dir) {
            this._zoom(.2 * (dir === 'out' ? -1 : 1));
        },

        onControlsPan(pan, options) {
            this.state.cy.panBy(pan);
        },

        onControlsFit() {
            this.fit();
        },

        fit(nodes, options = {}) {
            const { animate = true } = options;
            const { cy } = this.state;
            const cyNodes = nodes || cy.nodes('node.c,node.v,node.partial,.ancillary,.decoration');

            if (cyNodes.size() === 0) {
                cy.reset();
            } else {
                var bb = cyNodes.boundingBox({ includeLabels: false, includeNodes: true, includeEdges: false }),
                    style = cy.style(),
                    { left, right, top, bottom } = this.props.panelPadding,
                    w = parseFloat(style.containerCss('width')),
                    h = parseFloat(style.containerCss('height')),
                    zoom;

                left += PanelPaddingBorder;
                right += PanelPaddingBorder;
                top += PanelPaddingBorder;
                bottom += PanelPaddingBorder;

                if (!isNaN(w) && !isNaN(h)) {
                    zoom = Math.min(1, Math.min(
                        (w - (left + right)) / bb.w,
                        (h - (top + bottom)) / bb.h
                    ));

                    // Set min and max zoom to fit all items
                    if (zoom < cy._private.minZoom) {
                        cy._private.minZoom = zoom;
                        cy._private.maxZoom = 1 / zoom;
                    } else {
                        cy._private.minZoom = cy._private.originalMinZoom;
                        cy._private.maxZoom = cy._private.originalMaxZoom;
                    }

                    if (zoom > cy._private.maxZoom) zoom = cy._private.maxZoom;

                    var position = {
                            x: (w + left - right - zoom * (bb.x1 + bb.x2)) / 2,
                            y: (h + top - bottom - zoom * (bb.y1 + bb.y2)) / 2
                        },
                        _p = cy._private;

                    if (animate) {
                        return new Promise(function(f) {
                            cy.animate({
                                zoom: zoom,
                                pan: position
                            }, {
                                ...ANIMATION,
                                queue: false,
                                complete: () => {
                                    f();
                                }
                            });
                        })
                    } else {
                        _p.zoom = zoom;
                        _p.pan = position;
                        cy.emit('pan zoom viewport');
                        cy.notify({ type: 'viewport' });
                    }
                }
            }
        },

        disableEvent(name, fn) {
            var names = name.split(/\s+/);
            names.forEach(name => (this[name + 'Disabled'] = true))
            fn.apply(this)
            names.forEach(name => (this[name + 'Disabled'] = false))
        },

        updateConfiguration(previous, nextConfig) {
            const { cy } = this.state;

            if (previous) {
                let { style, pan, zoom, ...other } = nextConfig
                _.each(other, (val, key) => {
                    if (!(key in previous) || previous[key] !== val) {
                        if (_.isFunction(cy[key])) {
                            cy[key](val)
                        } else console.warn('Unknown configuration key', key, val)
                    }
                })

                if (!_.isEqual(previous.style, style)) {
                    cy.style()
                        .resetToDefault()
                        .fromJson(style)
                        .update();
                }
            }

            this.previousConfig = nextConfig
        },

        makeChanges(older, newer, newProduct, reparenting, decorations, ghostAnimations) {
            const { interacting } = this.props;
            const { cy } = this.state;

            const animate = !newProduct;
            const add = [];
            const remove = [...older];
            const modify = [];
            const oldById = _.indexBy(older, o => o.data.id);

            newer.forEach(item => {
                var id = item.data.id;
                var existing = oldById[id];
                if (existing) {
                    modify.push({ item, diffs: jsonpatch.compare(existing, item) })
                    var index = _.findIndex(remove, i => i.data.id === id);
                    if (index >= 0) remove.splice(index, 1)
                } else {
                    add.push(item)
                }
            })

            let modifiedPosition = false;
            modify.forEach(({ item, diffs }) => {
                const topLevelChanges = _.indexBy(diffs.filter(diff => diff.op !== 'remove'), d => d.path.replace(/^\/([^\/]+).*$/, '$1'))
                Object.keys(topLevelChanges).forEach(change => {
                    const cyNode = cy.getElementById(item.data.id);
                    if (cyNode.scratch('interacting') || interacting[item.data.id] ) {
                        return;
                    }

                    switch (change) {
                        case 'data':
                            this.disableEvent('data', () => {
                                if (item.data.parent !== cyNode.data('parent')) {
                                    cyNode.removeData().data(_.omit(item.data, 'parent'));
                                    reparenting.push(() => cyNode.move({ parent: item.data.parent }));
                                } else {
                                    cyNode.removeData().data(item.data)
                                }

                                if (decorations) {
                                    decorations.push(() => {
                                        this.updateDecorationPositions(cyNode);
                                    })
                                }
                            })
                            break;

                        case 'grabbable': cyNode[item.grabbable ? 'grabify' : 'ungrabify'](); break;
                        case 'selectable': cyNode[item.selectable ? 'selectify' : 'unselectify'](); break;
                        case 'locked': cyNode[item.locked ? 'lock' : 'unlock'](); break;

                        case 'selected':
                            if (cyNode.selected() !== item.selected) {
                                this.disableEvent('select unselect', () => cyNode[item.selected ? 'select' : 'unselect']());
                            }
                            break;

                        case 'classes':
                            if (item.classes) {
                                cyNode.classes(item.classes)
                            } else if (!_.isEmpty(cyNode._private.classes)) {
                                cyNode.classes();
                            }
                            break;

                        case 'position':
                            if (!cyNode.scratch('interacting') && !cyNode.grabbed() && !(cyNode.id() in this.moving)) {
                                if (!item.data.alignment && !item.data.animateTo) {
                                    const positionChangedWithinTolerance = _.some(cyNode.position(), (oldV, key) => {
                                        const newV = item.position[key];
                                        return (Math.max(newV, oldV) - Math.min(newV, oldV)) >= 1
                                    });

                                    if (positionChangedWithinTolerance) {
                                        modifiedPosition = true;
                                        if (animate && this.props.animate && modify.length < MAX_ELEMENTS_BEFORE_NO_ANIMATE) {
                                            this.positionDisabled = true;
                                            this.updateDecorationPositions(cyNode, { toPosition: item.position, animate: true });
                                            cyNode.stop().animate({ position: item.position }, { ...ANIMATION, complete: () => {
                                                this.positionDisabled = false;
                                            }})
                                        } else {
                                            this.disableEvent('position', () => {
                                                cyNode.position(item.position)
                                                this.updateDecorationPositions(cyNode);
                                            })
                                        }
                                    }
                                }
                            } else if (this.layoutDone) {
                                delete this.moving[cyNode.id()];
                            }
                            break;

                        case 'renderedPosition':
                            if (!topLevelChanges.position && change) {
                                modifiedPosition = true;
                                this.disableEvent('position', () => cyNode.renderedPosition(item.renderedPosition))
                            }
                            break;

                        default:
                            throw new Error('Change not handled: ' + change)
                    }
                })
            })
            add.forEach(item => {
                var { data } = item;

                if (isNode(data)) {
                    if (data.alignment) {
                        const dec = cy.add({
                            ...item,
                            group: 'nodes'
                        })
                        decorations.push(() => {
                            const specs = specsForNode(cy.getElementById(data.vertex.id));
                            dec.position(calculatePosition(data.padding, data.alignment, dec, specs));
                        })
                    } else {
                        var cyNode = cy.add({ ...item, group: 'nodes' })[0]
                        if (cyNode && data.animateTo) {
                            const animation = cyNode._private.animation;
                            var beginAnimation = true;
                            if (animation && animation.current.length === 1) {
                                const toPos = animation.current[0]._private.position;
                                if (toPos.x === data.animateTo.pos.x && toPos.y === data.animateTo.pos.y) {
                                    beginAnimation = false;
                                }
                            }
                            if (beginAnimation) {
                                if (data.animateTo.pos.x !== item.position.x && data.animateTo.pos.y !== item.position.y) {
                                    ghostAnimations.push(() => {
                                        cyNode.stop(true)
                                        _.delay(() => {
                                            cyNode.animate({ position: data.animateTo.pos }, {
                                                ...ANIMATION_SLOW,
                                                complete: () => {
                                                    this.props.onGhostFinished(data.animateTo.id)
                                                }
                                            })
                                        }, 100)
                                    })
                                }
                            }
                        }
                    }
                } else if (isEdge(data)) {
                    cy.add({ ...item, group: 'edges' })
                }
            })
            remove.forEach(item => {
                const cyNode = cy.getElementById(item.data.id);
                if (cyNode.length && !cyNode.removed()) {
                    cy.remove(cyNode)
                }
            })
            return add.length || remove.length || modifiedPosition;
        },

        drawPaths(newData) {
            const { cy } = this.state;
            const { drawPaths } = this.props;

            if (drawPaths) {
                const { paths, renderedPaths, sourceId, targetId, labels } = drawPaths;
                const nodesById = _.indexBy(newData.elements.nodes, n => n.data.id);
                const keyGen = (src, target) => [src, target].sort().join('');
                const edgesById = _.groupBy(
                    newData.elements.edges.filter(e => {
                        const edgeLabels = e.data.edges.reduce((all, e) => {
                            all.push(e.label);
                            return all;
                        }, []);
                        return edgeLabels.some(label => labels.includes(label));
                    }),
                    e => keyGen(e.data.source, e.data.target)
                );

                renderedPaths.forEach((path, i) => {
                    const nodeIds = path.filter(v => v !== sourceId && v !== targetId);
                    const end = colorjs('#0088cc').shiftHue(i * (360 / renderedPaths.length)).toCSSHex();
                    const existingOrNewEdgeBetween = (node1, node2, count) => {
                        var edges = edgesById[keyGen(node1, node2)];
                        if (edges) {
                            edges.filter(e => e.data.edges.some(
                                e => paths[i].includes(e.inVertexId) && paths[i].includes(e.outVertexId)
                            )).forEach(e => {
                                e.classes = (e.classes ? e.classes + ' ' : '') + 'path-edge';
                                e.data.pathColor = end
                            });
                        } else {
                            newData.elements.edges.push({
                                group: 'edges',
                                classes: 'path-edge path-temp' + (count ? ' path-hidden-verts' : ''),
                                id: node1 + '-' + node2 + 'path=' + i,
                                data: {
                                    source: node1,
                                    target: node2,
                                    pathColor: end,
                                    label: count === 0 ? '' :
                                        i18n('graph.path.edge.label.' + (
                                            count === 1 ? 'one' : 'some'
                                        ), F.number.pretty(count))
                                }
                            });
                        }
                    };

                    var count = 0;
                    var lastNode = path[0];

                    nodeIds.forEach(nodeId => {
                        if (nodeId in nodesById && nodeId !== lastNode) {
                            existingOrNewEdgeBetween(lastNode, nodeId, count);
                            lastNode = nodeId;
                            count = 0;
                        } else count++;
                    });

                    if (nodesById[targetId]) {
                        existingOrNewEdgeBetween(lastNode, path[(path.length - 1)], count);
                    }
                });
            }
        },

        updatePathStyles(oldPaths, newPaths) {
            const cy = this.state.cy;
            const updateStyles = (paths, enabled = true) => {
                const pathNodeIds = _.uniq(_.flatten(paths));

                pathNodeIds.forEach(id => {
                    const cyNode = cy.getElementById(id);

                    if (enabled) {
                        cyNode.style({
                            'display': 'element',
                            'opacity': 1
                        });
                    } else {
                        cyNode.removeStyle('display opacity');
                    }
                });
            };

            if (oldPaths) {
                updateStyles(oldPaths.renderedPaths, false);
            }

            if (newPaths) {
                updateStyles(newPaths.renderedPaths);
                cy.$('.path-edge').forEach(cyEdge => cyEdge.style({
                    'display': 'element',
                    'opacity': 1,
                    'line-color': cyEdge.data('pathColor'),
                    'source-arrow-color': cyEdge.data('pathColor'),
                    'target-arrow-color': cyEdge.data('pathColor')
                }));
            }
        },

        drawEdgeToMouseFrom(newData) {
            const { drawEdgeToMouseFrom } = this.props;
            const { cy } = this.state;

            if (drawEdgeToMouseFrom) {
                const { left, top } = this.clientRect;
                const { vertexId, toVertexId } = drawEdgeToMouseFrom;
                const position = toVertexId ?
                    { position: cy.getElementById(toVertexId).position() } :
                    {
                        renderedPosition: {
                            x: window.lastMousePositionX - left,
                            y: window.lastMousePositionY - top
                        }
                    };
                const nodeIndex = newData.elements.nodes.findIndex((node) => node.data.id === DrawEdgeNodeId);

                if (nodeIndex > -1) {
                    newData.elements.nodes[nodeIndex] = {
                        ...newData.elements.nodes[nodeIndex],
                        ...position
                    };
                } else {
                    newData.elements.nodes.push({
                        data: { id: DrawEdgeNodeId },
                        classes: 'drawEdgeToMouse',
                        ...position
                    })
                    newData.elements.edges.push({
                        data: {
                            source: vertexId,
                            target: DrawEdgeNodeId,
                        },
                        classes: 'drawEdgeToMouse'
                    })
                }
            }
        },

        /**
         * Graph work product toolbar item component
         *
         * @typedef org.bigconnect.product.toolbar.item~GraphComponent
         * @property {object} product The graph product
         * @property {object} cy The cytoscape instance
         * @property {function} requestUpdate Request the product should update. This is not guaranteed
         * to happen in the very next cycle. The product will group updates together for performance.
         */
        getInjectedToolProps() {
            const { cy } = this.state;
            const { product, requestUpdate } = this.props;
            let props = {};

            if (cy) {
                props = { product, cy, requestUpdate };
            }

            return props;
        },

        drawControlDragSelection(newData) {
            const { controlDragSelection } = this.state;
            const select = (node) => {
                if (node.data.id === controlDragSelection) {
                    node.classes += ' controlDragSelection';
                } else {
                    node.classes = node.classes.replace(/controlDragSelection/g, '');
                }
            };

            newData.elements.nodes.forEach((node) => select(node));
        }
    })

    return Cytoscape;

    function calculatePosition(padding, alignment, decorationNode, specs) {
        const paddingX = padding && ('x' in padding) ? padding.x : 8;
        const paddingY = padding && ('y' in padding) ? padding.y : 8;

        if (alignment) {
            var x, y,
                decBBox = decorationNode ?
                    decorationNode.boundingBox({ includeLabels: false }) :
                    { w: 0, h: 0 },
                decBBoxLabels = decorationNode ?
                    decorationNode.boundingBox({ includeLabels: true }) :
                    { w: 0, h: 0 };

            switch (alignment.h) {
                case 'center':
                    x = specs.position.x;
                    break;

                case 'right':
                    if (specs.textVAlign === alignment.v && specs.textVAlign === 'center' && specs.textHAlign === alignment.h) {
                        x = specs.position.x - specs.w / 2 + specs.bboxLabels.w + decBBoxLabels.w / 2
                    } else if (specs.textVAlign === alignment.v &&
                        (specs.textVAlign !== 'center' || specs.textHAlign === alignment.h || specs.textHAlign === 'center')) {
                        x = specs.position.x + specs.bboxLabels.w / 2 + decBBoxLabels.w / 2
                    } else {
                        x = specs.position.x + specs.w / 2 + decBBox.w / 2;
                    }
                    x += paddingX
                    break;

                case 'left':
                default:
                    if (specs.textVAlign === alignment.v && specs.textVAlign === 'center' && specs.textHAlign === alignment.h) {
                        x = specs.position.x + specs.w / 2 - specs.bboxLabels.w - decBBoxLabels.w / 2
                    } else if (specs.textVAlign === alignment.v &&
                        (specs.textVAlign !== 'center' || specs.textHAlign === alignment.h || specs.textHAlign === 'center')) {
                        x = specs.position.x - specs.bboxLabels.w / 2 - decBBoxLabels.w / 2
                    } else {
                        x = specs.position.x - specs.w / 2 - decBBox.w / 2;
                    }
                    x -= paddingX
            }
            switch (alignment.v) {
                case 'center':
                    y = specs.position.y;
                    break;

                case 'bottom':
                    if (specs.textVAlign === alignment.v && alignment.h === 'center') {
                        y = specs.position.y - specs.h / 2 + specs.bboxLabels.h + decBBoxLabels.h / 2 + paddingY;
                    } else if (specs.textVAlign === alignment.v) {
                        y = specs.position.y + specs.h / 2 + (specs.bboxLabels.h - specs.h) / 2;
                    } else {
                        y = specs.position.y + specs.h / 2 + decBBoxLabels.h / 2 + paddingY;
                    }
                    break;

                case 'top':
                default:
                    if (specs.textVAlign === alignment.v && alignment.h === 'center') {
                        y = specs.position.y + specs.h / 2 - specs.bboxLabels.h - decBBoxLabels.h / 2 - paddingY;
                    } else if (specs.textVAlign === alignment.v) {
                        y = specs.position.y - specs.h / 2 - (specs.bboxLabels.h - specs.h) / 2;
                    } else {
                        y = specs.position.y - specs.h / 2 - decBBoxLabels.h / 2 - paddingY
                    }
            }

            return { x: x, y: y };
        }
        throw new Error('Alignment required', alignment);
    }

    function specsForNode(node, position) {
        return {
            position: position || node.position(),
            textHAlign: node.style('text-halign'),
            textVAlign: node.style('text-valign'),
            h: node.height(),
            w: node.width(),
            bbox: node.boundingBox({includeNodes: true, includeLabels: false}),
            bboxLabels: node.boundingBox({includeNodes: true, includeLabels: true})
        }
    }
})
