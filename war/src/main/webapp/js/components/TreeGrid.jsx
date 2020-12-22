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
    'uuid'
], function(React, createReactClass, uuid) {
    'use strict';

    const LEVEL_OFFSET = 16;

    const Row = createReactClass({
        getExpandIcon(data, clickHandler) {
            if (data._hasChildren) {
                if (data._showChildren) {
                    return <span className="treegrid-expander"><i className="fa fa-minus" onClick={clickHandler}></i></span>
                }
                return <span className="treegrid-expander"><i className="fa fa-plus" onClick={clickHandler}></i></span>
            }
            return <span className="treegrid-expander"></span>
        },

        clickHandler() {
            if (this.props.data._hasChildren) {
                this.props.onClick(this.props.data._key, this.props.index)
            }
        },

        getIndent(level) {
            return <span className="treegrid-indent" style={{width: level * LEVEL_OFFSET}}></span>
        },

        getContent(field) {
            var format = field.format;
            var property = field.property;

            if (format && typeof format === 'function') {
                return format(this.props.data[property], this.props.data);
            }

            if (this.props.data[property] === null || this.props.data[property] === undefined) {
                return '';
            }

            return this.props.data[property];
        },

        render() {
            if (!this.props.data._visible) {
                return null;
            }

            var hasChildren = this.getExpandIcon(this.props.data, this.clickHandler)

            const items = this.props.options.fields.map((field, i) => {
                if (field.property === 'children') {
                    return null
                }

                var expandIcon;
                var offset = i === 0 ? this.getIndent(this.props.level) : null;

                if (i === 0) {
                    expandIcon = hasChildren;
                }

                return (
                    <td key={`${this.props.data._id}_${field.property}_${uuid.v4()}`} >
                        <div>
                            {offset}
                            {expandIcon}
                            {this.getContent(field)}
                        </div>
                    </td>
                )
            })

            return (
                <tr>
                    {items}
                </tr>
            )
        }
    });

    const Body = createReactClass({
        getInitialState() {
            return {
                dataToDisplay: this.flattenArray(this.props.data)
            }
        },

        clickHandler(key, index) {
            var tempState = this.state.dataToDisplay.slice(0)
            tempState[index]._showChildren = !tempState[index]._showChildren

            if (tempState[index]._showChildren) {
                this.insertInArray(
                    tempState,
                    index + 1,
                    this.flattenArray(tempState[index].children, tempState[index]))
            } else {
                this.removeChildren(tempState, key)
            }

            this.setState({dataToDisplay: tempState})
        },

        removeChildren(array, key) {
            let childrenIndex = this.indexOfProperty(array, "_parent", key)

            while (childrenIndex !== -1) {
                this.removeChildren(array, array[childrenIndex]._key)
                array.splice(childrenIndex, 1)
                childrenIndex = this.indexOfProperty(array, "_parent", key)
            }
        },

        insertInArray(array, index, obj) {
            if (obj.constructor === Array) {
                obj.forEach((elem, i) => {
                    array.splice(index + i, 0, elem)
                })
            } else {
                array.splice(index, 0, obj)
            }
        },

        indexOfProperty(array, property, value) {
            for (let i = 0; i < array.length; i ++) {
                if (array[i][property] === value) {
                    return i
                }
            }

            return -1
        },

        componentWillReceiveProps(nextProps) {
            if (this.props != nextProps) {
                this.setState({dataToDisplay: this.flattenArray(nextProps.data)})
            }
        },

        flattenArray(DataArray, parent, returnArray) {
            parent = parent || {}
            returnArray = returnArray || []

            if (parent._showChildren === false) {
                return returnArray
            }

            var level = parent._level === undefined ? 0 : parent._level + 1

            DataArray.forEach((element) => {
                let elemToAdd = {
                    ...element,
                    _hasChildren: element._hasChildren || false,
                    _level: level,
                    _parent: parent._key,
                    _key: element._key || uuid.v4(),
                    _showChildren: element._showChildren || false,
                    _visible: parent._showChildren || true
                }

                returnArray.push(elemToAdd)
                if (element.children && element.children.constructor === Array) {
                    elemToAdd._hasChildren = true
                }
            });

            return returnArray
        },

        render() {
            const rows = this.state.dataToDisplay.map((elem, i) =>
                <Row
                    key={`row_${i}`}
                    options={this.props.options}
                    data={elem}
                    level={elem._level}
                    index={i}
                    onClick={this.clickHandler}
                />
            )

            return (
                <tbody>
                {rows}
                </tbody>
            )
        }
    });

    const TreeGrid = createReactClass({
        componentWillReceiveProps(nextProps) {
            this.forceUpdate()
        },

        getHeaderElems() {
            return Object.keys(this.props.data[0])
        },

        render() {
            if (this.props.loading) {
                return ( <div></div> )
            }

            return (
                <div>
                    <table className="table table-striped table-hover">
                        <thead>
                        <tr>
                            {
                                this.props.options.fields.map((elem, i) => {
                                    if (elem === 'children') {
                                        return null;
                                    }

                                    return (
                                        <th style={{width: elem.width}} key={`header_${i}_${uuid.v4()}`}>
                                            {elem.displayName}
                                        </th>
                                    )
                                })
                            }
                        </tr>
                        </thead>

                        <Body data={this.props.data} options={this.props.options} />
                    </table>
                </div>
            );
        }
    });

    return TreeGrid;
});

