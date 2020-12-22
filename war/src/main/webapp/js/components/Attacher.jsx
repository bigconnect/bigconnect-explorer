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
    'util/component/attacher'
], function(React, createReactClass, PropTypes, attacher) {
    'use strict';

    const Attacher = createReactClass({

        propTypes: {
            componentPath: PropTypes.string,
            component: PropTypes.func,
            behavior: PropTypes.object,
            legacyMapping: PropTypes.object,
            nodeType: PropTypes.string,
            nodeStyle: PropTypes.object,
            nodeClassName: PropTypes.string
        },

        getDefaultProps() {
            return { nodeType: 'div', nodeStyle: {}, nodeClassName: '' };
        },

        getInitialState() {
            return { element: null }
        },

        componentDidMount() {
            this.reattach(this.props);
        },

        componentWillReceiveProps(nextProps) {
            if (nextProps !== this.props) {
                this.reattach(nextProps);
            }
        },

        componentWillUnmount() {
            if (this.attacher) {
                this.attacher.teardown();
                this.attacher = null;
            }
        },

        render() {
            const { nodeType, nodeStyle, nodeClassName } = this.props;
            const { element } = this.state;

            return element ? element : React.createElement(nodeType, {
                ref: 'node',
                style: nodeStyle,
                className: nodeClassName
            });
        },

        reattach(props) {
            const { component, componentPath, legacyMapping, behavior, nodeType, nodeStyle, nodeClassName, ...rest } = props;

            if (!component && !componentPath) {
                throw new Error('Attacher requires either component or componentPath')
            }

            const inst = (this.attacher || (this.attacher = attacher({ preferDirectReactChildren: true })))
                .path(componentPath)
                .component(component)
                .params(rest);

            if (this.refs.node) {
                inst.node(this.refs.node)
            }

            if (behavior) {
                inst.behavior(behavior)
            }

            if (legacyMapping) {
                inst.legacyMapping(legacyMapping)
            }

            inst.attach({
                teardown: true,
                teardownOptions: { react: false },
                emptyFlight: true
            }).then(attach => {
                if (this.attacher) {
                    if (attach._reactElement) {
                        this.setState({ element: attach._reactElement })
                    }
                    this.afterAttach();
                }
            })
        },

        afterAttach() {
            const afterAttach = this.props.afterAttach;

            if (_.isFunction(afterAttach)) {
                afterAttach(this.attacher);
            }
        }
    });

    return Attacher;
});
