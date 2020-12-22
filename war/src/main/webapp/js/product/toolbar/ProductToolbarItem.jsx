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
    'classnames',
    'components/Attacher'
], function(
    createReactClass,
    PropTypes,
    classNames,
    Attacher) {
    'use strict';

    const PADDING = 10;

    const ProductToolbarItem = createReactClass({

        propTypes: {
            item: PropTypes.shape({
                identifier: PropTypes.string.isRequired,
                itemComponentPath: PropTypes.string,
                icon: PropTypes.string,
                label: PropTypes.string,
                props: PropTypes.object
            }),
            active: PropTypes.bool,
            onClick: PropTypes.func,
            onItemMouseEnter: PropTypes.func,
            onItemMouseLeave: PropTypes.func,
            rightOffset: PropTypes.number
        },

        render() {
            const { active, item, onItemMouseEnter, onItemMouseLeave } = this.props;
            const { props: itemProps, icon, label, buttonClass, identifier, itemComponentPath, placementHint } = item;

            return (
                <li
                    className={classNames('toolbar-item', { active })}
                    onClick={this.onItemClick}
                    ref={(ref) => { this.item = ref }}
                    onMouseEnter={(event) => { onItemMouseEnter(identifier) }}
                    onMouseLeave={(event) => { onItemMouseLeave(identifier) }}
                >
                    {itemComponentPath
                        ? placementHint && placementHint === 'popover'
                            ? this.renderPopoverItem()
                            : this.renderItem()
                        : this.renderButton()}
                </li>
            );
        },

        renderButton() {
            const { active, item } = this.props;
            const { props: itemProps, icon, label, buttonClass, identifier, itemComponentPath } = item;

            return (
                <div className={classNames('button', buttonClass)}>
                    { icon ?
                        <div className="item-icon" style={{backgroundImage: `url(${icon})`}}></div>
                        : null}
                    <span>{label}</span>
                </div>
            )
        },

        renderItem() {
            const { props: itemProps, identifier, itemComponentPath } = this.props.item;

            return (
                <Attacher
                    key={identifier}
                    componentPath={itemComponentPath}
                    {...itemProps}
                />
            )
        },

        renderPopoverItem() {
            const { active, item } = this.props;
            const { props: itemProps = {}, icon, label, buttonClass, identifier, itemComponentPath } = item;


            return (
                <div>
                    <div className={classNames('button', 'has-popover', buttonClass)}>
                        { icon ?
                            <div className="item-icon" style={{backgroundImage: `url(${icon})`}}></div>
                            : null}
                        <span>{label}</span>
                    </div>
                    <div
                        style={{display: (active ? 'block' : 'none')}}
                        className="item-container"
                        ref={(ref) => { this.popover = ref }}
                    >
                        {active ? <Attacher
                            key={identifier}
                            componentPath={itemComponentPath}
                            afterAttach={this.positionPopover}
                            {...itemProps}
                            onResize={this.positionPopover}
                        /> : null}
                    </div>
                    <div className="arrow top"></div>
                </div>
            )
        },

        onItemClick(event) {
            if (!$(event.target).closest('.item-container').length) {
                const { props: itemProps = {}, identifier } = this.props.item;
                if (_.isFunction(itemProps.handler)) {
                    itemProps.handler(this.props.item.props || {});
                } else {
                    this.props.onClick(identifier);
                }
            }
        },

        /**
         * Call `props.onResize` after your component with placementHint `popover` changes size to update the popover's position
         * @callback org.bigconnect.product.toolbar.item~onResize
         */
        positionPopover() {
            const rightOffset = this.props.rightOffset;
            const { left: itemLeft, width: itemWidth, right: itemRight } = this.item.getBoundingClientRect();
            const { left, right, width } = this.popover.getBoundingClientRect();
            const windowWidth = $(window).width();
            const maxLeft = windowWidth - width - PADDING - rightOffset;
            const currentOffset = $(this.popover).offset();
            const positionLeft = Math.min(itemLeft, maxLeft);

            $(this.arrow).offset({ top: $(this.arrow).offset.top, left: (itemLeft + (itemWidth / 2))});
            $(this.popover).offset({ top: currentOffset.top, left: Math.max(positionLeft, 40) }); //menubar width
        }
    });

    return ProductToolbarItem;
});
