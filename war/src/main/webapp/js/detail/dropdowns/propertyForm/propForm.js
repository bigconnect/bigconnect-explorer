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
    'require',
    'flight/lib/component',
    'util/withDropdown',
    './propForm.hbs',
    'util/ontology/propertySelect',
    'tpl!util/alert',
    'util/withTeardown',
    'util/vertex/vertexSelect',
    'util/vertex/formatters',
    'util/withDataRequest'
], function(
    require,
    defineComponent,
    withDropdown,
    template,
    PropertySelector,
    alertTemplate,
    withTeardown,
    VertexSelector,
    F,
    withDataRequest
) {
    'use strict';

    return defineComponent(PropertyForm, withDropdown, withTeardown, withDataRequest);

    function PropertyForm() {

        this.defaultAttrs({
            propertyListSelector: '.property-list',
            saveButtonSelector: '.save-btn',
            deleteButtonSelector: '.delete-btn',
            configurationSelector: '.configuration',
            configurationFieldSelector: '.configuration input',
            previousValuesSelector: '.previous-values',
            previousValuesDropdownSelector: '.previous-values-container .dropdown-menu',
            vertexContainerSelector: '.vertex-select-container',
            visibilitySelector: '.visibility',
            justificationSelector: '.justification',
            visibilityInputSelector: '.visibility input',
            allowDeleteProperty: true,
            allowEditProperty: true
        });

        this.before('initialize', function(n, c) {
            c.manualOpen = true;
        });

        this.after('initialize', function() {
            var self = this,
                property = this.attr.property,
                vertex = this.attr.data;

            this.justification = {};
            this.modified = {};

            this.on('click', {
                saveButtonSelector: this.onSave,
                deleteButtonSelector: this.onDelete,
                previousValuesSelector: this.onPreviousValuesButtons
            });
            this.on('keyup keydown', {
                configurationFieldSelector: this.onKeyup,
                justificationSelector: this.onKeyup,
                visibilityInputSelector: this.onKeyup
            });

            this.on('propertyerror', this.onPropertyError);
            this.on('propertychange', this.onPropertyChange);
            this.on('propertyinvalid', this.onPropertyInvalid);
            this.on('propertyselected', this.onPropertySelected);
            this.on('visibilitychange', this.onVisibilityChange);
            this.on('justificationchange', this.onJustificationChange);
            this.on('paste', {
                configurationFieldSelector: _.debounce(this.onPaste.bind(this), 10)
            });
            this.on('click', {
                previousValuesDropdownSelector: this.onPreviousValuesDropdown
            });
            this.$node.html(template({
                property: property,
                vertex: vertex,
                loading: this.attr.loading
            }));

            this.select('saveButtonSelector').attr('disabled', true);
            this.select('deleteButtonSelector').hide();

            if (this.attr.property) {
                this.trigger('propertyselected', {
                    disablePreviousValuePrompt: true,
                    property: _.chain(property)
                        .pick('displayName key name value visibility metadata'.split(' '))
                        .extend({
                            title: property.name
                        })
                        .value()
                });
            } else if (!vertex) {
                this.on('vertexSelected', this.onVertexSelected);
                VertexSelector.attachTo(this.select('vertexContainerSelector'), {
                    value: '',
                    focus: true,
                    defaultText: i18n('vertex.field.placeholder')
                });
                this.manualOpen();
            } else {
                this.setupPropertySelectionField();
            }
        });

        this.setupPropertySelectionField = function() {
            const { label, conceptType } = this.attr.data;
            const filter = { addable: true };

            if (label) {
                filter.relationshipId = label
            } else if (conceptType) {
                filter.conceptId = conceptType;
            }

            const propertyNode = this.select('propertyListSelector').show();
            propertyNode.one('rendered', () => {
                this.on('opened', () => {
                    propertyNode.find('input').focus()
                })
                _.defer(() => {
                    this.manualOpen();
                })
            });

            PropertySelector.attachTo(propertyNode, {
                filter: {
                    conceptId: this.attr.data.conceptType,
                    relationshipId: this.attr.data.label,
                    addable: true,
                    userVisible: true
                },
                placeholder: i18n('property.form.field.selection.placeholder')
            });
        };

        this.onVertexSelected = function(event, data) {
            event.stopPropagation();

            if (data.vertex) {
                this.attr.data = data.vertex;
                this.setupPropertySelectionField();
            } else {
                this.select('propertyListSelector').hide();
            }
            this.trigger('propFormVertexChanged', data);
        };

        this.after('teardown', function() {
            this.select('visibilitySelector').teardownAllComponents();
            this.select('vertexContainerSelector').teardownComponent(VertexSelector);

            if (this.$node.closest('.buttons').length === 0) {
                this.$node.closest('tr').remove();
            }
        });

        this.onPaste = function(event) {
            var self = this,
                value = $(event.target).val();

            _.defer(function() {
                self.trigger(
                    self.select('justificationSelector'),
                    'valuepasted',
                    { value: value }
                );
            });
        };

        this.onPreviousValuesButtons = function(event) {
            var self = this,
                dropdown = this.select('previousValuesDropdownSelector'),
                buttons = this.select('previousValuesSelector').find('.active').removeClass('active'),
                action = $(event.target).closest('button').addClass('active').data('action');

            event.stopPropagation();
            event.preventDefault();

            if (action === 'add') {
                dropdown.hide();
                this.trigger('propertyselected', {
                    fromPreviousValuePrompt: true,
                    property: _.omit(this.currentProperty, 'value', 'key')
                });
            } else if (this.previousValues.length > 1) {
                this.trigger('propertyselected', {
                    property: _.omit(this.currentProperty, 'value', 'key')
                });

                dropdown.html(
                        this.previousValues.map(function(p, i) {
                            var visibility = p.metadata && p.metadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON];
                            return _.template(
                                '<li data-index="{i}">' +
                                    '<a href="#">{value}' +
                                        '<div data-visibility="{visibilityJson}" class="visibility"/>' +
                                    '</a>' +
                                '</li>')({
                                value: F.vertex.prop(self.attr.data, self.previousValuesPropertyName, p.key),
                                visibilityJson: JSON.stringify(visibility || {}),
                                i: i
                            });
                        }).join('')
                    ).show();

                require(['util/visibility/view'], function(Visibility) {
                    dropdown.find('.visibility').each(function() {
                        var value = $(this).data('visibility');
                        Visibility.attachTo(this, {
                            value: value && value.source
                        });
                    });
                });

            } else {
                dropdown.hide();
                this.trigger('propertyselected', {
                    fromPreviousValuePrompt: true,
                    property: $.extend({}, this.currentProperty, this.previousValues[0])
                });
            }
        };

        this.onPreviousValuesDropdown = function(event) {
            var li = $(event.target).closest('li'),
                index = li.data('index');

            this.$node.find('.previous-values .edit-previous').addClass('active');
            this.trigger('propertyselected', {
                fromPreviousValuePrompt: true,
                property: $.extend({}, this.currentProperty, this.previousValues[index])
            });
        };

        this.onPropertySelected = function(event, data) {
            var self = this,
                property = data.property,
                disablePreviousValuePrompt = data.disablePreviousValuePrompt,
                propertyName = property && property.title,
                config = self.select('configurationSelector'),
                visibility = self.select('visibilitySelector'),
                justification = self.select('justificationSelector');

            this.trigger('propFormPropertyChanged', data);

            if (!property) {
                config.hide();
                visibility.hide();
                justification.hide();
                return;
            } else {
                config.show();
            }

            this.currentProperty = property;
            this.$node.find('.errors').hide();

            config.teardownAllComponents();
            visibility.teardownAllComponents();
            justification.teardownAllComponents();

            var vertexProperty = property.title === ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON ?
                    _.first(F.vertex.props(this.attr.data, property.title)) :
                    !_.isUndefined(property.key) ?
                    _.first(F.vertex.props(this.attr.data, property.title, property.key)) :
                    undefined,
                previousValue = vertexProperty && vertexProperty.value,
                visibilityValue = vertexProperty &&
                    vertexProperty.metadata &&
                    vertexProperty.metadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON],
                sandboxStatus = vertexProperty && vertexProperty.sandboxStatus,
                isExistingProperty = typeof vertexProperty !== 'undefined',
                isEditingVisibility = propertyName === ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON || (
                    vertexProperty && vertexProperty.streamingPropertyValue
                ),
                previousValues = disablePreviousValuePrompt !== true && F.vertex.props(this.attr.data, propertyName),
                previousValuesUniquedByKey = previousValues && _.unique(previousValues, _.property('key')),
                previousValuesUniquedByKeyUpdateable = _.where(previousValuesUniquedByKey, {updateable: true});


            this.currentValue = this.attr.attemptToCoerceValue || previousValue;
            if (this.currentValue && _.isObject(this.currentValue) && ('latitude' in this.currentValue)) {
                this.currentValue = 'point(' + this.currentValue.latitude + ',' + this.currentValue.longitude + ')';
            }

            if (visibilityValue) {
                visibilityValue = visibilityValue.source;
                this.visibilitySource = { value: visibilityValue, valid: true };
            }

            if (property.name === ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON) {
                vertexProperty = property;
                isExistingProperty = true;
                previousValues = null;
                previousValuesUniquedByKey = null;
            }

            if (data.fromPreviousValuePrompt !== true && this.attr.allowEditProperty) {
                if (previousValuesUniquedByKeyUpdateable && previousValuesUniquedByKeyUpdateable.length) {
                    this.previousValues = previousValuesUniquedByKeyUpdateable;
                    this.previousValuesPropertyName = propertyName;
                    this.select('previousValuesSelector')
                        .show()
                        .find('.active').removeClass('active')
                        .addBack()
                        .find('.edit-previous span').text(previousValuesUniquedByKeyUpdateable.length)
                        .addBack()
                        .find('.edit-previous small').toggle(previousValuesUniquedByKeyUpdateable.length > 1);

                    this.select('justificationSelector').hide();
                    this.select('visibilitySelector').hide();
                    this.select('previousValuesDropdownSelector').hide();

                    return;
                } else {
                    this.select('previousValuesSelector').hide();
                }
            }

            this.select('previousValuesDropdownSelector').hide();
            this.select('justificationSelector').show();
            this.select('visibilitySelector').show();

            var deleteButton = this.select('deleteButtonSelector')
                .toggle(
                    !!isExistingProperty &&
                    !isEditingVisibility &&
                    this.attr.allowDeleteProperty
                );

            var button = this.select('saveButtonSelector')
                .text(isExistingProperty ? i18n('property.form.button.update') : i18n('property.form.button.add'));

            button.attr('disabled', true);

            this.dataRequest('ontology', 'properties').done(function(properties) {
                var propertyDetails = properties.byTitle[propertyName];
                if (!propertyDetails.deleteable) {
                    deleteButton.hide();
                }
                self.currentPropertyDetails = propertyDetails;
                if (propertyName === ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON) {
                    var val = vertexProperty && vertexProperty.value,
                        source = (val && val.source) || (val && val.value && val.value.source);
                    self.editVisibility(visibility, source);
                } else if (vertexProperty && vertexProperty.streamingPropertyValue && vertexProperty.metadata) {
                    var visibilityMetadata = vertexProperty.metadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON];
                    self.editVisibility(visibility, visibilityMetadata.source);
                } else if (propertyDetails) {
                    var isCompoundField = propertyDetails.dependentPropertyIris &&
                        propertyDetails.dependentPropertyIris.length,
                        dataType = propertyDetails.dataType,
                        fieldComponent;

                    if (isCompoundField) {
                        const dependentProperties = property.key ?
                            F.vertex.props(self.attr.data, propertyName, property.key) :
                            F.vertex.props(self.attr.data, propertyName);

                        self.currentValue = propertyDetails.dependentPropertyIris.map((iri) => {
                            let property = dependentProperties.find((property) => property.name === iri);
                            return property === undefined ? '' : property.value;
                        });
                        fieldComponent = 'fields/compound/compound';
                    } else if (propertyDetails.displayType === 'duration') {
                        fieldComponent = 'fields/duration';
                    } else if (dataType.endsWith('Array') || dataType === 'geopolygon' || dataType === 'georect' || dataType === 'geoline' || dataType === 'geocircle') {
                        fieldComponent = 'fields/string';
                    } else if (dataType === 'byte' || dataType === 'short' || dataType === 'char' || dataType === 'long' || dataType === 'integer') {
                        fieldComponent = 'fields/integer';
                    } else if (dataType === 'double' || dataType === 'float') {
                        fieldComponent = 'fields/double';
                    } else {
                        fieldComponent = propertyDetails.possibleValues ?
                            'fields/restrictValues' : 'fields/' + propertyDetails.dataType;
                    }

                    require([
                        fieldComponent,
                        'detail/dropdowns/propertyForm/justification',
                        'util/visibility/edit'
                    ], function(PropertyField, Justification, Visibility) {
                        if (self.attr.manualOpen) {
                            var $toHide = $()
                                .add(config)
                                .add(justification)
                                .add(visibility)
                                .hide();
                        }

                        Justification.attachTo(justification, {
                            justificationText: self.attr.justificationText,
                            sourceInfo: self.attr.sourceInfo
                        });

                        Visibility.attachTo(visibility, {
                            value: visibilityValue || ''
                        });

                        self.settingVisibility = false;
                        self.checkValid();
                        self.$node.find('configuration').hide();

                        self.on('fieldRendered', function() {
                            if ($toHide) {
                                $toHide.show();
                            }
                            self.manualOpen();
                        });
                        if (isCompoundField) {
                            PropertyField.attachTo(config, {
                                property: propertyDetails,
                                vertex: self.attr.data,
                                values: property.key !== undefined ?
                                    F.vertex.props(self.attr.data, propertyDetails.title, property.key) :
                                    null
                            });
                        } else {
                            PropertyField.attachTo(config, {
                                property: propertyDetails,
                                vertexProperty: vertexProperty,
                                value: self.attr.attemptToCoerceValue || previousValue,
                                tooltip: (!self.attr.sourceInfo && !self.attr.justificationText) ? {
                                    html: true,
                                    title:
                                        '<strong>' +
                                        i18n('justification.field.tooltip.title') +
                                        '</strong><br>' +
                                        i18n('justification.field.tooltip.subtitle'),
                                    placement: 'left',
                                    trigger: 'focus'
                                } : null
                            });
                        }
                        self.previousPropertyValue = self.getConfigurationValues();
                    });
                } else console.warn('Property ' + propertyName + ' not found in ontology');
            });
        };

        this.editVisibility = function(visibility, source) {
            var self = this;
            require(['util/visibility/edit'], function(Visibility) {
                Visibility.attachTo(visibility, {
                    value: source || ''
                });
                visibility.find('input').focus();
                self.settingVisibility = true;
                self.visibilitySource = { value: source || '', valid: true };

                self.checkValid();
                self.manualOpen();
            });
        }

        this.onVisibilityChange = function(event, data) {
            var self = this;

            this.select('visibilityInputSelector').toggleClass('invalid', !data.valid);
            this.visibilitySource = data;
            const metadata = this.currentProperty.metadata;
            this.modified.visibility = metadata && ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON in metadata ? visibilityModified() : !!this.visibilitySource.value;
            this.checkValid();

            function visibilityModified() {
                var currentVisibility = self.visibilitySource.value,
                    previousVisibility;
                if (self.currentProperty.title === ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON) {
                    previousVisibility = self.currentProperty.value.source;
                } else {
                    if(self.currentProperty.metadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON]) {
                        previousVisibility = self.currentProperty.metadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON].source;
                    } else {
                        previousVisibility = "";
                    }
                }

                if (!currentVisibility) {
                    return !!previousVisibility;
                } else {
                    return currentVisibility !== previousVisibility;
                }
            }
        };

        this.onJustificationChange = function(event, data) {
            var self = this;

            this.justification = data;
            this.checkValid();
        };

        this.onPropertyInvalid = function(event, data) {
            event.stopPropagation();

            this.propertyInvalid = true;
            this.checkValid();
        };

        this.checkValid = function() {
            if (this.settingVisibility) {
                this.valid = this.visibilitySource && this.visibilitySource.valid;
            } else {
                var valid = !this.propertyInvalid &&
                    (this.visibilitySource && this.visibilitySource.valid) &&
                    (!_.isEmpty(this.justification) ? this.justification.valid : true);
                var empty = _.reject(this.$node.find('.configuration input'), function(input) {
                    return !input.required || !!input.value;
                }).length > 0;

                this.valid = valid && !empty && _.some(this.modified);
            }

            if (this.valid) {
                this.select('saveButtonSelector').removeAttr('disabled');
            } else {
                this.select('saveButtonSelector').attr('disabled', true);
            }
        };

        this.onPropertyChange = function(event, data) {
            var self = this;

            this.propertyInvalid = false;
            event.stopPropagation();

            var isCompoundField = this.currentPropertyDetails.dependentPropertyIris,
                transformValue = function(valueArray) {
                    if (valueArray.length === 1) {
                        if (_.isObject(valueArray[0]) && ('latitude' in valueArray[0])) {
                            return JSON.stringify(valueArray[0])
                        }
                        return valueArray[0];
                    } else if (valueArray.length === 2) {
                        // Must be geoLocation
                        return 'point(' + valueArray.join(',') + ')';
                    } else if (valueArray.length === 3) {
                        return JSON.stringify({
                            description: valueArray[0],
                            latitude: valueArray[1],
                            longitude: valueArray[2]
                        });
                    }
                };

            if (isCompoundField) {
                this.currentValue = _.map(data.values, transformValue);
            } else {
                this.currentValue = data.value;
            }

            this.currentMetadata = data.metadata;
            this.modified.value = this.currentProperty.value ? valueModified() : !!this.currentValue;
            this.checkValid();


            function valueModified() {
                var previousValue = self.previousPropertyValue,
                    propertyValue = self.getConfigurationValues();

                if (previousValue !== undefined) {
                    return propertyValue !== previousValue;
                } else {
                    return !!propertyValue;
                }
            }
        };

        this.onPropertyError = function(event, data) {
            var messages = this.markFieldErrors(data.error);

            this.$node.find('.errors').html(
                alertTemplate({
                    error: messages
                })
            ).show();
            _.defer(this.clearLoading.bind(this));
        };

        this.getConfigurationValues = function() {
            var config = this.select('configurationSelector').lookupAllComponents().shift();

            return _.isFunction(config.getValue) ? config.getValue() : config.getValues();
        };

        this.onKeyup = function(evt) {
            const valid = evt.which === $.ui.keyCode.ENTER &&
                $(evt.target).is('.configuration *,.visibility *,.justification *');

            if (evt.type === 'keydown') {
                this._keydownValid = valid;
            } else if (this._keydownValid && valid) {
                this._keydownValid = false;
                this.onSave();
            }
        };

        this.onDelete = function() {
            _.defer(this.buttonLoading.bind(this, this.attr.deleteButtonSelector));
            this.trigger('deleteProperty', {
                vertexId: this.attr.data.id,
                property: _.pick(this.currentProperty, 'key', 'name'),
                node: this.node
            });
        };

        this.onSave = function(evt) {
            var self = this;

            if (!this.valid) return;

            var vertexId = this.attr.data.id,
                propertyKey = this.currentProperty.key,
                propertyName = this.currentProperty.title,
                value = this.currentValue,
                oldMetadata = this.currentProperty.metadata,
                { sourceInfo, justificationText } = this.justification,
                justification = sourceInfo ? { sourceInfo } : justificationText ? { justificationText } : {},
                oldVisibilitySource = oldMetadata && oldMetadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON]
                    ? oldMetadata[ONTOLOGY_CONSTANTS.PROP_VISIBILITY_JSON].source
                    : undefined;

            _.defer(this.buttonLoading.bind(this, this.attr.saveButtonSelector));

            this.$node.find('input').tooltip('hide');

            this.$node.find('.errors').hide();
            if (propertyName.length &&
                (
                    this.settingVisibility ||
                    (
                        (_.isString(value) && value.length) ||
                        _.isNumber(value) ||
                        value
                    )
                )) {

                this.trigger('addProperty', {
                    isEdge: F.vertex.isEdge(this.attr.data),
                    vertexId: this.attr.data.id,
                    element: this.attr.data,
                    property: {
                        key: propertyKey,
                        name: propertyName,
                        value: value,
                        visibilitySource: this.visibilitySource.value,
                        oldVisibilitySource: oldVisibilitySource,
                        metadata: this.currentMetadata,
                        ...justification
                    },
                    node: this.node
                });
            }
        };
    }
});
