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
    'react-dom',
    'prop-types',
    'create-react-class',
    'react-redux',
    'util/requirejs/promise!util/service/ontologyPromise',
    '../../components/Wizard',
    './wizard/DataSourceForm',
    './wizard/DataSourcePreview',
    './wizard/DataSourceMapping',
    './wizard/DataSourceImportConfig',
    './wizard/DataSourceMappingReview',
    './wizard/DataSourceMappingComplete'
], function(
    React,
    ReactDOM,
    PropTypes,
    createReactClass,
    redux,
    ontologyPromise,
    Wizard,
    DataSourceForm,
    DataSourcePreview,
    DataSourceMapping,
    DataSourceImportConfig,
    DataSourceMappingReview,
    DataSourceMappingComplete
) {
    'use strict';

    const DataSourceWizard = createReactClass({
        propTypes: {
            changeAppMode: PropTypes.func.isRequired,
            dsData: PropTypes.object,
            dcId: PropTypes.string,
            mode: PropTypes.string.isRequired,
        },

        componentWillMount() {
            this.wizardStore = {
                dsId: '',
                name: '',
                description: '',
                maxRecords: -1,
                sqlSelect: '',
                preview: null,
                entityMappings: null,
                relMappings: [],
                importConfig: {
                    jobId: '',
                    incremental: false,
                    incrementalMode: 'append',
                    checkColumn: '',
                    lastValue: '',
                    runNow: false,
                }
            };
        },

        componentWillReceiveProps(nextProps) {
            if(nextProps.dsData) {
                this.wizardStore = {
                    ...nextProps.dsData,
                    entityMappings: nextProps.dsData.entityMappings.map(em => {
                        em.colConcept = ontologyPromise.concepts.byId[em.colConcept];
                        return em;
                    }),
                    relMappings: nextProps.dsData.relMappings.map(rm => {
                        rm.rel = ontologyPromise.relationships.byId[rm.rel];
                        return rm;
                    }),
                    preview: null
                };
            }
        },

        getStore() {
            return this.wizardStore;
        },

        updateStore(update) {
            this.wizardStore = {
                ...this.wizardStore,
                ...update,
            }
        },

        cancelWizard() {
            this.props.changeAppMode('list');
        },

        render() {
            const steps = [
                {name: 'Data Source', component: <DataSourceForm changeAppMode={this.props.changeAppMode} getStore={() => (this.getStore())} updateStore={(u) => {this.updateStore(u)}} {...this.props} />},
                {name: 'Preview', component: <DataSourcePreview changeAppMode={this.props.changeAppMode} getStore={() => (this.getStore())} updateStore={(u) => {this.updateStore(u)}} {...this.props} />},
                {name: 'Mapping', component: <DataSourceMapping  changeAppMode={this.props.changeAppMode} getStore={() => (this.getStore())} updateStore={(u) => {this.updateStore(u)}} {...this.props} />},
                {name: 'Settings', component: <DataSourceImportConfig  changeAppMode={this.props.changeAppMode} getStore={() => (this.getStore())} updateStore={(u) => {this.updateStore(u)}} {...this.props} />},
                {name: 'Review', component: <DataSourceMappingReview  changeAppMode={this.props.changeAppMode} getStore={() => (this.getStore())} updateStore={(u) => {this.updateStore(u)}} {...this.props} />},
                {name: 'Complete', component: <DataSourceMappingComplete  changeAppMode={this.props.changeAppMode} getStore={() => (this.getStore())} updateStore={(u) => {this.updateStore(u)}} {...this.props} />}
            ];

            return (
                <div className='mapping-wizard panel'>
                    <div className='panel-body'>
                        <Wizard
                            steps={steps}
                            preventEnterSubmission={true}
                            nextTextOnFinalActionStep={"Save"}
                            prevBtnOnLastStep={false}
                            nextButtonText={"Next"}
                            backButtonText={"Back"}
                            cancelWizard={this.cancelWizard}
                        />
                    </div>
                </div>
            );
        }
    });

    return DataSourceWizard;
});
