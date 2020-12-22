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
    'react',
    'create-react-class',
    'prop-types',
    'configuration/plugins/registry',
    'components/RegistryInjectorHOC',
    'util/deepObjectCache',
    './ProductToolbarItem',
    './ProductToolbarMenu',
    './ProductAddDataset'
], function(
    React,
    createReactClass,
    PropTypes,
    registry,
    RegistryInjectorHOC,
    DeepObjectCache,
    ProductToolbarItem,
    ProductToolbarMenu) {
    'use strict';

    /**
     * Plugin to add custom item components (Flight or React) which display in toolbar at the top right of a product.
     *
     * @param {string} identifier Unique id for this item
     * @param {string} itemComponentPath Path to {@link org.bigconnect.product.toolbar.item~Component} to render
     * @param {func} canHandle Given `product` should this item be placed
     * @param {func} [initialize] Allows configuration of the product environment with same parameters passed to
     *   {@link org.bigconnect.product.toolbar.item~Component}.
     * @param {string} [placementHint=menu] How this item should be displayed in the toolbar
     * * `menu` inside the hamburger menu list
     * * `popover` as a button that will expand a popover where the component is rendered.
     *   If specified one of `icon` or `label` is required. Also passed {@link org.bigconnect.product.toolbar.popover~onResize}
     * * `button` as an inline button component
     * @param {string} [buttonClass] Css class to add to the button element when placed as `button` or `popover`
     * @param {string} [icon] Path to the icon to render when displayed as a `popover`
     * @param {string} [label] Label text to render when displayed as a `popover`
     */
    registry.documentExtensionPoint('org.bigconnect.product.toolbar.item',
        'Add components to the product toolbar',
        function(e) {
            return ('identifier' in e) && ('canHandle' in e && _.isFunction(e.canHandle))
                && (['itemComponentPath', 'icon', 'label'].some(key => key in e));
        },
        'http://docs.bigconnect.org/extension-points/front-end/productOptions'
    );

    const placementHint = {
        MENU: 'menu',
        BUTTON: 'button',
        POPOVER: 'popover'
    };
    const MENU_IDENTIFIER = 'menu';
    const HOVER_OPEN_DELAY = 600;

    const ProductToolbar = createReactClass({

        propTypes: {
            product: PropTypes.shape({
                kind: PropTypes.string.isRequired
            }).isRequired,
            registry: PropTypes.object.isRequired,
            injectedProductProps: PropTypes.object,
            showNavigationControls: PropTypes.bool,
            showAddDataset: PropTypes.bool,
            onFit: PropTypes.func,
            onZoom: PropTypes.func,
            rightOffset: PropTypes.number,
            topOffset: PropTypes.number
        },

        getDefaultProps() {
            return {
                rightOffset: 0,
                topOffset: 0,
                showNavigationControls: false,
                showAddDataset: true,
                injectedProductProps: {}
            }
        },

        getInitialState() {
            return {
                activeItem: null,
                stayOpen: false
            }
        },

        componentDidMount() {
            $(document).on('keydown.org-bigconnect-product-toolbar', (event) => {
                if (event.which === 27) { //esc
                    this.setState({ activeItem: null, stayOpen: false });
                }
            });
            this.triggerInitialize()
        },

        componentDidUpdate(prevState, prevProps) {
            if (this.state.stayOpen && this.openItemTimeout) {
                clearTimeout(this.openItemTimeout);
                this.openItemTimeout = null;
            }
            this.triggerInitialize()
        },

        componentWillUnmount() {
            this.triggerTeardown()
            $(document).off('keydown.org-bigconnect-product-toolbar');
        },

        render() {
            const { activeItem } = this.state;
            const { onFit, onZoom, rightOffset, topOffset, registry, injectedProductProps, product } = this.props;
            const menuItems = [], listItems = [];
            const groupByPlacement = (item) => {
                const { placementHint, icon, label } = item;

                if (placementHint) {
                    if (placementHint === placementHint.MENU) {
                        menuItems.push(item);
                    } else {
                        listItems.push(item);
                    }
                } else if (icon || label) {
                    listItems.push(item);
                } else {
                    menuItems.push(item);
                }
            };
            const items = [
                ..._.sortBy(registry['org.bigconnect.product.toolbar.item'], 'identifier'),
                ...this.getDefaultItems(),
                ...this.mapDeprecatedItems()
            ];

            this.eligibleForInitialize = [];
            items.forEach(_item => {
                const item = { ..._item, props: { ..._item.props, ...injectedProductProps}}
                if (item.canHandle(product)) {
                    if (_.isFunction(item.initialize)) {
                        this.eligibleForInitialize.push(item)
                    }
                    groupByPlacement(item);
                }
            });

            return (
                <div className="product-toolbar" style={{transform: `translate(-${rightOffset}px, ${topOffset}px)`}}>
                    <div className="toolbar-list">
                        {listItems.length ?
                            <ul className="extensions">
                                {listItems.map(item => (
                                    <ProductToolbarItem
                                        item={item}
                                        active={activeItem === item.identifier}
                                        key={item.identifier}
                                        onClick={this.onItemClick}
                                        onItemMouseEnter={this.onItemMouseEnter}
                                        onItemMouseLeave={this.onItemMouseLeave}
                                        rightOffset={rightOffset}
                                    />
                                ))}
                            </ul>
                            : null}
                        {menuItems.length ?
                            <ProductToolbarMenu
                                items={menuItems}
                                active={activeItem === MENU_IDENTIFIER}
                                identifier={MENU_IDENTIFIER}
                                onToggle={this.onItemClick}
                                onItemMouseEnter={this.onItemMouseEnter}
                                onItemMouseLeave={this.onItemMouseLeave}
                            />
                            : null}
                    </div>
                </div>
            );
        },

        onFinishLoadDataset() {
            this.setState({
                addDatasetPopoverOpen: false,
            })
        },

        onLoadDataset() {
            const position = { x: window.lastMousePositionX, y: window.lastMousePositionY };

            this.setState({
                addDatasetPopoverOpen: !this.state.addDatasetPopoverOpen,
                popoverPosition: position
            })
        },

        onItemClick(identifier) {
            const { activeItem, stayOpen } = this.state;

            if (activeItem) {
                if (activeItem === identifier && !stayOpen) {
                    this.setState({ stayOpen: true });
                } else if (activeItem === identifier) {
                    this.setActiveItem();
                } else {
                    this.setActiveItem(identifier, true);
                }
            } else if (identifier) {
                this.setActiveItem(identifier, true);
            } else {
                this.setActiveItem();
            }
        },

        onItemMouseEnter(identifier) {
            if (!this.state.stayOpen) {
                this.openItemTimeout = setTimeout(() => { this.setActiveItem(identifier) }, HOVER_OPEN_DELAY);
            }
        },

        onItemMouseLeave(identifier) {
            if (!this.state.stayOpen) {
                const { activeItem, stayOpen } = this.state;

                if (this.openItemTimeout) {
                    clearTimeout(this.openItemTimeout);
                    this.openItemTimeout = null;
                }

                if (activeItem && !stayOpen) {
                    this.setActiveItem();
                }
            }
        },

        setActiveItem(activeItem = null, stayOpen = false) {
            this.setState({ activeItem, stayOpen });
        },

        getDefaultItems() {
            const { showNavigationControls, showAddDataset, onZoom, onFit } = this.props;

            return ([
                {
                    identifier: 'org-bigconnect-product-dataset',
                    placementHint: 'popover',
                    label: 'Dataset',
                    itemComponentPath: 'product/toolbar/ProductAddDataset',
                    canHandle: () => showAddDataset
                },
                {
                    identifier: 'org-bigconnect-product-zoom-out',
                    placementHint: 'button',
                    label: '-',
                    props: { handler: _.partial(onZoom, 'out') },
                    buttonClass: 'zoom',
                    canHandle: () => showNavigationControls && !!onZoom
                },
                {
                    identifier: 'org-bigconnect-product-zoom-in',
                    placementHint: 'button',
                    label: '+',
                    props: { handler: _.partial(onZoom, 'in') },
                    buttonClass: 'zoom',
                    canHandle: () => showNavigationControls && !!onZoom
                },
                {
                    identifier: 'org-bigconnect-product-fit',
                    placementHint: 'button',
                    label: i18n('product.toolbar.fit'),
                    props: { handler: onFit},
                    canHandle: () => showNavigationControls && !!onFit
                }
            ]);
        },

        mapDeprecatedItems() {
            const { product, registry } = this.props;
            const items = [];

            ['org.bigconnect.map.options', 'org.bigconnect.graph.options'].forEach(extensionPoint => {
                const productKind = extensionPoint === 'org.bigconnect.graph.options' ?
                    'org.bigconnect.web.product.graph.GraphWorkProduct' : 'org.bigconnect.web.product.map.MapWorkProduct';

                registry[extensionPoint].forEach(item => {
                    const { optionComponentPath, ...config } = item;
                    const mappedItem = {
                        ...config,
                        canHandle: (product) => product.kind === productKind
                    };

                    if (optionComponentPath) {
                        mappedItem.itemComponentPath = optionComponentPath;
                    }

                    items.push(mappedItem);
                });
            });

            return items;
        },

        // Trigger initialize/teardown on extensions only once per product change
        triggerInitialize() {
            if (this.eligibleForInitialize) {
                if (!this.initializedById) {
                    this.initializedById = {};
                }
                this.eligibleForInitialize.forEach(item => {
                    const { identifier, initialize, props } = item;
                    const { product } = props;

                    if (!_.isEmpty(props)) {
                        const previous = this.initializedById[identifier];
                        if (!previous || previous.props.product.id !== product.id) {
                            if (previous && _.isFunction(previous.teardown)) {
                                previous.teardown(previous.props)
                            }
                            this.initializedById[identifier] = item;
                            initialize(props);
                        }
                    }
                })
            }
        },

        triggerTeardown() {
            if (this.eligibleForInitialize) {
                this.eligibleForInitialize.forEach(({ teardown, props }) => {
                    if (_.isFunction(teardown)) {
                        teardown(props)
                    }
                })
            }
        }
    });

    return RegistryInjectorHOC(ProductToolbar, [
        'org.bigconnect.graph.options',
        'org.bigconnect.map.options',
        'org.bigconnect.product.toolbar.item'
    ]);
});
