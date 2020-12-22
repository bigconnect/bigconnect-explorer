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
    './OpenLayers',
    './clusterHover',
    './util/layerHelpers',
    'configuration/plugins/registry',
    'components/RegistryInjectorHOC',
    'util/vertex/formatters',
    'util/deepObjectCache',
    'util/mapConfig',
    './util/cache'
], function(
    createReactClass,
    PropTypes,
    OpenLayers,
    clusterHover,
    layerHelpers,
    registry,
    RegistryInjectorHOC,
    F,
    DeepObjectCache,
    mapConfig,
    clusterCache) {
    'use strict';

    const iconAnchor = [0.5, 1.0];
    const getIconSize = _.memoize(ratio => [22, 40].map(v => v * ratio));

    /**
     * @deprecated Use {@link org.bigconnect.product.toolbar.item} instead
     */
    registry.documentExtensionPoint('org.bigconnect.map.options',
        'Add components to the map options toolbar',
        function(e) {
            return ('identifier' in e) && ('optionComponentPath' in e);
        },
        'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/map-options'
    );

    registry.markUndocumentedExtensionPoint('org.bigconnect.map.style');

    registry.markUndocumentedExtensionPoint('org.bigconnect.map.geometry');

    registry.markUndocumentedExtensionPoint('org.bigconnect.map.layer');

    const REQUEST_UPDATE_DEBOUNCE = 300;
    const GEOSHAPE_MIMETYPES = [
        'application/vnd.geo+json',
        'application/vnd.google-earth.kml+xml'
    ];

    const Map = createReactClass({

        propTypes: {
            configProperties: PropTypes.object.isRequired,
            onUpdateViewport: PropTypes.func.isRequired,
            onSelectElements: PropTypes.func.isRequired,
            onVertexMenu: PropTypes.func.isRequired,
            elements: PropTypes.shape({ vertices: PropTypes.object, edges: PropTypes.object })
        },

        getInitialState() {
            return { viewport: this.props.viewport, generatePreview: true }
        },

        shouldComponentUpdate(nextProps) {
            const onlyViewportChanged = Object.keys(nextProps).every(key => {
                if (key === 'viewport') {
                    return true;
                }
                return this.props[key] === nextProps[key];
            })

            if (onlyViewportChanged) {
                return false;
            }
            return true;
        },

        componentWillMount() {
            this.caches = {
                styles: {
                    canHandle: new DeepObjectCache(),
                    style: new DeepObjectCache(),
                    selectedStyle: new DeepObjectCache()
                },
                geometries: {
                    canHandle: new DeepObjectCache(),
                    geometry: new DeepObjectCache()
                }
            };
            this.requestUpdateDebounce = _.debounce(this.clearCaches, REQUEST_UPDATE_DEBOUNCE)
        },

        componentDidMount() {
            this.mounted = true;

            $(this.wrap).on('selectAll', (event) => {
                this.props.onSelectAll(this.props.product.id);
            })
            $(document).on('elementsCut.org-bigconnect-map', (event, { vertexIds }) => {
                this.props.onRemoveElementIds({ vertexIds, edgeIds: [] });
            })
            $(document).on('elementsPasted.org-bigconnect-map', (event, elementIds) => {
                this.props.onDropElementIds(elementIds)
            })

            this.saveViewportDebounce = _.debounce(this.saveViewport, 250);

            this.legacyListeners({
                fileImportSuccess: { node: $('.products-full-pane.visible')[0], handler: (event, { vertexIds }) => {
                    this.props.onDropElementIds({vertexIds});
                }}
            })
        },

        componentWillUnmount() {
            this.mounted = false;
            this.removeEvents.forEach(({ node, func, events }) => {
                $(node).off(events, func);
            });

            $(this.wrap).off('selectAll');
            $(document).off('.org-bigconnect-map');
            this.saveViewport(this.props)
        },

        componentWillReceiveProps(nextProps) {
            if (nextProps.product.id === this.props.product.id) {
                this.setState({ viewport: {}, generatePreview: false })
            } else {
                this.saveViewport(this.props)
                this.setState({ viewport: nextProps.viewport || {}, generatePreview: true })
            }
        },

        render() {
            const { viewport, generatePreview } = this.state;
            const { product, registry, panelPadding, focused, layerConfig, setLayerOrder, onAddSelection, onSelectElements } = this.props;
            const { source: baseSource, sourceOptions: baseSourceOptions, ...config } = mapConfig();
            const layerExtensions = _.indexBy(registry['org.bigconnect.map.layer'], 'id');

            return (
                <div className="org-bigconnect-map" style={{height:'100%', marginTop: '2px'}} ref={r => {this.wrap = r}}>
                    <OpenLayers
                        ref={c => {this._openlayers = c}}
                        product={product}
                        focused={focused}
                        baseSource={baseSource}
                        baseSourceOptions={baseSourceOptions}
                        sourcesByLayerId={this.mapElementsToSources()}
                        layerExtensions={layerExtensions}
                        layerConfig={layerConfig}
                        viewport={viewport}
                        generatePreview={generatePreview}
                        panelPadding={panelPadding}
                        clearCaches={this.requestUpdateDebounce}
                        setLayerOrder={setLayerOrder}
                        onTap={this.onTap}
                        onPan={this.onViewport}
                        onZoom={this.onViewport}
                        onContextTap={this.onContextTap}
                        onAddSelection={onAddSelection}
                        onSelectElements={onSelectElements}
                        onMouseOver={this.onMouseOver}
                        onMouseOut={this.onMouseOut}
                        onUpdatePreview={this.onUpdatePreview}
                        {...config}
                    />
                </div>
            )
        },

        onTap({map, pixel}) {
            if (!map.hasFeatureAtPixel(pixel)) {
                this.props.onClearSelection();
            }
        },

        onMouseOver(ol, map, features) {
            const cluster = features && features[0];
            const coordinates = cluster && cluster.get('coordinates');
            if (coordinates && coordinates.length > 1) {
                clusterHover.show(ol, map, cluster, layerHelpers.styles.feature)
            }
        },

        onMouseOut(ol, map, features) {
            clusterHover.hide(ol, map);
        },

        onContextTap(ol, { map, pixel, originalEvent }) {
            clusterHover.hide(ol, map);

            const productVertices = this.props.product.extendedData.vertices;
            const featuresAtPixel = map.getFeaturesAtPixel(pixel);
            const isValidVertex = (element) => {
                const isAncillary = element && productVertices[element.id] && productVertices[element.id].ancillary;
                return element && element.type === 'vertex' && !isAncillary
            }
            let vertexId;

            if (featuresAtPixel && featuresAtPixel.length) {
                const target = featuresAtPixel[0];
                const element = target.get('element');

                if (isValidVertex(element)) {
                    vertexId = element.id;
                } else {
                    const clusteredFeatures = target.get('features') || [];
                    const clusteredFeature = clusteredFeatures.find(f => {
                        const element = f.get('element');
                        return isValidVertex(element);
                    });
                    vertexId = clusteredFeature && clusteredFeature.get('element').id;
                }
            }

            if (vertexId) {
                const { pageX, pageY } = originalEvent;
                this.props.onVertexMenu(
                    originalEvent.target,
                    vertexId,
                    { x: pageX, y: pageY }
                );
            }
        },

        onUpdatePreview() {
            const { onUpdatePreview, product } = this.props;

            onUpdatePreview(product.id);
        },

        onViewport(event) {
            const { product: { id: productId } } = this.props;
            const view = event.target;
            const zoom = view.getZoom();
            const pan = [...view.getCenter()];

            if (!this.currentViewport) {
                this.currentViewport = {};
            }
            this.currentViewport[productId] = { zoom, pan };

            this.saveViewportDebounce(this.props);
        },

        saveViewport(props) {
            if (this.mounted) {
                var productId = props.product.id;
                if (this.currentViewport && productId in this.currentViewport) {
                    var viewport = this.currentViewport[productId];
                    props.onUpdateViewport(productId, viewport);
                }
            }
        },

        getGeometry(edgeInfo, element, ontology) {
            const { registry } = this.props;
            const calculatedGeometry = registry['org.bigconnect.map.geometry']
                .reduce((geometries, { canHandle, geometry, layer }) => {
                    /**
                     * Decide which elements to apply geometry
                     *
                     * @function org.bigconnect.map.geometry~canHandle
                     * @param {object} productEdgeInfo The edge info from product->vertex
                     * @param {object} element The element
                     * @param {Array.<object>} element.properties The element properties
                     * @param {object} ontology The ontology object for this element (concept/relationship)
                     * @returns {boolean} True if extension should handle this element (style/selectedStyle functions will be invoked.)
                     */
                    if (this.caches.geometries.canHandle.getOrUpdate(canHandle, edgeInfo, element, ontology)) {

                        /**
                         * Return an OpenLayers [`ol.geom.Geometry`](http://openlayers.org/en/latest/apidoc/ol.geom.Geometry.html)
                         * object for the given element.
                         *
                         * @function org.bigconnect.map.geometry~geometry
                         * @param {object} productEdgeInfo The edge info from product->vertex
                         * @param {object} element The element
                         * @param {Array.<object>} element.properties The element properties
                         * @param {object} ontology The ontology element (concept / relationship)
                         * @returns {ol.geom.Geometry}
                         */
                        const geo = this.caches.geometries.geometry.getOrUpdate(geometry, edgeInfo, element, ontology)
                        if (geo) {
                            /**
                             * Provide a layer configuration object to specify which layer this geometry should be placed on
                             *
                             * @typedef org.bigconnect.map.geometry~layer
                             * @property {string} id The id of the layer
                             * @property {string} type The type of layer
                             *
                             */
                            geometries.push({
                                geometry: geo,
                                layer
                            });
                        }
                    }
                    return geometries
                }, [])

            if (calculatedGeometry.length) {
                if (calculatedGeometry.length > 1) {
                    console.warn('Multiple geometry extensions applying to element, ignoring others', calculatedGeometry.slice(1))
                }
                return calculatedGeometry[0]
            }
        },

        getStyles(edgeInfo, element, ontology) {
            const { registry } = this.props;
            const calculatedStyles = registry['org.bigconnect.map.style']
                .reduce((styles, { canHandle, style, selectedStyle }) => {

                    /**
                     * Decide which elements to apply style
                     *
                     * @function org.bigconnect.map.style~canHandle
                     * @param {object} productEdgeInfo The edge info from product->vertex
                     * @param {object} element The element
                     * @param {Array.<object>} element.properties The element properties
                     * @param {object} ontology The ontology object for this element (concept/relationship)
                     * @returns {boolean} True if extension should handle this element (style/selectedStyle functions will be invoked.)
                     */
                    if (this.caches.styles.canHandle.getOrUpdate(canHandle, edgeInfo, element, ontology)) {
                        if (style) {
                            /**
                             * Return an OpenLayers [`ol.style.Style`](http://openlayers.org/en/latest/apidoc/ol.style.Style.html)
                             * object for the given element.
                             *
                             * @function org.bigconnect.map.style~style
                             * @param {object} productEdgeInfo The edge info from product->vertex
                             * @param {object} element The element
                             * @param {Array.<object>} element.properties The element properties
                             * @returns {ol.style.Style}
                             */
                            const normalStyle = this.caches.styles.style.getOrUpdate(style, edgeInfo, element, ontology)
                            if (normalStyle) {
                                if (_.isArray(normalStyle)) {
                                    if (normalStyle.length) styles.normal.push(...normalStyle)
                                } else {
                                    styles.normal.push(normalStyle)
                                }
                            }
                        }

                        if (selectedStyle) {
                            const output = this.caches.styles.selectedStyle.getOrUpdate(selectedStyle, edgeInfo, element, ontology)
                            if (output) {
                                if (_.isArray(output)) {
                                    if (output.length) styles.selected.push(...output)
                                } else {
                                    styles.selected.push(output)
                                }
                            }
                        }
                    }
                    return styles;
                }, { normal: [], selected: []})

            if (calculatedStyles.normal.length || calculatedStyles.selected.length) {
                return calculatedStyles;
            }
        },

        mapElementsToSources() {
            const { product, workspaceId } = this.props;
            const { extendedData } = product;
            if (!extendedData || !extendedData.vertices) return [];
            const { vertices, edges } = this.props.elements;
            const elementsSelectedById = { ..._.indexBy(this.props.selection.vertices), ..._.indexBy(this.props.selection.edges) };
            const elements = Object.values(vertices).concat(Object.values(edges));
            const geoLocationProperties = _.groupBy(this.props.ontologyProperties, 'dataType').geoLocation;
            const addOrUpdateSource = ({ id, ...rest }, feature) => {
                if (!sources[id]) {
                    sources[id] = { features: [], ...rest };
                } else if (!sources[id].features) {
                    sources[id].features = [];
                }

                sources[id].features.push(feature);
            };
            const sources = {
                cluster: {
                    id: 'cluster',
                    type: 'cluster',
                    features: []
                }
            };

            elements.forEach(el => {
                const extendedDataType = extendedData[el.type === 'vertex' ? 'vertices' : 'edges'];
                const edgeInfo = extendedDataType[el.id];
                const ontology = F.vertex.ontology(el);
                const styles = this.getStyles(edgeInfo, el, ontology);
                const geometryOverride = this.getGeometry(edgeInfo, el, ontology)
                const geometry = geometryOverride && geometryOverride.geometry;
                const layer = geometryOverride && geometryOverride.layer || {};
                const selected = el.id in elementsSelectedById;

                if (extendedData.vertices[el.id] && extendedData.vertices[el.id].ancillary) {
                    addOrUpdateSource({ id: 'ancillary', type: 'ancillary', ...layer }, {
                        id: el.id,
                        element: el,
                        selected,
                        styles,
                        geometry
                    });

                    return;
                }

                if (F.vertex.displayType(el) === 'document') {
                    const mimeType = F.vertex.prop(el, ONTOLOGY_CONSTANTS.PROP_MIME_TYPE);

                    if (GEOSHAPE_MIMETYPES.includes(mimeType)) {
                        const rawProp = F.vertex.props(el, ONTOLOGY_CONSTANTS.PROP_RAW)[0];
                        addOrUpdateSource({
                            id: el.id,
                            element: el,
                            type: 'vectorXhr',
                            mimeType,
                            propName: rawProp.name,
                            propKey: rawProp.key,
                            selected,
                            styles
                        });
                    }
                }

                const geoLocations = geoLocationProperties && geoLocationProperties.reduce((props, { title }) => {
                        const geoProps = F.vertex.props(el, title);
                        geoProps.forEach(geoProp => {
                            const { value } = geoProp;
                            if (value) {
                                const { latitude, longitude } = value;
                                if (!isNaN(latitude) && !isNaN(longitude)) {
                                    const validCoordinates = (latitude >= -90 && latitude <= 90) && (longitude >= -180 && longitude <= 180);
                                    if (validCoordinates) {
                                        props.push([longitude, latitude])
                                    } else {
                                        console.warn('Vertex has geoLocation with invalid coordinates', value, el)
                                    }
                                }
                            }
                        })
                        return props;
                    }, []),
                    iconUrl = 'map/marker/image?' + $.param({
                        type: el.conceptType,
                        workspaceId: this.props.workspaceId,
                        scale: this.props.pixelRatio > 1 ? '2' : '1',
                    }),
                    iconUrlSelected = `${iconUrl}&selected=true`;

                if (geoLocations.length) {
                    addOrUpdateSource({ id: 'cluster', ...layer }, {
                        id: el.id,
                        element: el,
                        selected,
                        iconUrl,
                        iconUrlSelected,
                        iconSize: getIconSize(this.props.pixelRatio),
                        iconAnchor,
                        pixelRatio: this.props.pixelRatio,
                        styles,
                        geometry,
                        geoLocations
                    });
                }
            })

            return sources;
        },

        legacyListeners(map) {
            this.removeEvents = [];

            _.each(map, (handler, events) => {
                var node = this.wrap;
                var func = handler;
                if (!_.isFunction(handler)) {
                    node = handler.node;
                    func = handler.handler;
                }
                this.removeEvents.push({ node, func, events });
                $(node).on(events, func);
            })
        },

        clearCaches() {
            clusterCache.clear();

            if (this.mounted) {
                Object.keys(this.caches).forEach(k => {
                    Object.keys(this.caches[k]).forEach(key => this.caches[k][key].clear())
                })
                this.forceUpdate();
            }
        }
    });

    return RegistryInjectorHOC(Map, [
        'org.bigconnect.map.style',
        'org.bigconnect.map.geometry',
        'org.bigconnect.map.layer'
    ])
});
