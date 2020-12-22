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
    'prop-types',
    'create-react-class',
    'react-virtualized',
    './SortableList',
    './MapLayerItem'
], function(
    PropTypes,
    createReactClass,
    { AutoSizer },
    SortableList,
    MapLayerItem) {

    const ROW_HEIGHT = 40;
    const SORT_DISTANCE_THRESHOLD = 10;

    const MapLayersList = ({ baseLayer, layers, editable, onOrderLayer, ...itemProps }) => (
        <div className="layer-list">
            {(baseLayer || layers.values) ?
                <div className="layers">
                    <div className="flex-fix">
                        <AutoSizer>
                            {({ width, height }) => ([
                                <SortableList
                                    ref={(instance) => { this.SortableList = instance; }}
                                    key={'sortable-items'}
                                    items={layers}
                                    shouldCancelStart={() => !editable}
                                    onSortStart={() => {
                                        this.SortableList.container.classList.add('sorting')
                                    }}
                                    onSortEnd={({ oldIndex, newIndex }) => {
                                        this.SortableList.container.classList.remove('sorting');

                                        if (oldIndex !== newIndex) {
                                            onOrderLayer(oldIndex, newIndex);
                                        }
                                    }}
                                    rowRenderer={mapLayerItemRenderer({ editable, ...itemProps })}
                                    rowHeight={ROW_HEIGHT}
                                    lockAxis={'y'}
                                    lockToContainerEdges={true}
                                    helperClass={'sorting'}
                                    distance={SORT_DISTANCE_THRESHOLD}
                                    width={width}
                                    height={(height - (ROW_HEIGHT + 1))}
                                />,
                                <SortableList
                                    key={'non-sortable-items'}
                                    className="unsortable"
                                    items={[ baseLayer ]}
                                    shouldCancelStart={() => true}
                                    rowRenderer={mapLayerItemRenderer({ editable, ...itemProps })}
                                    rowHeight={ROW_HEIGHT}
                                    width={width}
                                    height={ROW_HEIGHT}
                                />
                            ])}
                        </AutoSizer>
                    </div>
                </div>
            :
                <div className="empty">
                    <p>{ i18n('org.bigconnect.web.product.map.MapWorkProduct.layers.empty') }</p>
                </div>
            }
        </div>
    );

    MapLayersList.propTypes = {
        baseLayer: PropTypes.object,
        layers: PropTypes.array.isRequired,
        editable: PropTypes.bool,
        onOrderLayer: PropTypes.func.isRequired
    };

    const mapLayerItemRenderer = (itemProps) => (listProps) => {
        const { editable, ...rest } = itemProps;
        const { index, style, key, value: { config, layer }} = listProps;

        return (
            <MapLayerItem
                key={key}
                index={index}
                layer={layer}
                config={config}
                extension={'layer'}
                style={style}
                toggleable={editable}
                {...rest}
            />
        )
    };

    return MapLayersList;
});
