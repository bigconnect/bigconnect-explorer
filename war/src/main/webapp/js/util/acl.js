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
    'util/withDataRequest'
], function(withDataRequest) {
    'use strict';

    const ACL_ALLOW_ALL = {
        addable: true,
        updateable: true,
        deleteable: true
    };

    return {
        getPropertyAcls: function(element) {
            const elements = Array.isArray(element) ? element : [element];

            return Promise.map(elements, (element) => {
                    let propertiesPromise = [];

                    if (element.type === 'vertex') {
                        propertiesPromise = withDataRequest.dataRequest('ontology', 'propertiesByConceptId', element.conceptType);
                    } else {
                        propertiesPromise = withDataRequest.dataRequest('ontology', 'propertiesByRelationship', element.label);
                    }

                    return propertiesPromise;
                })
                .then((elementsProperties) => {
                    const ontologyProperties = _.chain(elementsProperties)
                        .map((properties) => properties.list)
                        .flatten()
                        .uniq((p) => p.title)
                        .value();

                    return mergeElementPropertyAcls(
                        ontologyPropertiesToAclProperties(ontologyProperties)
                    );
                })

            function ontologyPropertiesToAclProperties(properties) {
                return properties.map(function(property) {
                    return {
                        key: null,
                        name: property.title,
                        addable: property.addable,
                        updateable: property.updateable,
                        deleteable: property.deleteable
                    };
                });
            }

            function mergeElementPropertyAcls(propertyAcls) {
                elements.forEach(function (e) {
                    e.acl.propertyAcls.forEach(function (elementPropertyAcl) {
                        var matchIndex = propertyAcls.findIndex((p) => {
                            let key = elementPropertyAcl.key || null;
                            return p.name === elementPropertyAcl.name && p.key === key;
                        });
                        if (matchIndex < 0) {
                            propertyAcls.push(elementPropertyAcl);
                        } else {
                            propertyAcls[matchIndex] = _.extend(propertyAcls[matchIndex], elementPropertyAcl);
                        }
                    });
                });

                return propertyAcls;
            }
        },

        findPropertyAcl: function(propertiesAcl, propName, propKey) {
            var props = _.where(propertiesAcl, {name: propName, key: propKey});
            if (props.length === 0) {
                var propsByName = _.where(propertiesAcl, { name: propName, key: null });
                if (propsByName.length === 0) {
                    propsByName.push({ name: propName, key: propKey, ...ACL_ALLOW_ALL });
                }
                props = propsByName;
            }
            if (props.length !== 1) {
                throw new Error('more than one ACL property with the same name defined "' + propName + ':' + propKey + '" length: ' + props.length);
            }
            return props[0];
        }
    };
});
