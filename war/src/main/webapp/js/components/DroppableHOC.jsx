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
define(['create-react-class', 'prop-types', 'util/dnd'], function(createReactClass, PropTypes, dnd) {

    const Events = 'dragover dragenter dragleave drop'.split(' ');
    const DroppableHOC = (WrappedComponent, cls) => createReactClass({
        displayName: `DroppableHOC(${WrappedComponent.displayName || 'Component'})`,
        propTypes: {
            mimeTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
            onDrop: PropTypes.func.isRequired,
            style: PropTypes.object
        },
        getInitialState() {
            return { cls: '' }
        },
        componentDidMount() {
            Events.forEach(event => {
                if (event in this) {
                    this.refs.div.addEventListener(event, this[event], false)
                } else console.error('No handler for event: ' + event);
            })
        },
        componentWillUnmount() {
            Events.forEach(event => {
                if (event in this) {
                    this.refs.div.removeEventListener(event, this[event])
                } else console.error('No handler for event: ' + event);
            })
        },
        dataTransferHasValidMimeType(dataTransfer) {
            return dnd.dataTransferHasValidMimeType(dataTransfer, this.props.mimeTypes)
        },
        dragover(event) {
            const { dataTransfer } = event;
            if (this.dataTransferHasValidMimeType(dataTransfer)) {
                event.preventDefault();
                event.stopPropagation();
            }
        },
        dragleave(event) {
            _.delay(() => {
                const index = this.dragstack.indexOf(event.target);
                if (index >= 0) {
                    this.dragstack.splice(index, 1);
                }
                if (!this.dragstack.length) {
                    this.toggleClass(false);
                }
            }, 1);
        },
        dragenter(event) {
            if (!this.dragstack) this.dragstack = [];

            if (!this.dragstack.length) {
                if (this.dataTransferHasValidMimeType(event.dataTransfer)) {
                    this.toggleClass(true);
                }
            }
            this.dragstack.push(event.target);
        },
        drop(event) {
            if (!this.dataTransferHasValidMimeType(event.dataTransfer)) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            this.toggleClass(false);

            const { pageX, pageY } = event;
            const box = (cls ? $(event.target).closest(cls)[0] : event.target)
                .getBoundingClientRect();

            var positionTransform, comp = this.refs.wrapped;
            while (!positionTransform) {
                if (!comp) break;
                if (comp && comp.droppableTransformPosition) {
                    positionTransform = comp.droppableTransformPosition;
                    break;
                }
                comp = comp.refs.wrapped;
            }
            const position = (positionTransform || _.identity)({
                x: pageX - box.left,
                y: pageY - box.top
            });

            this.props.onDrop(event, position);
        },
        toggleClass(toggle) {
            const cls = toggle ? 'accepts-draggable' : '';
            if (this.state.cls !== cls) {
                this.setState({ cls });
            }
        },
        render() {
            const { cls } = this.state;
            const { onDrop, mimeTypes, style = { position: 'relative' }, ...props} = this.props;
            return (
                <div ref="div" style={style} className={cls}><WrappedComponent ref="wrapped" {...props} /></div>
            )
        }
    });

    return DroppableHOC
});
