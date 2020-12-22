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
    'classnames',
    'prop-types',
    './ConceptSelector',
    '../field/GlyphSelector',
    '../field/ColorSelector',
    '../Alert'
], function(createReactClass,
    classNames,
    PropTypes,
    ConceptsSelector,
    GlyphSelector,
    ColorSelector,
    Alert) {

    const ConceptForm = createReactClass({
        propTypes: {
            transformForSubmit: PropTypes.func.isRequired,
            transformForInput: PropTypes.func.isRequired,
            onCreate: PropTypes.func.isRequired,
            onCancel: PropTypes.func.isRequired,
            displayName: PropTypes.string
        },
        getInitialState() {
            return {}
        },
        getValue() {
            const { displayName } = this.state;
            const { displayName: defaultValue } = this.props;
            return _.isString(displayName) ? displayName : defaultValue;
        },
        render() {
            const { transformForSubmit, transformForInput } = this.props;
            const { color } = this.state;
            const value = this.getValue();
            const valueForInput = transformForInput(value);
            const { valid, reason, value: valueForSubmit } = transformForSubmit(value);
            const disabled = !valid;
            return (
                <div className="ontology-form">
                    { this.props.error ? (<Alert error={this.props.error} />) : null }
                    <input type="text"
                           placeholder={i18n('ontology.form.displayname.placeholder')}
                           onChange={this.onDisplayNameChange}
                           title={reason}
                           className={classNames('form-control', { invalid: !valid })}
                           value={valueForInput} />

                    <div className='m-y-1'>
                        <ConceptsSelector
                            value={this.state.parentConcept}
                            placeholder={i18n('ontology.concept.inherit.placeholder')}
                            creatable={false}
                            onSelected={this.onConceptSelected} />
                    </div>

                    <div className='m-y-1'>
                        <ColorSelector value={color} onSelected={this.onColorSelected} />
                    </div>

                    <div className='m-y-1'>
                        <GlyphSelector
                            placeholder={i18n('ontology.concept.icon.placeholder')}
                            search={value}
                            onSelected={this.onIconSelected} />
                    </div>

                    <div className="btn-group-xs m-t-1 text-center">
                        <a onClick={this.props.onCancel}
                            className="btn btn-error m-r-1"
                            style={{ width: 'auto', marginBottom: '1em'}}>{i18n('ontology.form.cancel.button')}</a>
                        <a disabled={disabled}
                            onClick={this.onCreate}
                            className="btn btn-primary"
                            style={{ width: 'auto', marginBottom: '1em'}}>{
                                disabled ?
                                    i18n('ontology.form.create.button') :
                                    i18n('ontology.form.create.value.button', valueForSubmit)
                            }</a>
                    </div>
                </div>
            )
        },
        onColorSelected(color) {
            this.setState({ color })
        },
        onIconSelected(imgSrc) {
            this.setState({ imgSrc })
        },
        onConceptSelected(option) {
            const newState = { parentConcept: null, color: null };
            if (option) {
                newState.color = option.color;
                newState.parentConcept = option.title;
            }

            this.setState(newState);
        },
        onDisplayNameChange(event) {
            this.setState({ displayName: event.target.value })
        },
        onCreate() {
            const { parentConcept, color, imgSrc } = this.state;
            this.props.onCreate({
                parentConcept: parentConcept,
                displayName: this.getValue(),
                glyphIconHref: imgSrc,
                color: color || 'rgb(0,0,0)'
            })
        }
    });

    return ConceptForm;
});
