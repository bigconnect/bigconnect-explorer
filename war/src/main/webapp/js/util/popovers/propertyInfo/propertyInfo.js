
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
    'flight/lib/component',
    '../withPopover',
    'util/vertex/formatters',
    'util/withDataRequest',
    'util/privileges',
    'util/visibility/view',
    'util/acl',
    'd3'
], function(
    defineComponent,
    withPopover,
    F,
    withDataRequest,
    Privileges,
    VisibilityViewer,
    acl,
    d3) {
    'use strict';

    return defineComponent(PropertyInfo, withPopover, withDataRequest);

    function PropertyInfo() {

        this.defaultAttrs({
            deleteButtonSelector: '.btn-danger',
            editButtonSelector: '.btn-edit',
            addButtonSelector: '.btn-add',
            searchButtonSelector: '.btn-search',
            replyButtonSelector: '.reply',
            justificationValueSelector: 'a'
        });

        this.before('teardown', function() {
            this.$node
                .find('.property-value')
                .add('.justificationValue')
                .teardownAllComponents();
        });

        this.before('initialize', function(node, config) {
            config.manualSetup = true;
        });

        this.after('initialize', function() {
            var self = this;

            this.setupConfig(this.attr);

            this.after('setupWithTemplate', function() {
                this.dataRequest('config', 'properties')
                    .done(function(config) {
                        var splitRegex = /\s*,\s*/,
                            metadataDisplay =
                                config['properties.metadata.propertyNamesDisplay'].split(splitRegex).map(i18n),
                            metadataType =
                                config['properties.metadata.propertyNamesType'].split(splitRegex);

                        self.metadataProperties =
                            config['properties.metadata.propertyNames'].split(splitRegex);

                        if (self.metadataProperties.length !== metadataDisplay.length ||
                            self.metadataProperties.length !== metadataType.length) {
                            throw new Error('Metadata properties must have display names and types');
                        }
                        self.metadataPropertiesDisplayMap = _.object(self.metadataProperties, metadataDisplay);
                        self.metadataPropertiesTypeMap = _.object(self.metadataProperties, metadataType);

                        self.on(self.popover, 'click', {
                            deleteButtonSelector: self.onDelete,
                            editButtonSelector: self.onEdit,
                            addButtonSelector: self.onAdd,
                            searchButtonSelector: self.onSearch,
                            replyButtonSelector: self.onReply,
                            justificationValueSelector: self.teardown
                        });

                        self.contentRoot = d3.select(self.popover.get(0))
                            .select('.popover-content');
                        self.update();

                        self.on(document, 'verticesUpdated', self.onVerticesUpdated);
                        self.on(document, 'escape', self.onEscapeKey);
                    });
            });
        });

        this.setupConfig = function(config) {
            config.template = 'propertyInfo/template';
            config.isFullscreen = bcData.isFullscreen;

            acl.getPropertyAcls(config.data)
                .then((propertyAcls) => {
                    if (config.property) {
                        config.isComment = config.property.name === ONTOLOGY_CONSTANTS.PROP_COMMENT_ENTRY;
                        config.isVisibility = config.property.name === ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON;
                        config.canAdd = config.canEdit = config.canDelete = false;

                        var propertyAcl = config.isVisibility ? config.ontologyProperty :
                            acl.findPropertyAcl(propertyAcls, config.property.name, config.property.key);

                        if (config.isComment && bcData.currentWorkspaceCommentable) {
                            config.canAdd = config.property.addable !== undefined ? config.property.addable !== false : propertyAcl.addable !== false;
                            config.canEdit = config.property.updateable !== undefined ? config.property.updateable !== false : propertyAcl.updateable !== false;
                            config.canDelete = config.property.deleteable !== undefined ? config.property.deleteable !== false : propertyAcl.deleteable !== false;
                        } else if (!config.isComment && bcData.currentWorkspaceEditable) {
                            config.canAdd = config.property.addable !== undefined ? config.property.addable !== false : propertyAcl.addable !== false;
                            if (config.isVisibility) {
                                // Only users with PUBLISH privilege can edit the element visibility
                                config.canEdit = Boolean(bcData.currentUser.privilegesHelper.PUBLISH);
                            } else {
                                config.canEdit = config.property.updateable !== undefined ? config.property.updateable !== false : propertyAcl.updateable !== false;
                            }
                            config.canDelete = (config.property.deleteable !== undefined ? config.property.deleteable !== false : propertyAcl.deleteable !== false) &&
                                !config.isVisibility;
                        }

                        var isCompoundField = config.ontologyProperty && config.ontologyProperty.dependentPropertyIris &&
                            config.ontologyProperty.dependentPropertyIris.length;

                        config.canSearch = config.ontologyProperty &&
                            (config.ontologyProperty.searchable || isCompoundField) &&
                            !config.isFullscreen;

                        if (config.property.streamingPropertyValue) {
                            config.canAdd = config.canDelete = config.canSearch = false;
                        }

                    }

                    config.hideDialog = true;

                    this.attr.finishSetup();
                });
        };

        this.onEscapeKey = function() {
            this.teardown();
        };

        this.update = function() {
            var self = this,
                element = this.attr.data,
                isVisibility = this.attr.property.name === ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON,
                property = isVisibility ?
                    _.first(F.vertex.props(this.attr.data, this.attr.property.name)) :
                    _.first(F.vertex.props(this.attr.data, this.attr.property.name, this.attr.property.key)),
                positionDialog = this.positionDialog.bind(this),
                displayNames = this.metadataPropertiesDisplayMap,
                displayTypes = this.metadataPropertiesTypeMap,
                isComment = property.name === ONTOLOGY_CONSTANTS.PROP_COMMENT_ENTRY,
                metadata = _.chain(this.metadataProperties || [])
                    .map(function(name) {
                        if (isVisibility) {
                            var prop = _.first(F.vertex.props(element, name));
                            if (prop) {
                                return [name, prop.value];
                            }
                        } else if ('metadata' in property) {
                            if (name in property.metadata) {
                                return [name, property.metadata[name]];
                            }
                        }
                        if (name in property) {
                            return [name, property[name]];
                        }
                    })
                    .compact()
                    .filter(function(m) {
                        if (property.name === ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON &&
                            m[0] === 'sandboxStatus') {
                            return false;
                        }
                        if (isComment) {
                            return false;
                        }
                        return true;
                    })
                    .tap(function(metadata) {
                        if (property.streamingPropertyValue) {
                            var key = ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON;
                            metadata.push([key, property.metadata && property.metadata[key]]);
                            displayNames[key] = i18n('visibility.label');
                            displayTypes[key] = 'visibility';
                        }
                    })
                    .value(),
                row = this.contentRoot.select('table')
                    .selectAll('tr')
                    .data(metadata)
                    .call(function() {
                        this.enter()
                            .append('tr')
                            .call(function() {
                                this.append('td').attr('class', 'property-name');
                                this.append('td').attr('class', 'property-value');
                            });
                    });

            this.contentRoot.selectAll('tr')
                .call(function() {
                    this.select('td.property-name').text(function(d) {
                        return displayNames[d[0]];
                    });

                    this.select('td.property-value')
                        .each(function(d) {
                            var self = this,
                                typeName = displayTypes[d[0]],
                                formatter = F.vertex.metadata[typeName],
                                formatterAsync = F.vertex.metadata[typeName + 'Async'],
                                value = d[1];

                            if (formatter) {
                                formatter(self, value);
                            } else if (formatterAsync) {
                                formatterAsync(self, value, property, element.id)
                                    .catch(function() {
                                        d3.select(self).text(i18n('popovers.property_info.error', value));
                                    })
                                    .finally(positionDialog);
                                d3.select(this).text(i18n('popovers.property_info.loading'));
                            } else if (typeName === 'visibility') {
                                VisibilityViewer.attachTo(this, {
                                    value: value && value.source,
                                    property: property,
                                    element: element
                                });
                            } else {
                                d3.select(this).text(value);
                            }
                        });
                }).each(function(d) {
                    // Hide empty metadata
                    $(this).toggle($(this).find('.property-value').text() !== '');
                });

            // Justification
            var justification = [],
                justificationMetadata = property.metadata &&
                    property.metadata[ONTOLOGY_CONSTANTS.PROP_JUSTIFICATION];

            if (justificationMetadata && justificationMetadata.justificationText) {
                justification.push({
                    justificationText: justificationMetadata
                })
            }

            if (isVisibility) {
                var entityJustification = _.findWhere(this.attr.data.properties, { name: ONTOLOGY_CONSTANTS.PROP_JUSTIFICATION }),
                    sourceInfo = entityJustification && entityJustification.value;
                if (sourceInfo && 'justificationText' in sourceInfo) {
                    justification = [{ justificationText: sourceInfo }];
                } else {
                    justification = [];
                }
                this.renderJustification(justification);
                if (justification.length === 0) {
                    this.requestDetails().then(function(sourceInfo) {
                        if (sourceInfo) {
                            self.renderJustification([{ sourceInfo: sourceInfo }]);
                            positionDialog();
                        }
                    })
                }
            } else {
                this.renderJustification(justification);
                if ((!justificationMetadata || !('justificationText' in justificationMetadata))) {
                    this.dataRequest(
                        F.vertex.isVertex(element) ? 'vertex' : 'edge',
                        'propertyDetails',
                        this.attr.data.id,
                        property.name,
                        property.key,
                        property.metadata &&
                        property.metadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON] &&
                        property.metadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON].source
                    )
                        .then(function(propertyDetails) {
                            self.renderJustification(
                                (propertyDetails && propertyDetails.sourceInfo) ?
                                [{ sourceInfo: propertyDetails.sourceInfo }] : []
                            );
                        })
                        .catch(function() {
                            self.renderJustification([]);
                        })
                        .finally(positionDialog)
                }
            }

            row.exit().remove();

            this.dialog.show();
            positionDialog();
        };

        this.requestDetails = function() {
            var model = this.attr.data,
                service = F.vertex.isEdge(model) ? 'edge' : 'vertex';

            return this.dataRequest(service, 'details', model.id)
                .then(function(result) {
                    return result.sourceInfo;
                });
        };

        this.renderJustification = function(justification) {
            var self = this;

            this.contentRoot.selectAll('.justification')
                .data(justification)
                .call(function() {
                    this.enter()
                        .call(function() {
                            this.insert('div', '.buttons').attr('class', 'justification')
                                .call(function() {
                                    this.append('div')
                                        .attr('class', 'property-name property-justification')
                                        .text(i18n('popovers.property_info.justification'))
                                        .append('span').attr('class', 'badge')
                                    this.append('div')
                                        .attr('class', 'justificationValue');
                                });
                        });
                    this.exit().remove();

                    this.select('.property-justification .badge').classed('loading', function(j) {
                        return _.isEmpty(j);
                    })
                    this.select('.justificationValue').each(function(j) {
                        if (j.justificationText || j.sourceInfo) {
                            require(['util/vertex/justification/viewer'], function(JustificationViewer) {
                                $(this).teardownAllComponents();
                                JustificationViewer.attachTo(this, {
                                    justificationMetadata: j.justificationText,
                                    sourceMetadata: j.sourceInfo
                                });
                                self.positionDialog();
                            }.bind(this));
                        } else {
                            this.textContent = _.isEmpty(j) ?
                                '' :
                                i18n('popovers.property_info.justification.none');
                        }
                    })
                });
        }

        this.onVerticesUpdated = function(event, data) {
            var vertex = _.findWhere(data.vertices, {
                    id: this.attr.data.id
                }),
                property = vertex && _.findWhere(vertex.properties, {
                    name: this.attr.property.name,
                    key: this.attr.property.key
                });
            if (vertex && !property) {
                this.teardown();
            } else if (property) {
                this.attr.data = vertex;
                this.update();
            }
        };

        this.onReply = function() {
            var metadata = this.attr.property.metadata[ONTOLOGY_CONSTANTS.PROP_COMMENT_PATH],
                path = (metadata ? (metadata + '/') : '') + this.attr.property.key;

            this.trigger('editProperty', {
                path: path
            });
            this.teardown();
        };

        this.onSearch = function() {
            var element = this.attr.data,
                data = {};

            if (element.type === 'vertex') {
                var concept = F.vertex.concept(element);
                data.conceptId = concept && concept.id;
            } else if (element.type === 'edge') {
                data.edgeLabel = element.label
            } else {
                throw new Error('Unknown type', this.attr.data)
            }

            var trim = function(p) {
                return _.pick(p, 'name', 'value', 'values');
            };

            if (this.attr.property.compoundProperty) {
                data.properties = this.attr.property.values.map(trim);
            } else {
                data.property = trim(this.attr.property);
            }
            this.trigger('searchByProperty', data);
            this.teardown();
        };

        this.onAdd = function() {
            this.trigger('editProperty', {
                property: _.omit(this.attr.property, 'key')
            });
            this.teardown();
        };

        this.onEdit = function() {
            this.trigger('editProperty', {
                property: this.attr.property
            });
            this.teardown();
        };

        this.onDelete = function(e) {
            e.stopPropagation();
            var button = this.popover.find('.btn-danger').addClass('loading').prop('disabled', true);
            this.trigger('deleteProperty', {
                property: _.pick(this.attr.property, 'name', 'key')
            });
        };
    }
});
