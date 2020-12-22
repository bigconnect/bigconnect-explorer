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
    'components/merge/MergeSelector',
    'components/ontology/ConceptSelector',
    'components/justification/JustificationEditor',
    'components/visibility/VisibilityEditor',
    'util/vertex/formatters',
    'public/v1/api'
], function(
    createReactClass,
    PropTypes,
    classNames,
    Alert,
    MergeSelector,
    ConceptSelector,
    JustificationEditor,
    VisibilityEditor,
    F,
    bcApi) {

    const ResolveMerge = createReactClass({
        onCancel() {
           this.props.onCancel();
        },
        componentWillMount() {
            this.dataRequest = this.props.bcApi.v1.dataRequest;
        },
        propTypes: {
            onMerge: PropTypes.func.isRequired,
            onCancel: PropTypes.func.isRequired,
            selectOptions: PropTypes.array,
            error: PropTypes.instanceOf(Error),
            loading: PropTypes.bool,
            conceptType: PropTypes.string,
            bcApi: PropTypes.object.isRequired
        },
        getInitialState() {
            return {
                visibility: { value: '', valid: true },
                conceptId: this.props.conceptType
            }
        },
        render() {
            const { conceptType, loading = false } = this.props;
            const selectOptions = this.props.selectOptions;
            const { canceled, resolvedVertexId, error, newElementText, conceptId, justification = {}, visibility } = this.state;
            const { valid: justificationValid, value: justificationValues } = justification
            const sign = "";

            return (
                <div className="form">
                    { error ? (<Alert error={error} />) : null }

                    <h1>{ resolvedVertexId ? i18n('form.merge.existing') :
                        newElementText ? i18n('form.merge.new') : i18n('form.merge.search')}</h1>
                    <MergeSelector
                        creatable
                        filterResultsToTitleField
                        searchOptions={{ matchType: 'vertex' }}
                        selectOptions={selectOptions}
                        value={sign}
                        placeholder={i18n('form.merge.placeholder')}
                        onElementSelected={this.onElementSelected}
                        onCreateNewElement={this.onCreateNewElement}
                        createNewRenderer={value => i18n('popovers.merge.form.resolve.create', value)}
                        createNewValueRenderer={value => value } />
                    { (resolvedVertexId || newElementText) ? (
                        <div>
                            { !resolvedVertexId && newElementText ?
                                (<ConceptSelector
                                    clearable={conceptId !== conceptType}
                                    onSelected={this.onConceptSelected}
                                    value={conceptId || conceptType || ''} />) : null
                            }

                            <JustificationEditor
                                value={justificationValues}
                                onJustificationChanged={this.onJustificationChanged}
                            />


                            <VisibilityEditor
                                value={visibility && visibility.value}
                                onVisibilityChanged={this.onVisibilityChanged} />
                        </div>
                    ) : null }
                    <div className="buttons">
                        <button onClick={this.onCancel} className="btn btn-link btn-small">{i18n('popovers.merge.button.cancel')}</button>
                        <button
                            disabled={loading || !this.isValid()}
                            onClick={this.onMerge}
                            className={classNames('btn-success btn btn-small', {loading})}>{i18n('popovers.merge.button.merge')}</button>
                    </div>
                </div>
            );
        },
        onMerge() {
            const {
                artifactId, propertyName, propertyKey,
                resolvedFromTermMention, sign: initialSign,
                mentionStart, mentionEnd
            } = this.props;

            const selectedIds = this.props.selectOptions.map ( vertex => vertex.id);

            const {
                resolvedVertexId, newElementText: sign,
                conceptId, justification, visibility
            } = this.state;

            parameters = {
                selectedIds: selectedIds,
                visibilitySource: visibility.value,
                artifactId,
                propertyName,
                propertyKey,
                resolvedFromTermMention,
                mentionStart,
                mentionEnd,
                ...justification.value,
                ...(resolvedVertexId ? { resolvedVertexId, sign: initialSign } : { sign, conceptId })
            };

            const self = this;

            bcApi.connect().then(({ dataRequest }) => {
                dataRequest('vertex', 'mergeVertex', parameters)
                .then((behaviour) => {
                    this.props.onCancel();
                })
                .catch((e) => {
                    console.log(e);
                    self.setState({error: e});
                })
            });

        },
        onElementSelected(element) {
            this.setState({ resolvedVertexId: element ? element.id : null, newElementText: null })
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

    return ResolveMerge;
});
