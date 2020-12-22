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
    'components/ontology/RelationshipSelector',
    'components/justification/JustificationEditor',
    'components/visibility/VisibilityEditor',
    'util/vertex/formatters',
    'components/element/Element'
], function(
    createReactClass,
    PropTypes,
    classNames,
    Alert,
    RelationshipSelector,
    JustificationEditor,
    VisibilityEditor,
    F,
    Element) {

    const Relationship = createReactClass({
        propTypes: {
            onCancel: PropTypes.func.isRequired,
            onSave: PropTypes.func.isRequired,
            sourceVertexId: PropTypes.string.isRequired,
            targetVertexId: PropTypes.string.isRequired
        },
        getInitialState() {
            return {
                invert: false,
                visibility: { value: '', valid: true }
            };
        },
        render() {
            const { loading, error, onCancel, onSave, vertices, onFocusElements } = this.props;
            const { invert, relationshipId, justification = {}, visibility } = this.state;
            const { valid: justificationValid, value: justificationValues } = justification

            let { sourceVertexId, targetVertexId } = this.props;
            if (invert) {
                [sourceVertexId, targetVertexId] = [targetVertexId, sourceVertexId];
            }

            const sourceVertex = vertices[sourceVertexId];
            const targetVertex = vertices[targetVertexId];
            const sourceId = sourceVertex && F.vertex.prop(sourceVertex, 'conceptType')
            const targetId = targetVertex && F.vertex.prop(targetVertex, 'conceptType')

            return (
                <div className="form relationshipform">
                    { error ? (<Alert error={error} />) : null }

                    <h1>{i18n('detail.text.terms.form.relationship')}</h1>

                    <div className="rel-elements">
                        <p><Element element={sourceVertex} onFocusElements={onFocusElements} /></p>

                        <div className="rel-arrow-wrap">
                            <div className="rel-arrow"></div>
                            <button
                                title={i18n('detail.text.terms.form.relationship.invert.tooltip')}
                                onClick={this.onInvert}
                                className="invert btn btn-link btm-mini"
                            >{ i18n('detail.text.terms.form.relationship.invert')}</button>
                        </div>

                        <p><Element element={targetVertex} onFocusElements={onFocusElements} /></p>
                    </div>

                    <RelationshipSelector
                        onSelected={this.onSelected}
                        disabled={!sourceId || !targetId}
                        value={relationshipId}
                        filter={{ sourceId, targetId }} />

                    <JustificationEditor
                        value={justificationValues}
                        onJustificationChanged={this.onJustificationChanged} />

                    <VisibilityEditor
                        value={visibility && visibility.value}
                        onVisibilityChanged={this.onVisibilityChanged} />

                    <div className="buttons">
                        <button onClick={onCancel} className="btn btn-link btn-small">{i18n('detail.text.terms.form.cancel')}</button>
                        <button
                            disabled={loading || !this.isValid()}
                            onClick={this.onSave}
                            className={classNames('btn-primary btn btn-small', {loading})}>{i18n('detail.text.terms.form.create')}</button>
                    </div>
                </div>
            )
        },
        onInvert() {
            const { invert } = this.state;
            this.setState({ invert: !invert, relationshipId: null })
        },
        onJustificationChanged(justification) {
            this.setState({ justification })
        },
        onVisibilityChanged(visibility) {
            this.setState({ visibility })
        },
        onSelected(relationship) {
            this.setState({ relationshipId: relationship ? relationship.title : null });
        },
        onSave() {
            const { invert, relationshipId, justification, visibility } = this.state;

            let { sourceVertexId, targetVertexId } = this.props;
            if (invert) {
                [sourceVertexId, targetVertexId] = [targetVertexId, sourceVertexId];
            }

            this.props.onSave({
                outVertexId: sourceVertexId,
                inVertexId: targetVertexId,
                predicateLabel: relationshipId,
                visibilitySource: visibility.value,
                ...justification.value
            })
        },
        isValid() {
            const { relationshipId, justification, visibility } = this.state;
            const others = _.all([justification, visibility], o => o && o.valid);
            return relationshipId && others;
        }
    });

    return Relationship;
});
