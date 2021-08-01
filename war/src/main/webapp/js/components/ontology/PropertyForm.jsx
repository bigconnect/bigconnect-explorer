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
    './ConceptSelector',
    './RelationshipSelector',
    '../Alert'
], function(
    createReactClass,
    PropTypes,
    classNames,
    ConceptsSelector,
    RelationshipSelector,
    Alert) {

    const DataTypes = [
        {
            label: i18n('ontology.property.dataformat.text'),
            options: [
                { type: 'string', label: i18n('ontology.property.dataformat.text.string') },
                { type: 'string', displayType: 'link', label: i18n('ontology.property.dataformat.text.link') }
            ]
        },
        {
            label: i18n('ontology.property.dataformat.number'),
            options: [
                { type: 'integer', label: i18n('ontology.property.dataformat.number.integer') },
                { type: 'double', label: i18n('ontology.property.dataformat.number.double') },
                { type: 'duration', displayType: 'duration', label: i18n('ontology.property.dataformat.number.duration') },
                { type: 'long', displayType: 'bytes', label: i18n('ontology.property.dataformat.number.bytes') }
            ]
        },
        {
            label: i18n('ontology.property.dataformat.boolean'),
            options: [
                { type: 'boolean', label: i18n('ontology.property.dataformat.boolean') }
            ]
        },
        {
            label: i18n('ontology.property.dataformat.date'),
            options: [
                { type: 'date', label: i18n('ontology.property.dataformat.date.date') },
                { type: 'date', displayType: 'dateOnly', label: i18n('ontology.property.dataformat.date.dateOnly') }
            ]
        },
        {
            label: i18n('ontology.property.dataformat.location'),
            options: [
                { type: 'geoLocation', label: i18n('ontology.property.dataformat.location.geoLocation') }
            ]
        }
    ];

    const transformOptions = dataTypes => {
        if (_.isArray(dataTypes) && dataTypes.length) {
            const filtered = DataTypes.map(group => {
                return { ...group, options: group.options.filter(option => dataTypes.includes(option.type))}
            })
            return filtered.filter(group => group.options.length)
        }
        return DataTypes;
    }

    const DataTypeSelect = function(props) {
        const { type, dataTypes, ...rest } = props;
        const groups = transformOptions(dataTypes)

        return (
            <select value={type || ''} {...rest} className="form-control">
                <option value="">{i18n('ontology.property.dataformat.placeholder')}</option>
                {
                    groups.map(group => (
                        <optgroup key={group.label} label={group.label}>
                            {
                                group.options.map(option => {
                                    const { type, displayType, label } = option;
                                    const combined = _.compact([type, displayType]).join('|');
                                    return (
                                        <option key={combined} value={combined}>{label}</option>
                                    )
                                })
                            }
                        </optgroup>
                    ))
                }
            </select>
        )
    }

    const PropertyForm = createReactClass({
        propTypes: {
            transformForSubmit: PropTypes.func.isRequired,
            transformForInput: PropTypes.func.isRequired,
            onCreate: PropTypes.func.isRequired,
            onCancel: PropTypes.func.isRequired,
            displayName: PropTypes.string,
            domain: PropTypes.string,
            type: PropTypes.string,
            dataType: PropTypes.string,
            dataTypes: PropTypes.arrayOf(PropTypes.string)
        },
        getInitialState() {
            return {};
        },
        getValue() {
            const { displayName } = this.state;
            const { displayName: defaultValue } = this.props;
            return _.isString(displayName) ? displayName : defaultValue;
        },
        componentDidMount() {
            const { domain, type } = this.props;
            this.setState({ domain, type })
        },
        componentWillReceiveProps(nextProps) {
            if (nextProps.domain !== this.state.domain) {
                this.setState({ domain: this.props.domain })
            }
            if (nextProps.type !== this.state.type) {
                this.setState({ type: nextProps.type })
            }
        },
        render() {
            const { domain, type } = this.state;
            const { conceptId, relationshipId, dataType, dataTypes, error, transformForSubmit, transformForInput } = this.props;
            const value = this.getValue();
            const valueForInput = transformForInput(value);
            const { valid, reason, value: valueForSubmit } = transformForSubmit(value);
            const disabled = !valid || !type || !domain;
            const filterDataTypes = dataTypes ? dataTypes : dataType ? [dataType] : null;

            return (
                <div className="ontology-form">
                    { error ? (<Alert error={error} />) : null }

                    <div className='m-y-1'>
                        <input type="text"
                               placeholder={i18n('ontology.form.displayname.placeholder')}
                               onChange={this.onDisplayNameChange}
                               title={reason}
                               className={classNames('form-control', { invalid: !valid })}
                               value={valueForInput} />
                    </div>

                    <div className='m-y-1'>
                        { relationshipId ?
                            (<RelationshipSelector
                                value={domain}
                                creatable={false}
                                clearable={false}
                                filter={{ relationshipId, showAncestors: true }}
                                onSelected={this.onDomainSelected} />) :
                            (<ConceptsSelector
                                value={domain}
                                creatable={false}
                                clearable={false}
                                filter={{ conceptId, showAncestors: true }}
                                onSelected={this.onDomainSelected} />)
                        }
                    </div>

                    <div className='m-y-1'>
                        <DataTypeSelect type={type} dataTypes={filterDataTypes} onChange={this.handleTypeChange} />
                    </div>

                    <div className="btn-group-xs">
                        <button onClick={this.props.onCancel}
                                style={{ width: 'auto', marginBottom: '1em'}}
                                className="btn m-r-1">{i18n('ontology.form.cancel.button')}</button>

                        <button disabled={disabled}
                                onClick={this.onCreate}
                                style={{ width: 'auto', marginBottom: '1em'}}
                                className="btn btn-primary">{
                            disabled ?
                                i18n('ontology.form.create.button') :
                                i18n('ontology.form.create.value.button', valueForSubmit)
                        }</button>
                    </div>
                </div>
            )
        },
        onDomainSelected(option) {
            this.setState({ domain: option ? option.title : null })
        },
        onDisplayNameChange(event) {
            this.setState({ displayName: event.target.value })
        },
        handleTypeChange(event) {
            this.setState({ type: event.target.value });
        },
        onCreate() {
            const domain = {};
            if (this.props.relationshipId) {
                domain.relationshipIris = [this.state.domain];
            } else {
                domain.conceptIris = [this.state.domain];
            }
            const [dataType, displayType] = this.state.type.split('|');

            this.props.onCreate({
                domain,
                dataType,
                displayType,
                displayName: this.getValue()
            })
        }
    });

    return PropertyForm;
});
