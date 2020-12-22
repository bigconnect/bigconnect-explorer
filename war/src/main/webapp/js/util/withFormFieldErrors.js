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
define(['tpl!./alert'], function(alertTemplate) {
    'use strict';

    return withFormFieldErrors;

    function withFormFieldErrors() {

        this.clearFieldErrors = function(root) {
            $(root || this.$node).find('.errors').empty();
        };

        this.markFieldErrors = function(error, root) {
            var self = this,
                rootEl = root || this.$node,
                messages = [],
                cls = 'form-group error';

            rootEl.find('.form-group.error')
                .removeClass(cls);

            if (!error) {
                return;
            }

            if (error.json) {
                error = error.json;
            }

            try {
                if (_.isString(error)) {
                    error = JSON.parse(error);
                }
            } catch(e) { /*eslint no-empty:0 */ }

            if (_.isError(error)) {
                messages.push(error.message || i18n('bc.server.error'))
            } else if (_.isObject(error)) {
                _.keys(error).forEach(function(fieldName) {
                    switch (fieldName) {
                        case 'status': break;

                        case 'statusText':
                            messages.push(error[fieldName]);
                            break;

                        case 'invalidValues': break;

                        case 'visibilitySource':
                            rootEl.find('.visibility')
                                .each(function() {
                                    var $this = $(this),
                                        vis = $this.data('visibility')

                                    if (error.invalidValues && vis) {
                                        $this.toggleClass(cls,
                                             _.any(error.invalidValues, function(v) {
                                                 return _.isEqual(v, vis.value);
                                             })
                                        );
                                    } else {
                                        $this.addClass(cls);
                                    }
                                });
                            messages.push(error[fieldName]);
                        break;

                        default:
                            messages.push(error[fieldName]);
                            break;
                    }
                });
            } else if (_.isString(error) && error) {
                messages.push(error);
            }

            if (!messages.length) {
                messages.push('Unknown error')
            }

            var errorsContainer = rootEl.find('.errors');
            if (errorsContainer.length) {
                errorsContainer.html(
                    alertTemplate({
                        error: messages
                    })
                ).show();
            } else {
                console.warn(
                    'No <div class="errors"/> container found ' +
                    'to display error messages for component "' +
                    this.describe + '"'
                );
            }

            return messages;
        };
    }
});
