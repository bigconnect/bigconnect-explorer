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
    'util/withFormFieldErrors',
    './profile.hbs',
    'tpl!util/alert'
], function(
    defineComponent,
    withFormFieldErrors,
    template,
    alertTemplate) {
    'use strict';

    return defineComponent(Profile, withFormFieldErrors);

    function Profile() {
        this.defaultAttrs({
            buttonSelector: 'button.btn-primary',
            inputSelector: 'input'
        });

        this.after('initialize', function() {
            this.on('click', {
                buttonSelector: this.onChange
            });
            this.on('change keyup', {
                inputSelector: this.validateEmail
            });

            this.$node.html(template({
                email: bcData.currentUser.email
            }));
            this.validateEmail();
        });

        this.validateEmail = function(event) {
            var inputs = this.select('inputSelector'),
                anyInvalid = inputs.filter(function(i, input) {
                    return input.validity && !input.validity.valid;
                }).length;

            if (anyInvalid) {
                this.select('buttonSelector').attr('disabled', true);
            } else {
                this.select('buttonSelector').removeAttr('disabled');
            }
        };

        this.onChange = function(event) {
            var self = this,
                btn = $(event.target).addClass('loading').attr('disabled', true),
                newEmail = this.$node.find('#emailInput').val();

            this.clearFieldErrors(this.$node);
            this.$node.find('.alert-info').remove();

            $.post('/user/changeProfile', {
                email: newEmail,
                currentPassword: this.$node.find('#currPasswordInput').val(),
                newPassword: this.$node.find('#newPassInput').val(),
                newPasswordConfirmation: this.$node.find('#newPassConfirmInput').val(),
                csrfToken: bcData.currentUser.csrfToken
            })
                .always(function() {
                    btn.removeClass('loading').removeAttr('disabled');
                })
                .fail(function(e) {
                    self.markFieldErrors(e && e.responseText || e, self.$node);
                })
                .done(function() {
                    bcData.currentUser.email = newEmail;
                    self.$node.prepend(alertTemplate({
                        message: i18n('useraccount.page.profile.success')
                    }));
                })
        };
    }
});
