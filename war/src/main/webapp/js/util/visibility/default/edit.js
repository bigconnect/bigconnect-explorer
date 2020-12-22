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
    'util/withDataRequest',
], function(defineComponent, withDataRequest) {
    'use strict';

    return defineComponent(DefaultEditor);

    /**
     * @typedef org.bigconnect.visibility~Editor
     * @property {string} [value] The visibility source to prepopulate the editor
     * @property {string} [placeholder] The placeholder text to display when no
     * value
     * @property {string} [readonly] Show the form in read-only mode
     * @listens org.bigconnect.visibility#visibilityclear
     * @fires org.bigconnect.visibility#visibilitychange
     */
    function DefaultEditor() {

        this.defaultAttrs({
            fieldSelector: 'select',
            placeholder: i18n('visibility.label')
        })

        this.after('initialize', function() {
            var self = this;

            var $visSelector = $('<select>')
                .attr("disabled", this.attr.readonly)
                .attr("class", "custom-select form-control");

            var $defaultOption = $('<option>')
                .text('Public')
                .val('')
                .prop('selected', 'selected');

            $visSelector.append($defaultOption);

            this.$node.html($visSelector);

            let selectedValue = $.trim(_.isUndefined(this.attr.value) ? '' : this.attr.value);

            withDataRequest.dataRequest('role', 'all')
                .done(function(roles) {
                    _.each(roles, role => {
                        let $option = $('<option>')
                            .text(role.roleName)
                            .val(role.roleName);

                        if(selectedValue === role.roleName)
                            $option.prop('selected', 'selected');

                        $visSelector.append($option);
                    });
                });

            this.on('visibilityclear', this.onClear);
            this.on('change keyup paste', {
                fieldSelector: this.onChange
            });

            this.onChange();
        });

        /**
         * Reset the form
         * @event org.bigconnect.visibility#visibilityclear
         */
        this.onClear = function(event, data) {
            this.select('fieldSelector').val('');
        };

        this.onChange = function(event, data) {
            var value = $.trim(this.select('fieldSelector').val());
            var valid = this.checkValid(value);
            /**
             * The user has adjusted the visibility so notify
             *
             * @event org.bigconnect.visibility#visibilitychange
             * @param {object} data
             * @param {string} data.value The new visibility value
             * @param {boolean} data.valid Whether the value is valid
             */
            this.trigger('visibilitychange', {
                value: value,
                valid: valid
            });
        };

        this.checkValid = function(value) {
            var visibilities = value.replace(/\(|\)/g, '').split(/\&|\|/g);
            var authorizations = bcData.currentUser.authorizations;

            return !value.length || !_.difference(visibilities, authorizations).length;
        };
    }
});
