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
    'util/withTeardown',
    'util/promise'
], function(withTeardown, Promise) {
    'use strict';

    var ENTER = 13;

    return function() {

        withTeardown.call(this);

        this.defaultAttrs({
            inputSelector: 'input,textarea,select',
            value: '',
            composite: false,
            newProperty: false
        });

        this.after('teardown', function() {
            var inputs = this.select('visibleInputsSelector');
            inputs.tooltip('destroy');
            this.$node.empty();
        });


        this.before('initialize', function(node, config) {
            config.placeholder = config.onlySearchable ? (
                    i18n(true, 'field.' + config.property.dataType + '.displaytype.' + config.property.displayType + '.placeholder') ||
                    i18n(true, 'field.' + config.property.dataType + '.placeholder') ||
                    config.property.displayName
                ) : config.property.displayName;
        });

        this.after('initialize', function() {
            var self = this;

            if (this.attr.preventChangeHandler !== true) {
                this.on('change keyup', {
                    inputSelector: function(event) {
                        if (event.type === 'change' || event.which === ENTER) {
                            this.triggerFieldUpdated();
                        }
                    }
                });
            }

            this.on('input', this.onInput);
            this.on('focusPropertyField', function() {
                _.defer(function() {
                    self.select('inputSelector').eq(0).focus().select();
                })
            });

            if (!_.isFunction(this.getValue)) {
                throw new Error('getValue is required function for fields');
            }

            if (!_.isFunction(this.setValue)) {
                throw new Error('setValue is required function for fields');
            }

            this.on('fieldRendered', function handler() {
                this.off('fieldRendered', handler);
                rendered();
            });

            this.on('setValue', function(event, value) {
                event.stopPropagation();
                this.setValue(value);
            });

            if (this.attr.asyncRender !== true) {
                this.trigger('fieldRendered');
            }

            function rendered() {
                var inputs = self.select('inputSelector'),
                    inputsNoSelects = inputs.not('select');

                self.$node.find('input:not([type=checkbox])').each(function() {
                    var $this = $(this);
                    if ($this.data('optional') !== true && self.attr.composite !== true) {
                        $this.attr('required', true)
                    }
                });

                if (inputsNoSelects.length && self.attr.tooltip && self.attr.disableTooltip !== true) {
                    var delayedShow = _.debounce(function() {
                            inputsNoSelects.eq(0).tooltip('show');
                        }, 1000),
                        delayedTimer,
                        hide = function() {
                            clearTimeout(delayedTimer);
                            var tooltip = inputsNoSelects.eq(0).data('bs.tooltip');
                            if (tooltip) {
                                if (tooltip.tip().is(':visible')) {
                                    tooltip.hide();
                                    delayedTimer = delayedShow();
                                }
                            }
                        };

                    inputsNoSelects.eq(0)
                        .tooltip($.extend({ container: 'body' }, self.attr.tooltip))
                        .data('bs.tooltip').tip().addClass('field-tooltip');
                    inputsNoSelects.eq(0).one('shown', function() {
                        $(this).scrollParent().on('scroll', hide);
                    })
                }

                if (self.attr.focus !== false) {
                    _.defer(function() {
                        inputs.eq(0).focus().select();
                    })
                }

                Promise.resolve(self.setValue(self.attr.value))
                    .then(function() {
                        self.triggerFieldUpdated();
                    });
            }
        });

        this.onInput = function(event, data) {
            this.fieldUpdated(this.getValue(), { fromEvent: 'input' });
        };

        this.triggerFieldUpdated = function() {
            this.fieldUpdated(this.getValue());
        };

        this.fieldUpdated = function(value, options) {
            var self = this,
                result;

            if (!_.isFunction(this.isValid) || (result = this.isValid(value))) {
                if (_.isFunction(result.then)) {
                    result.then(handle);
                } else {
                    handle(true);
                }
            } else if (result === false || (this._markedInvalid === undefined && self._previousValue)) {
                handle(false);
            } else {
                handle(true);
            }

            function handle(isValid) {
                var inputs = self.select('inputSelector');
                if (isValid) {
                    if (!self._previousValue || (self._previousValue && !_.isEqual(self._previousValue, value))) {
                        self.trigger('propertychange', {
                            propertyId: self.attr.property.title,
                            value: value,
                            metadata: _.isFunction(self.getMetadata) && self.getMetadata() || {},
                            options: options
                        });
                        if (!options || options.fromEvent !== 'input') {
                            self.setValue(value);
                        }
                    }
                    inputs.removeClass('invalid');
                    self._previousValue = value;
                    self._markedInvalid = false;
                } else {
                    self._markedInvalid = true;
                    self.trigger('propertyinvalid', {
                        propertyId: self.attr.property.title
                    });
                    if (inputs.length === 1 && !self.attr.composite) {
                        inputs.addClass('invalid');
                    }
                    self._previousValue = null;
                }
            }
        };
    };
});
