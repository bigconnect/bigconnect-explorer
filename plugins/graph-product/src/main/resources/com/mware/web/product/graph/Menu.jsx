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
    'util/withContextMenu',
    'util/formatters',
    'cytoscape',
    'components/RegistryInjectorHOC'
], function(createReactClass, PropTypes, withContextMenu, F, cytoscape, RegistryInjectorHOC) {
    'use strict';

    const EXTENSION_EXPORT = 'org.bigconnect.graph.export';
    const EXTENSION_SELECT = 'org.bigconnect.graph.selection';
    const EXTENSION_LAYOUT = 'org.bigconnect.graph.layout';

    const Menu = createReactClass({
        propTypes: {
            event: PropTypes.shape({
                originalEvent: PropTypes.shape({
                    pageX: PropTypes.number,
                    pageY: PropTypes.number
                })
            }),
            editable: PropTypes.bool
        },
        componentDidMount() {
            const menu = this.refs.menu;
            const mixin = new withContextMenu();
            mixin.$node = $(menu).parent();
            mixin.node = mixin.$node[0];
            mixin.bindContextMenuClickEvent = function() { };
            mixin.toggleMenu({ positionUsingEvent: this.props.event }, $(this.refs.dropdownMenu));
            this.mixin = mixin;
        },
        componentWillReceiveProps(nextProps) {
            this.mixin.toggleMenu({ positionUsingEvent: nextProps.event }, $(this.refs.dropdownMenu));
        },
        render() {
            const { cy, registry, editable } = this.props;
            const hasSelection = cy.nodes().filter(':selected').length > 0;

            return (
                <div ref="menu" onMouseDown={e => e.stopPropagation()}>
                <ul ref="dropdownMenu" className="dropdown-menu" role="menu">
                    <li className="requires-EDIT"><a onMouseUp={this.props.onEvent} className="has-shortcut" data-func="CreateVertex" tabIndex="-1" href="#">{i18n('graph.contextmenu.create_vertex')}<span className="shortcut">{F.string.shortcut('alt+n')}</span></a></li>

                    <li className="divider requires-EDIT"></li>

                    <li><a onMouseUp={this.props.onEvent} className="has-shortcut" data-func="FitToWindow" tabIndex="-1" href="#">{i18n('graph.contextmenu.fit_to_window')}<span className="shortcut">{F.string.shortcut('alt+f')}</span></a></li>

                    <li className="dropdown-submenu selectors">
                    <a onMouseUp={this.props.onEvent} tabIndex="-1" href="#">{i18n('graph.contextmenu.select')}</a>
                    <ul className="dropdown-menu">
                        <li><a onMouseUp={this.props.onEvent} className="has-shortcut" data-func="Select" data-args='["all"]' tabIndex="-1" href="#">{i18n('graph.contextmenu.select.all')}<span className="shortcut">{F.string.shortcut('meta+a')}</span></a></li>
                        <li><a onMouseUp={this.props.onEvent} className="has-shortcut" data-func="Select" data-args='["none"]' tabIndex="-1" href="#">{i18n('graph.contextmenu.select.none')}<span className="shortcut">{F.string.shortcut('esc')}</span></a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Select" data-args='["invert"]' tabIndex="-1" href="#">{i18n('graph.contextmenu.select.invert')}</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Select" data-args='["vertices"]' tabIndex="-1" href="#">{i18n('graph.contextmenu.select.vertices')}</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Select" data-args='["edges"]' tabIndex="-1" href="#">{i18n('graph.contextmenu.select.edges')}</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Select" data-args='["orphan"]' tabIndex="-1" href="#">{i18n('graph.contextmenu.select.orphan')}</a></li>
                        {registry[EXTENSION_SELECT].length ?
                            _.compact(registry[EXTENSION_SELECT].map(e => {
                                if ((hasSelection && _.contains(['always', 'selected'], e.visibility)) ||
                                    (!hasSelection && _.contains(['always', 'none-selected'], e.visibility))) {
                                        return (
                                            <li key={e.identifier} className="plugin">
                                                <a onMouseUp={this.props.onEvent} href="#" tabIndex="-1" data-func="Select" data-args={JSON.stringify([e.identifier])}>
                                                    {i18n(`graph.selector.${e.identifier}.displayName`)}
                                                </a>
                                            </li>
                                        );
                                    }
                            })) : null
                        }

                    </ul>
                    </li>

                    {editable ? (
                    <li className="dropdown-submenu layouts requires-EDIT">
                    <a onMouseUp={this.props.onEvent} tabIndex="-1" href="#">{i18n('graph.contextmenu.layout')}</a>
                    <ul className="dropdown-menu">
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["breadthfirstCircle", {}]' tabIndex="-1" href="#">Circle Breadthfirst</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["breadthfirstTree", {}]' tabIndex="-1" href="#">TopDown Breadthfirst</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["dagre", {}]' tabIndex="-1" href="#">Dagre</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["concentric", {}]' tabIndex="-1" href="#">Concentric</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["circle", {}]' tabIndex="-1" href="#">Circle</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["cola", {}]' tabIndex="-1" href="#">Cola</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["grid", {}]' tabIndex="-1" href="#">Grid</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["random", {}]' tabIndex="-1" href="#">Random</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["d3", {}]' tabIndex="-1" href="#">D3</a></li>
                        {this.renderLayoutExtensions(false)}
                    </ul>
                    </li>
                    ) : null}

                    {editable ? (
                        <li className="dropdown-submenu layouts requires-READ">
                            <a onMouseUp={this.props.onEvent} tabIndex="-1" href="#">{i18n('graph.contextmenu.sizeStrategy')}</a>
                            <ul className="dropdown-menu">
                                <li><a onMouseUp={this.props.onEvent} data-func="SizeNodes" data-args='["standard", {}]' tabIndex="-1" href="#">{i18n('graph.contextmenu.sizeStrategy.standard')}</a></li>
                                <li><a onMouseUp={this.props.onEvent} data-func="SizeNodes" data-args='["pageRank", {}]' tabIndex="-1" href="#">{i18n('graph.contextmenu.sizeStrategy.pageRank')}</a></li>
                                <li><a onMouseUp={this.props.onEvent} data-func="SizeNodes" data-args='["degreeCentrality", {}]' tabIndex="-1" href="#">{i18n('graph.contextmenu.sizeStrategy.degreeCentrality')}</a></li>
                                <li><a onMouseUp={this.props.onEvent} data-func="SizeNodes" data-args='["closenessCentrality", {}]' tabIndex="-1" href="#">{i18n('graph.contextmenu.sizeStrategy.closenessCentrality')}</a></li>
                                <li><a onMouseUp={this.props.onEvent} data-func="SizeNodes" data-args='["betweennessCentrality", {}]' tabIndex="-1" href="#">{i18n('graph.contextmenu.sizeStrategy.betweennessCentrality')}</a></li>
                            </ul>
                        </li>
                    ) : null}

                    {editable && hasSelection ? (
                    <li className="dropdown-submenu layouts-multi requires-EDIT">
                    <a onMouseUp={this.props.onEvent} tabIndex="-1" href="#">{i18n('graph.contextmenu.layout.selection')}</a>
                    <ul className="dropdown-menu">
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["circle",{"onlySelected":true}]' tabIndex="-1" href="#">{i18n('graph.contextmenu.layout.circle')}</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["bettergrid", {"onlySelected":true}]' tabIndex="-1" href="#">{i18n('graph.contextmenu.layout.grid')}</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["cose", {"onlySelected":true}]' tabIndex="-1" href="#">{i18n('graph.contextmenu.layout.force_directed')}</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["cola", {"onlySelected":true}]' tabIndex="-1" href="#">{i18n('graph.contextmenu.layout.cluster')}</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Layout" data-args='["d3", {"onlySelected":true}]' tabIndex="-1" href="#">{i18n('graph.contextmenu.layout.d3')}</a></li>
                        {this.renderLayoutExtensions(true)}
                    </ul>
                    </li>
                    ) : null}

                    {editable && cy.nodes().filter(':selected').length > 1 ? (
                            <li><a className="requires-EDIT" onMouseUp={this.props.onEvent} data-func="CollapseSelectedNodes" tabIndex="-1" href="#">{i18n('graph.contextmenu.collapse')}</a></li>
                    ) : null}

                    <li className="dropdown-submenu">
                    <a onMouseUp={this.props.onEvent} tabIndex="-1" href="#">{i18n('graph.contextmenu.zoom')}</a>
                    <ul className="dropdown-menu">
                        <li><a onMouseUp={this.props.onEvent} data-func="Zoom" data-args="[2]" tabIndex="-1">{i18n('graph.contextmenu.zoom.x2')}</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Zoom" data-args="[1]" tabIndex="-1">{i18n('graph.contextmenu.zoom.x1')}</a></li>
                        <li><a onMouseUp={this.props.onEvent} data-func="Zoom" data-args="[0.5]" tabIndex="-1">{i18n('graph.contextmenu.zoom.half')}</a></li>
                    </ul>
                    </li>

                    {registry[EXTENSION_EXPORT].length ? (<li className="divider" />) : null}
                    {registry[EXTENSION_EXPORT].length === 1 ? this.renderExportExtensions() : null}
                    {registry[EXTENSION_EXPORT].length > 1 ? (
                        <li className="dropdown-submenu">
                            <a>{i18n('graph.contextmenu.export')}</a>
                            <ul className="dropdown-menu">{this.renderExportExtensions()}</ul>
                        </li>
                    ) : null}

                </ul>
                </div>
            )
        },

        renderExportExtensions() {
            return _.sortBy(this.props.registry[EXTENSION_EXPORT], 'menuItem')
                .map(e => (
                    <li key={e.componentPath} className="exporter">
                        <a onMouseUp={this.props.onEvent}
                           data-func="Export"
                           data-args={JSON.stringify([e.componentPath])}
                           href="#">{e.menuItem}</a>
                    </li>
                ))
        },

        renderLayoutExtensions(onlySelected) {
            const display = e => i18n('graph.layout.' + e.identifier + '.displayName');
            return _.sortBy(this.props.registry[EXTENSION_LAYOUT], display)
                .map(e => {
                    cytoscape('layout', e.identifier, e);
                    return (
                        <li key={e.identifier} className="exporter">
                            <a onMouseUp={this.props.onEvent}
                               data-func="Layout"
                               data-args={JSON.stringify([e.identifier, { onlySelected }])}
                               href="#">{display(e)}</a>
                        </li>
                    );
                });
        }

    });


    return RegistryInjectorHOC(Menu, [EXTENSION_EXPORT, EXTENSION_SELECT, EXTENSION_LAYOUT]);
});
