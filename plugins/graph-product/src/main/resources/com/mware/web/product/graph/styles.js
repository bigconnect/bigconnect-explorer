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
define([], function() {

    // For performace switch to non-bezier edges after this many
    const MaxEdgesBeforeHayStackOptimization = 250;

    const GENERIC_SIZE = 30;
    const CUSTOM_IMAGE_SIZE = 50;
    const IMAGE_ASPECT_RATIO = 4 / 3;
    const VIDEO_ASPECT_RATIO = 19 / 9;

    return function(pixelRatio, edgesCount, edgeLabels, nodeLabels, nodeImages, styleExtensions) {
        const OVERLAY_COLOR = '#0088cc';
        const OVERLAY_OPACITY = 0.2;
        const OVERLAY_DIM_OPACITY = 0.25;
        const OVERLAY_NODE_PADDING = 5 * pixelRatio;
        const OVERLAY_EDGE_PADDING = function(node) {
            const data = node && node.length && node.length && node[0]._private;
            const style = data && data.style;
            if (style) {
                const width = style.width;
                if (width) {
                    return width.value / 2 + OVERLAY_NODE_PADDING;
                }
            }
            return OVERLAY_NODE_PADDING;
        }

        return getDefaultStyles().concat(getExtensionStyles(), getSelectionStyles());

        function getExtensionStyles() {
            // Mock the cytoscape style fn api to the json style
            const collector = styleCollector();

            /**
             * @callback org.bigconnect.graph.style~StyleFn
             * @param {object} cytoscapeStyle
             * @param {function} cytoscapeStyle.selector Switch to adjusting the passed in selector string
             * @param {function} cytoscapeStyle.style Add styles to the current selector. Accepts one parameter,
             * the `object` of styles to add
             * @param {function} cytoscapeStyle.css Alias of `style`
             */
            styleExtensions.forEach(fn => fn(collector.mock));
            return collector.styles;

            function styleCollector() {
                const styles = {};
                var currentSelector;
                const add = (obj) => {
                    if (!currentSelector) throw new Error('No selector found for style: ' + obj)
                    styles[currentSelector] = obj;
                    return api.mock;
                }
                const api = {
                    mock: {
                        selector: (str) => {
                            currentSelector = str;
                            return api.mock;
                        },
                        style: add,
                        css: add
                    },
                    get styles() {
                        return _.map(styles, (style, selector) => ({ selector, style }))
                    }
                }
                return api;
            }
        }

        function getSelectionStyles() {
            return [
                {
                    selector: '.c:selected,.v:selected,.partial:selected',
                    css: {
                        'display': 'element',
                        'opacity': 1,
                        'background-image-opacity': 1,
                        'overlay-color': OVERLAY_COLOR,
                        'overlay-opacity': OVERLAY_OPACITY,
                        'overlay-padding': OVERLAY_NODE_PADDING
                    }
                },
                {
                    selector: '.e:selected',
                    css: {
                        'display': 'element',
                        'opacity': 1,
                        'overlay-color': OVERLAY_COLOR,
                        'overlay-opacity': OVERLAY_OPACITY,
                        'overlay-padding': OVERLAY_EDGE_PADDING
                    }
                },
                {
                    selector: '*.focus',
                    css: {
                        'display': 'element',
                        'opacity': 1,
                        'background-image-opacity': 1,
                        'color': OVERLAY_COLOR,
                        'font-weight': 'bold',
                        'overlay-color': OVERLAY_COLOR,
                        'overlay-padding': 7 * pixelRatio,
                        'overlay-opacity': 0.4
                    }
                },
                {
                    selector: '*.focus-dim',
                    css: {
                        'display': 'element',
                        'opacity'(node) {
                            const currentOpacity = node.style('opacity');
                            if (currentOpacity < 1) {
                                return Math.min(currentOpacity, OVERLAY_DIM_OPACITY);
                }

                            return OVERLAY_DIM_OPACITY;
                        }
                    }
                },
                {
                    selector: '*.dec-focus-dim .decoration',
                    css: {
                        opacity: OVERLAY_DIM_OPACITY
                    }
                },
                {
                    selector: '*.focus-dim:selected',
                    css: {
                        'overlay-opacity': 0.05
                    }
                }
            ];
        }

        function getDefaultStyles() {
            return [
                {
                    selector: 'core',
                    css: {
                        'outside-texture-bg-color': '#efefef'
                    }
                },
                {
                    selector: 'node',
                    css: {
                        "background-repeat": "no-repeat",
                        "background-width-relative-to": "inner",
                        "background-height-relative-to": "inner",

                        'background-width': '50%',
                        'background-height': '50%',

                        'border-color': '#232323',
                        'border-width': '1px',
                        'border-style': 'solid',
                        'background-image-crossorigin': 'use-credentials',
                        'font-family': 'Roboto',
                        'font-size': 12 * pixelRatio,
                        'min-zoomed-font-size': 4,
                        'text-events': 'yes',
                        'text-outline-color': 'white',
                        'text-outline-width': 2,
                        'text-halign': 'center',
                        'text-valign': 'bottom',
                        'text-max-width': 200 * pixelRatio,
                        'text-wrap': 'ellipsis',
                        content: 'Loading…',
                        opacity: 1,
                        color: '#232323',
                        height: GENERIC_SIZE * pixelRatio,
                        shape: 'ellipse',
                        width: GENERIC_SIZE * pixelRatio
                    }
                },
                {
                    selector: 'node.ancillary',
                    css: {
                        'background-color': '#fff',
                        'background-fit': 'contain',
                        'border-color': 'white',
                        'background-image-crossorigin': 'use-credentials',
                        'font-family': 'helvetica',
                        'font-size': 18 * pixelRatio,
                        'min-zoomed-font-size': 4,
                        'text-events': 'yes',
                        'text-outline-color': 'transparent',
                        'text-outline-width': 0,
                        'text-halign': 'center',
                        'text-valign': 'center',
                        content: '',
                        opacity: 1,
                        color: '#333',
                        height: GENERIC_SIZE * pixelRatio,
                        shape: 'rectangle',
                        width: GENERIC_SIZE * pixelRatio
                    }
                },
                {
                    selector: 'node.ancillary.unhandled',
                    css: {
                        display: 'none'
                    }
                },
                {
                    selector: 'node.drawEdgeToMouse',
                    css: {
                        'background-opacity': 0,
                        'text-events': 'no',
                        width: GENERIC_SIZE * pixelRatio,
                        height: GENERIC_SIZE * pixelRatio,
                        shape: 'ellipse',
                        content: '',
                        events: 'no'
                    }
                },
                {
                    selector: 'node.v',
                    css: {
                        'background-color': nodeImages ? '#fff' : 'data(conceptColor)',
                        'background-image': nodeImages ? 'data(imageSrc)' : 'none',
                        'border-color': 'data(conceptColor)',
                        content: nodeLabels ? 'data(title)' : '',
                    }
                },
                {
                    selector: 'node.c',
                    css: {
                        'background-color': '#aaa',
                        'background-image': 'data(imageSrc)',
                        shape: 'rectangle',
                        content: 'data(title)',
                    }
                },
                {
                    selector: 'node.fullTitle',
                    css: {
                        'text-wrap': 'wrap',
                        'text-max-width': 300 * pixelRatio
                    }
                },
                {
                    selector: 'node.decorationParent',
                    css: {
                        'background-image': 'none',
                        'background-color': 'transparent',
                        'background-opacity': 0,
                        'compound-sizing-wrt-labels': 'exclude',
                        content: ''
                    }
                },
                {
                    selector: 'node.decorationParent:active',
                    css: {
                        'background-color': 'transparent',
                        'background-opacity': 0,
                        'overlay-color': 'transparent',
                        'overlay-padding': 0,
                        'overlay-opacity': 0,
                        'border-width': 0
                    }
                },
                {
                    selector: 'node.decoration',
                    css: {
                        'background-color': '#F89406',
                        'background-image': 'none',
                        'border-width': 2,
                        'border-style': 'solid',
                        'border-color': '#EF8E06',
                        'text-halign': 'center',
                        'text-valign': 'center',
                        'font-size': 20,
                        color: 'white',
                        'text-outline-color': 'transparent',
                        'text-outline-width': 0,
                        content: 'data(label)',
                        events: 'no',
                        shape: 'roundrectangle',
                        'padding-left': 5,
                        'padding-right': 5,
                        'padding-top': 3,
                        'padding-bottom': 3,
                        width: 'label',
                        height: 'label',
                        'z-index': 1
                    }
                },
                {
                    selector: 'node.decoration.hidden',
                    css: {
                        display: 'none'
                    }
                },
                {
                    selector: 'node.video',
                    css: {
                        shape: 'rectangle',
                        width: (CUSTOM_IMAGE_SIZE * pixelRatio) * VIDEO_ASPECT_RATIO,
                        height: (CUSTOM_IMAGE_SIZE * pixelRatio) / VIDEO_ASPECT_RATIO
                    }
                },
                {
                    selector: 'node.image',
                    css: {
                        shape: 'rectangle',
                        width: (CUSTOM_IMAGE_SIZE * pixelRatio) * IMAGE_ASPECT_RATIO,
                        height: (CUSTOM_IMAGE_SIZE * pixelRatio) / IMAGE_ASPECT_RATIO
                    }
                },
                {
                    selector: 'node.hasCustomGlyph',
                    css: {
                        width: CUSTOM_IMAGE_SIZE * pixelRatio,
                        height: CUSTOM_IMAGE_SIZE * pixelRatio
                    }
                },
                {
                    selector: 'node.hover',
                    css: {
                        opacity: 0.6
                    }
                },
                {
                    selector: 'node.temp',
                    css: {
                        'background-color': 'rgba(255,255,255,0.0)',
                        'background-image': 'none',
                        width: '1',
                        height: '1'
                    }
                },
                {
                    selector: 'node.controlDragSelection',
                    css: {
                        'border-width': 5 * pixelRatio,
                        'border-color': '#a5e1ff'
                    }
                },
                {
                    selector: 'edge',
                    css: {
                        'font-size': 10 * pixelRatio,
                        'target-arrow-shape': 'triangle',
                        color: 'data(edgeColor)',
                        'line-color': 'data(edgeColor)',
                        content: edgeLabels ? 'data(label)' : '',
                        'curve-style': edgesCount > MaxEdgesBeforeHayStackOptimization ? 'haystack' : 'bezier',
                        'min-zoomed-font-size': 3,
                        'text-outline-color': 'white',
                        'text-outline-width': 2,
                        width: 2 * pixelRatio
                    }
                },
                {
                    selector: 'edge.label',
                    css: {
                        content: 'data(label)',
                        'font-size': 12 * pixelRatio,
                        color: '#232323',
                        'text-outline-color': 'white',
                        'text-outline-width': 4
                    }
                },
                {
                    selector: 'edge.drawEdgeToMouse',
                    css: {
                        events: 'no',
                        width: 4,
                        'line-color': '#0088cc',
                        'line-style': 'dotted',
                        'target-arrow-color': '#0088cc'
                    }
                },
                {
                    selector: 'edge.path-hidden-verts',
                    css: {
                        'line-style': 'dashed',
                        content: 'data(label)',
                        'font-size': 16 * pixelRatio,
                        color: 'data(pathColor)',
                        'text-outline-color': 'white',
                        'text-outline-width': 4,
                        'overlay-color': 'data(pathColor)',
                        'overlay-opacity': OVERLAY_OPACITY,
                        'overlay-padding': OVERLAY_EDGE_PADDING
                    }
                },
                {
                    selector: 'edge.path-edge',
                    css: {
                        'overlay-color': 'data(pathColor)',
                        'overlay-opacity': OVERLAY_OPACITY,
                        'overlay-padding': OVERLAY_EDGE_PADDING
                    }
                },
                {
                    selector: 'edge.temp',
                    css: {
                        width: 4,
                        'line-color': '#0088cc',
                        'line-style': 'dotted',
                        'target-arrow-color': '#0088cc',
                        'overlay-color': '#0088cc',
                        'overlay-opacity': OVERLAY_OPACITY,
                        'overlay-padding': OVERLAY_EDGE_PADDING
                    }
                }
            ];
        }
    }
})
