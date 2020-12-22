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
    'react-virtualized-select'
], function(
    createReactClass,
    PropTypes,
    { default: VirtualizedSelect }) {

    const GlyphSelector = createReactClass({
        propTypes: {
            search: PropTypes.string,
            onSelected: PropTypes.func.isRequired
        },
        getInitialState() {
            return { isLoading: true };
        },
        componentDidMount() {
            Promise.require('text!../imgc/sprites/glyphicons.json_array').then(json => {
                var obj = JSON.parse(json);
                this.setState({ isLoading: false, options: obj.list });
                this.checkForMatch();
            })
        },
        componentWillReceiveProps(nextProps) {
            this.checkForMatch(nextProps)
        },
        checkForMatch(props) {
            const { value, options, similar } = this.state;
            const { search } = props || this.props;

            if (!value && options && search && search.length > 2) {
                var option = _.find(options, option => option.label.toLowerCase().indexOf(search.toLowerCase()) >= 0);
                if (option) {
                    if (option.value !== similar) {
                        this.setState({ similar: option.value })
                        this.props.onSelected(option.value);
                    }
                } else if (similar) {
                    this.setState({ similar: null });
                    this.props.onSelected();
                }
            }
        },
        render() {
            const { value = null, options = [], isLoading, similar } = this.state;
            const { search, ...rest } = this.props;

            return (
                <VirtualizedSelect
                    options={options}
                    simpleValue
                    clearable
                    searchable
                    value={_.isString(value) ? value : similar}
                    onChange={this.onChange}
                    optionRenderer={GlyphOptionRenderer}
                    optionHeight={28}
                    isLoading={isLoading}
                    placeholder="Select Icon"
                    valueRenderer={GlyphValueRenderer}
                    {...rest}
                />
            )
        },
        onChange(value) {
            this.setState({ value: value ? value : '' })

            if (!value) {
                this.props.onSelected();
            } else {
                this.props.onSelected(value)
            }
        }
    });

    return GlyphSelector;

    function GlyphValueRenderer (option) {
        return (
            <div style={{ paddingLeft: '33px' }}
                title={option.label}>
            <div className="icon" style={{
                position: 'absolute',
                left: '9px',
                top: '50%',
                backgroundImage: 'url(imgc/sprites/glyphicons.png)',
                backgroundPosition: option.backgroundPosition,
                backgroundSize: option.backgroundSize,
                width: option.width,
                height: option.height,
                transform: `scale(${option.scale}) translate(0, -50%)`,
                transformOrigin: '0 0',
                margin: '0'
            }}></div>{option.label}</div>
        )
    }

    function GlyphOptionRenderer ({
        focusedOption, focusedOptionIndex, focusOption,
        key, labelKey,
        option, optionIndex, options,
        selectValue,
        style,
        valueArray
    }) {
        const className = ['VirtualizedSelectOption']
        if (option.className) {
            className.push(option.className);
        }
        if (option === focusedOption) {
            className.push('VirtualizedSelectFocusedOption')
        }
        if (option.disabled) {
            className.push('VirtualizedSelectDisabledOption')
        }
        if (option.header) {
            className.push('VirtualizedSelectHeader');
        }
        if (valueArray && valueArray.indexOf(option) >= 0) {
            className.push('VirtualizedSelectSelectedOption')
        }
        const events = option.disabled ? {} : {
            onClick: () => selectValue(option),
            onMouseOver: () => focusOption(option)
        };
        const { px } = option;

        return (
            <div className={className.join(' ')}
                key={key}
                style={{ ...style, paddingLeft: '33px' }}
                title={option[labelKey]}
                {...events}>
            <div className="icon" style={{
                position: 'absolute',
                left: '7px',
                backgroundImage: 'url(imgc/sprites/glyphicons.png)',
                backgroundPosition: option.backgroundPosition,
                backgroundSize: option.backgroundSize,
                width: option.width,
                height: option.height,
                transform: `scale(${option.scale}) translate(0, -50%)`,
                transformOrigin: '0 0',
                top: '50%',
                margin: '0'
            }}></div>{option[labelKey]}</div>
        );
    }
});
