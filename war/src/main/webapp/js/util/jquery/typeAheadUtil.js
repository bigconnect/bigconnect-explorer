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
], function() {
    'use strict';

    return {
        //
        // This function is meant to be applied to the Bootstrap typeahead component, in order to override its 'lookup'
        // function.
        //
        // Example:
        //     $(inputElement).typeahead({...}).data(('typeahead').lookup = TypeaheadUtil.allowEmptyLookup;
        //
        allowEmptyLookup: function() {
            var items;
            this.query = this.$element.val();

            // Remove !this.query check to allow empty values to open dropdown
            if (this.query.length < this.options.minLength) {
                return this.shown ? this.hide() : this;
            }

            items = $.isFunction(this.source) ? this.source(this.query, $.proxy(this.process, this)) : this.source;

            return items ? this.process(items) : this;
        },

        //
        // This function should be called on the input element to which the typeahead component is attached whenever
        // it's necessary to fix the position of the dropdown list, typically when the menu is invoked after scrolling
        // or resizing.
        //
        // Arguments:
        //    inputElement: the HTML input element on which the typeahead is attached
        //
        // Example:
        //     $(inputElement).typeahead({...}).on('click', function() {
        //         ...
        //         TypeaheadUtil.adjustDropdownPosition(inputElement);
        //     });
        //
        adjustDropdownPosition: function(inputElement) {
            // work-around a typeahead bug - https://github.com/twbs/bootstrap/issues/3529
            var $element = $(inputElement),
                pos = $.extend({}, $element.offset(), { height: $element[0].offsetHeight });

            $element.siblings('ul.typeahead').css({
                position: 'absolute',
                top: 0,
                left: 0
            }).offset({
                top: pos.top + pos.height,
                left: pos.left
            });
        },

        //
        // Call this function to clear an invalid value from the typeahead input element. The 'blur' event is an
        // appropriate time to call this.
        //
        // Arguments:
        //    inputElement: the HTML input element on which the typeahead is attached
        //    selectionDataKey: (optional) the data key on inputElement where the raw selection value is stored
        //    inputValueFromSelection: (optional) the function which converts the raw selection value to the
        //                             displayed inputElement value
        // Returns:
        //    true if the value was cleared, false otherwise
        //
        // Example:
        //    $(inputElement).typeahead({...}).on('blur', function() {
        //         TypeaheadUtil.clearIfNoMatch(inputElement, 'selection', displayValue);
        //     });
        //
        clearIfNoMatch: function(inputElement, selectionDataKey, inputValueFromSelection) {
            inputValueFromSelection = _.isFunction(inputValueFromSelection)
                ? inputValueFromSelection
                : function(selection) { return selection; };

            var $element = $(inputElement),
                selection = _.isString(selectionDataKey) ? $element.data(selectionDataKey) : null,
                value = $element.val(),
                cleared = false;

            if (selection && inputValueFromSelection(selection) !== value) {
                $element.removeData(selectionDataKey);
                $element.val('');
                cleared = true;
            } else {
                var lastMatches = _.map($element.next('ul.typeahead').children('li'), function(item) {
                    return $(item).data('value');
                });
                if (lastMatches.length > 0 && (lastMatches.indexOf(value) < 0) && lastMatches.indexOf(selection) < 0) {
                    $element.val('');
                    cleared = true;
                }
            }
            return cleared;
        }
    };
});
