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

    var _counter = 1;
    const keyCounter = () => _counter++;

    const MaxValueLength = 50;
    const transformForInput = value => (value || '').substring(0, MaxValueLength);

    const createFixedCreatable = Creatable => {
        class CreatablePutLast extends Creatable {
            constructor(props) {
                super(props);

                // Wrap filter options to move the create option to last
                // This will be a valid configuration in future releases
                // https://github.com/JedWatson/react-select/pull/1436
                this.filterOptions = _.wrap(this.filterOptions, (fn, ...rest) => {
                    const filtered = fn.apply(this, rest);
                    if (filtered.length > 1 && filtered[0] === this._createPlaceholderOption) {
                        filtered.push(filtered.shift());
                    }
                    return filtered;
                })
            }
        }
        return CreatablePutLast;
    };

    const BaseSelect = createReactClass({
        propTypes: {
            onSelected: PropTypes.func.isRequired,
            valueKey: PropTypes.string.isRequired,
            labelKey: PropTypes.string.isRequired,
            options: PropTypes.array.isRequired,
            createForm: PropTypes.string,
            value: PropTypes.string,
            creatable: PropTypes.bool
        },
        getInitialState() {
            return { showForm: false }
        },
        getDefaultProps() {
            return { creatable: true, labelKey: 'displayName', valueKey: 'title' }
        },
        updateValue(value) {
            this.setState({ value })

            if (!value) {
                this.props.onSelected();
            } else {
                this.props.onSelected(this.getOptionByValue(value))
            }
        },
        getOptionByValue(value, props) {
            const { valueKey, options } = props || this.props;
            return _.findWhere(options, { [valueKey]: value });
        },
        componentDidMount() {
            if (this.props.creatable) {
                this.setupCreatable(this.props)
            }
        },
        componentWillReceiveProps(nextProps) {
            const { key } = this.state;
            if (key && nextProps.iriKeys && nextProps.iriKeys[key]) {
                const value = nextProps.iriKeys[key];
                if (_.isString(value)) {
                    const option = this.getOptionByValue(value, nextProps);
                    if (option) {
                        this.setState({ value, key: false, error: null })
                        this.props.onSelected(option);
                    }
                } else if (_.isObject(value) && 'error' in value) {
                    this.setState({ key: false, showForm: true, error: value.error || 'Server Error' })
                }
            } else if (nextProps.value !== (this.state.value || this.props.value)) {
                this.setState({ value: nextProps.value })
            }
            if (nextProps.creatable !== this.props.creatable) {
                if (nextProps.creatable) {
                    this.setupCreatable(nextProps);
                } else {
                    this.setState({ selectComponent: null, CreateForm: null })
                }
            }
        },
        render() {
            const { creating, showForm, value, CreateForm, selectComponent, key, error, type } = this.state;
            const { formProps, value: defaultValue, creatable, createForm, disabled, placeholder, ...rest } = this.props;
            const hasKey = Boolean(key);
            const extendedFormProps = {
                ...(formProps || {}),
                type,
                transformForSubmit: this.transformForSubmit,
                transformForInput
            };

            return (
                <div>
                {
                    (creating && showForm && CreateForm) ? (
                        <CreateForm
                            displayName={creating}
                            onCancel={this.onCancel}
                            onCreate={this.onCreate}
                            error={error}
                            {...extendedFormProps} />
                    ) : (
                        <VirtualizedSelect
                            ref={r => { this._virtualized = r}}
                            simpleValue
                            clearable
                            searchable
                            isLoading={hasKey}
                            disabled={disabled || hasKey}
                            placeholder={hasKey ? 'Creating…' : placeholder}
                            selectComponent={selectComponent}
                            promptTextCreator={label => `Create "${label}"`}
                            // Bug in Creatable? that the default optioncreator doesn't
                            // work when create option is not first because it's
                            // returning a new object. Memoize on label to fix
                            newOptionCreator={_.memoize(({ label, labelKey, valueKey }) => ({
                                [valueKey]: label,
                                [labelKey]: label,
                                className: 'Select-create-option-placeholder'
                            }), ({ label }) => label)}
                            value={_.isString(value) ? value : defaultValue}
                            onChange={this.updateValue}
                            onNewOptionClick={this.onNewOptionClick}
                            optionRenderer={nameOptionRenderer(this.props.depthKey, this.props.pathKey)}
                            optionHeight={28}
                            matchProp="label"
                            {...rest}
                        />
                    )
                }
                </div>
            );
        },
        transformForSubmit(value) {
            const { options, labelKey } = this.props;
            const transformed = transformForInput(value).trim();
            const valid = transformed.length > 0;
            const matchesExisting = valid && _.any(
                options,
                o => o[labelKey].toLowerCase() === transformed.toLowerCase());

            if (matchesExisting) {
                return {
                    valid: false,
                    value: transformed,
                    reason: i18n('ontology.form.displayname.error.duplicate')
                };
            }
            return {
                valid,
                value: transformed,
                reason: valid ? null : i18n('ontology.form.displayname.error.empty')
            };
        },
        setupCreatable(props) {
            // Hack to get the internal Creatable from the Select dependency of
            // virtualized. Requiring 'react-select' in amd doesn't work
            const ref = this._virtualized;
            const Select = ref._getSelectComponent();
            if (Select) {
                const { Creatable } = Select;
                this.setState({ selectComponent: createFixedCreatable(Creatable) });
            } else {
                throw new Error('Internal structure of select has changed');
            }
            if (props.createForm) {
                Promise.require(props.createForm).then(CreateForm => {
                    this.setState({ CreateForm })
                })
            } else throw new Error('Create form prop required when creatable')
        },
        onCancel() {
            this.setState({ showForm: false })
        },
        onCreate(option) {
            const { valid, value } = this.transformForSubmit(option.displayName);
            if (valid) {
                option.displayName = value;
                const key = keyCounter();
                this.props.onCreate(option, { key });
                const { type, displayName } = option;
                this.setState({ showForm: false, key, creating: displayName, type })
            }
        },
        onNewOptionClick(option) {
            this.setState({ showForm: true, error: null, creating: option[this.props.labelKey], type: null })
            this.props.onSelected();
        }
    });

    return BaseSelect;

    function nameOptionRenderer(depthKey = 'depth', pathKey = 'path') {
        return function NameOptionRenderer({
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
            const indent = (option[depthKey] || 0) * 15;

            if (option.header) {
                return (
                    <div
                        className={className.join(' ')}
                        key={key}
                        style={style}
                    >
                        {option[labelKey]}
                    </div>
                );
            }

            const iconStyles = option.domainGlyphIconHref ? { backgroundSize: 'auto 80%' } : {};

            return (
                <div className={className.join(' ')}
                    key={key}
                    style={{ ...style, paddingLeft: `${indent}px` }}
                    title={`${option[pathKey] || option[labelKey]}${ option.displayNameSub ? `\n${option.displayNameSub}` : ''}`}
                    {...events}>
                    {
                        option.glyphIconHref ? (
                            <div className="icon" style={{ ...iconStyles, backgroundImage: `url(${option.glyphIconHref})` }} />
                        ) : (option.domainGlyphIconHref && option.rangeGlyphIconHref) ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <div className="icon" style={{ ...iconStyles, margin: '0 0 0 5px', backgroundImage: `url(${option.domainGlyphIconHref})` }} />
                            →
                            <div className="icon" style={{ ...iconStyles, margin: '0 5px 0 0', backgroundImage: `url(${option.rangeGlyphIconHref})` }} />
                            </div>
                        ) : (
                            <div className="icon" style={{ width: '6px', margin: '0' }} />
                        )
                    }
                    {option[labelKey]}
                </div>
            );
        }
    }
});
