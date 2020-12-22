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
    'react-virtualized-select',
    'util/vertex/formatters'
], function(
    createReactClass,
    PropTypes,
    { default: VirtualizedSelect },
    F) {

    const splitUpString = str =>
        _.compact(F.string.normalizeAccents(str.toLowerCase())
            .replace(/[^a-zA-Z0-9]/g, ' ')
            .split(/\s+/)
        );

    const MergeSelector = createReactClass({
        propTypes: {
            onElementSelected: PropTypes.func,
            onCreateNewElement: PropTypes.func,
            searchOptions: PropTypes.object,
            selectOptions: PropTypes.array
        },
        getDefaultProps() {
            return { searchOptions: {} };
        },
        getInitialState() {
            return { options: [], isLoading: false };
        },
        componentDidMount() {
            this.onInputChange = _.debounce(this.onInputChange, 250);
            this.initialOptions = this.props.selectOptions.slice(0);
            this.setState({options: this.props.selectOptions});
        },
        componentWillUnmount() {
            if (this.request) {
                this.request.cancel();
            }
        },
        searchForElements(input) {
            const { searchOptions, filterResultsToTitleField } = this.props;
            const query = `${input}*`;

            if (!input.length) return;

            this.setState({ isLoading: true })
            return Promise.require('util/withDataRequest')
                .then(({ dataRequest }) => {
                    this.request = dataRequest('vertex', 'search', {
                        matchType: 'element',
                        paging: {
                            offset: 0,
                            size: 25
                        },
                        query,
                        ...searchOptions,
                        disableResultCache: true
                    });
                    return this.request;
                })
                .then(({ elements }) => {
                    let options = elements;

                    if (filterResultsToTitleField) {
                        const queryParts = splitUpString(query);
                        options = _.reject(options, function(v) {
                            var queryPartsMissingFromTitle = _.difference(
                                queryParts,
                                splitUpString(F.vertex.title(v))
                            ).length;
                            return queryPartsMissingFromTitle;
                        });
                    }
                    const { creatable, createNewRenderer, createNewLabel } = this.props;
                    if (creatable) {
                        options.splice(0, 0, {
                            id: '-1',
                            input,
                            creatable: true,
                            label: createNewRenderer ?
                                createNewRenderer(input) :
                                (createNewLabel || i18n('element.selector.create', input))
                        });
                    }

                    const startIndex = creatable ? 1 : 0;
                    let toSelect;
                    if (options.length > startIndex) {
                        toSelect = options[startIndex];
                    } else if (creatable) {
                        toSelect = options[0];
                    }
                    this.setState({ options, isLoading: false });
                    if (toSelect) {
                        this.onChange(toSelect);
                    }
                })
                .catch(error => {
                    console.error(error);
                    this.setState({ isLoading: false })
                })

        },
        render() {
            const { value: initialValue, creatable, ...rest } = this.props;
            const { value, options, isLoading } = this.state;
            const startIndex = creatable ? 1 : 0;

            return (
                <VirtualizedSelect
                    clearable
                    onChange={this.onChange}
                    onInputChange={this.onInputChange}
                    optionRenderer={ElementOptionRenderer}
                    valueRenderer={this.elementValueRenderer}
                    optionHeight={28}
                    labelKey="id"
                    valueKey="id"
                    placeholder={i18n('bc.search')}
                    isLoading={isLoading}
                    filterOption={() => true}
                    options={options}
                    value={value || ''}
                    {...rest}
                />
            )
        },
        onInputChange(input) {
            this.searchForElements(input)
        },
        onChange(option) {
            if (option) {
                this.setState({ value: option.id })
            } else {
                this.setState({ value: '' })
            }
            if (option && option.id === '-1') {
                if (this.props.onCreateNewElement) {
                    this.props.onCreateNewElement(option.input);
                }
            } else {
                if (this.props.onElementSelected) {
                    if (_.isEmpty(option)) {
                        this.props.onElementSelected()
                    } else {
                        this.props.onElementSelected(option)
                    }
                }
            }
        },
        elementValueRenderer(option) {
            const { creatable, input } = option;
            if (creatable) {
                const { createNewValueRenderer, createNewValueLabel } = this.props;
                return createNewValueRenderer ?
                    createNewValueRenderer(input) :
                    (createNewValueLabel || input);
            }
            return F.vertex.title(option);
        }
    });

    return MergeSelector;

    function ElementOptionRenderer({
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

        return (
            <div
                className={className.join(' ')}
                key={key}
                style={{ ...style }}
                title={option[labelKey]}
                {...events}>{option.creatable ? option.label : F.vertex.title(option)}</div>
        );
    }
});
