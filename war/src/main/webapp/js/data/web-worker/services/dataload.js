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

/**
 * Services for ingesting data
 *
 * @module services/dataload
 * @see module:util/withDataRequest
 */
define(['../util/ajax'], function(ajax) {
    'use strict';

    var trimEntityMappings = function(entityMappings) {
        // keep only the concept id
        return entityMappings && entityMappings.map(em => {
            let newColConcept = em.colConcept;

            if(em.colConcept && !_.isString(em.colConcept))
                newColConcept = em.colConcept.id;

            return {
                ...em,
                colConcept: newColConcept
            }
        })
    };

    var trimRelMappings = function(relMappings) {
        // keep only the relationship title
        return relMappings && relMappings.map(rm => {
            let newRel = rm.rel;

            if(rm.rel && !_.isString(rm.rel))
                newRel = rm.rel.title;

            return {
                ...rm,
                rel: newRel
            }
        });
    }

    var api = {
        getById: function(dcId) {
            return ajax('GET', '/dataload/id', {
                'dcId': dcId
            });
        },

        preview: function(dcId, sqlSelect) {
            return ajax('GET', '/dataload/preview', {
                'dcId': dcId,
                'sqlSelect': sqlSelect
            });
        },

        table: function(options) {
            return ajax(
                'GET',
                '/dataload/dcTable', options)
                .then(function(response) {
                    return response.dataConnections;
                })
        },

        addOrEdit: function(dc, mode) {
            return ajax('POST', '/dataload/addOrEdit', {
                id: dc.id,
                name: dc.name,
                description: dc.description,
                driverClass: dc.driverClass,
                driverProperties: dc.driverProperties,
                jdbcUrl: dc.jdbcUrl,
                username: dc.username,
                password: dc.password,
                mode: mode
            });
        },

        delete: function(params) {
            return ajax('GET', '/dataload/delete', {
                dcId: params.dcId,
                dsId: params.dsId
            });
        },

        saveDataSource: function(wizardStore) {
            return ajax('POST', '/dataload/saveds', {
                data: JSON.stringify({
                    dcId: wizardStore.dcId,
                    dsId: wizardStore.dsId,
                    name: wizardStore.name,
                    description: wizardStore.description,
                    maxRecords: wizardStore.maxRecords,
                    sqlSelect: wizardStore.sqlSelect,
                    entityMappings: trimEntityMappings(wizardStore.entityMappings) || [],
                    relMappings: trimRelMappings(wizardStore.relMappings) || [],
                    importConfig: wizardStore.importConfig
                })
            });
        },

        import: function(wizardStore) {
            return ajax('POST', '/dataload/import', {
                data: JSON.stringify({
                    dcId: wizardStore.dcId,
                    dsId: wizardStore.dsId,
                    name: wizardStore.name,
                    description: wizardStore.description,
                    maxRecords: wizardStore.maxRecords,
                    sqlSelect: wizardStore.sqlSelect,
                    entityMappings: trimEntityMappings(wizardStore.entityMappings)  || [],
                    relMappings: trimRelMappings(wizardStore.relMappings) || [],
                    importConfig: wizardStore.importConfig
                })
            });
        }
    };

    return api;
});
