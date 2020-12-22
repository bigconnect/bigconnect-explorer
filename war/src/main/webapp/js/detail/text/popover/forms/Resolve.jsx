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
    'components/Alert',
    'components/element/ElementSelector',
    'components/ontology/ConceptSelector',
    'components/justification/JustificationEditor',
    'components/visibility/VisibilityEditor',
    'util/vertex/formatters'
], function(
    createReactClass,
    PropTypes,
    classNames,
    Alert,
    ElementSelector,
    ConceptSelector,
    JustificationEditor,
    VisibilityEditor,
    F) {

    const DefaultVisibility = { value: '', valid: true };
    const Resolve = createReactClass({
        propTypes: {
            artifactId: PropTypes.string.isRequired,
            propertyKey: PropTypes.string.isRequired,
            propertyName: PropTypes.string.isRequired,
            mentionEnd: PropTypes.number.isRequired,
            mentionStart: PropTypes.number.isRequired,
            sign: PropTypes.string.isRequired,
            onCancel: PropTypes.func.isRequired,
            onResolve: PropTypes.func.isRequired,
            error: PropTypes.instanceOf(Error),
            loading: PropTypes.bool,
            resolvedFromTermMention: PropTypes.string,
            conceptType: PropTypes.string
        },
        getInitialState() {
            return {
                visibility: DefaultVisibility,
                conceptId: this.props.conceptType
            }
        },
        render() {
            const { onCancel, sign, conceptType, error, loading = false, ...rest } = this.props;
            const { resolvedVertexId, newElementText, conceptId, justification = {}, visibility } = this.state;
            const { valid: justificationValid, value: justificationValues } = justification

            return (
                <div className="form">
                    { error ? (<Alert error={error} />) : null }

                    <h1>{ resolvedVertexId ? i18n('detail.text.terms.form.resolve.existing') :
                        newElementText ? i18n('detail.text.terms.form.resolve.new') : i18n('detail.text.terms.form.resolve.search')}</h1>

                    <div className="m-t-1">
                        <ElementSelector
                            creatable
                            filterResultsToTitleField
                            searchOptions={{ matchType: 'vertex' }}
                            value={sign}
                            placeholder={i18n('detail.text.terms.form.resolve.placeholder')}
                            onElementSelected={this.onElementSelected}
                            onCreateNewElement={this.onCreateNewElement}
                            createNewRenderer={value => i18n('detail.text.terms.form.resolve.create', value)}
                            createNewValueRenderer={value => value } />
                    </div>
                    { (resolvedVertexId || newElementText) ? (
                        <div>
                            { !resolvedVertexId && newElementText ?
                                (<div className="m-t-1"> <ConceptSelector
                                    clearable={conceptId !== conceptType}
                                    onSelected={this.onConceptSelected}
                                    value={conceptId || conceptType || ''} /></div>) : null
                            }

                            <div className="m-t-1">
                                <JustificationEditor
                                    value={justificationValues}
                                    onJustificationChanged={this.onJustificationChanged}
                                />
                            </div>

                            { !resolvedVertexId ?
                                (<div className="m-t-1"><VisibilityEditor
                                    value={visibility && visibility.value}
                                    onVisibilityChanged={this.onVisibilityChanged} /></div>) : null
                            }
                        </div>
                    ) : null }
                    <div className="buttons m-t-1">
                        <button onClick={onCancel} className="btn btn-link btn-small">{i18n('detail.text.terms.form.cancel')}</button>
                        <button
                            disabled={loading || !this.isValid()}
                            onClick={this.onResolve}
                            className={classNames('btn-success btn btn-small', {loading})}>{i18n('detail.text.terms.form.resolve.button')}</button>
                    </div>
                </div>
            )
        },
        onResolve() {
            const {
                artifactId, propertyName, propertyKey,
                resolvedFromTermMention, sign: initialSign,
                mentionStart, mentionEnd
            } = this.props;

            const {
                resolvedVertexId, newElementText: sign,
                conceptId, justification, visibility
            } = this.state;

            this.props.onResolve({
                visibilitySource: visibility.value,
                artifactId,
                propertyName,
                propertyKey,
                resolvedFromTermMention,
                mentionStart,
                mentionEnd,
                ...justification.value,
                ...(resolvedVertexId ? { resolvedVertexId, sign: initialSign } : { sign, conceptId })
            })
        },
        onElementSelected(element) {
            this.setState({
                resolvedVertexId: element ? element.id : null,
                newElementText: null,
                visibility: DefaultVisibility
            })
        },
        onCreateNewElement(text) {
            this.setState({ newElementText: text, resolvedVertexId: null })
        },
        onConceptSelected(concept) {
            const { conceptType } = this.props;
            this.setState({ conceptId: concept ? concept.id : conceptType })
        },
        onJustificationChanged(justification) {
            this.setState({ justification })
        },
        onVisibilityChanged(visibility) {
            this.setState({ visibility })
        },
        isValid() {
            const { resolvedVertexId, newElementText, conceptId, justification, visibility } = this.state;
            const entity = resolvedVertexId || (newElementText && conceptId);
            const others = _.all([justification, visibility], o => o && o.valid);
            return entity && others;
        }
    });

    return Resolve;
});
