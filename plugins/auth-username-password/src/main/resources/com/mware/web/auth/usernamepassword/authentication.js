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
    './templates/login.hbs'
], function(
    defineComponent,
    template) {
    'use strict';

    return defineComponent(UserNameAndPasswordAuthentication);

    function UserNameAndPasswordAuthentication() {

        this.defaultAttrs({
            errorSelector: '.text-error',
            usernameSelector: '#username',
            resetUsernameSelector: '.forgot input.username',
            passwordSelector: '#password',
            loginButtonSelector: '.login .btn-info',
            resetButtonSelector: '.forgot .btn-primary',
            forgotButtonSelector: '.forgotPassword',
            signInButtonSelector: '.signin',
            loginFormSelector: '.login',
            forgotFormSelector: '.forgot'
        });

        this.after('initialize', function() {
            var self = this;

            this.$node.html(template(this.attr));
            this.enableButton(false);

            this.on('click', {
                loginButtonSelector: this.onLoginButton,
                resetButtonSelector: this.onResetButton,
                forgotButtonSelector: this.onForgotButton,
                signInButtonSelector: this.onSignInButton
            });

            this.on('keyup change paste', {
                usernameSelector: this.onUsernameChange,
                resetUsernameSelector: this.onResetUsernameChange,
                passwordSelector: this.onPasswordChange
            });

            this.select('usernameSelector').focus();

            require(['util/withDataRequest'], function(withDataRequest) {
                withDataRequest.dataRequest('config', 'properties')
                    .done(function(properties) {
                        if (properties['forgotPassword.enabled'] === 'true') {
                            self.$node.find('.forgotPassword').show();
                        }
                    });
            });
        });

        this.onSignInButton = function(event) {
            event.preventDefault();
            this.select('forgotFormSelector').hide();

            var form = this.select('loginFormSelector').show();
            _.defer(function() {
                form.find('input').eq(0).focus();
            });
        };

        this.onForgotButton = function(event) {
            var self = this;

            event.preventDefault();

            this.select('loginFormSelector').hide();

            var form = this.select('forgotFormSelector').show(),
                username = this.$node.find('.login .username').val() || '';
            _.defer(function() {
                form.find('input').eq(0).val(username).focus();
                self.checkValid();
            });
        };

        this.checkValid = function() {
            var self = this,
                user = this.select('usernameSelector'),
                resetUser = this.select('resetUsernameSelector'),
                pass = this.select('passwordSelector');

            user.closest('label').toggleClass('filled', ($.trim(user.val()).length > 0));
            pass.closest('label').toggleClass('filled', ($.trim(pass.val()).length > 0));
            
            _.defer(function() {
                self.enableButton(
                    $.trim(user.val()).length > 0 &&
                    $.trim(pass.val()).length > 0
                );
                self.enableResetButton($.trim(resetUser.val()).length > 0);
            });
        };

        this.onUsernameChange = function(event) {
            this.checkValid();
        };

        this.onResetUsernameChange = function(event) {
            this.checkValid();
        };

        this.onPasswordChange = function(event) {
            this.checkValid();
        };

        this.onResetButton = function(event) {
            event.preventDefault();

            var self = this,
                user = this.select('resetUsernameSelector');

            this.enableResetButton(false, true);
            this.$node.find('.text-error,.text-info').empty();
            Promise.resolve($.post('forgotPassword/requestToken', {
                username: user.val()
            }))
                .finally(function() {
                    self.enableResetButton(true, false);
                    self.checkValid();
                })
                .then(function() {
                    user.val('');
                    self.$node.find('.text-info').text('Sent password reset token to email');
                    self.checkValid();
                })
                .catch(function(e) {
                    var responseText = e.responseText,
                        error;

                    if (/^\s*{/.test(responseText)) {
                        try {
                            var json = JSON.parse(responseText);
                            error = json.username;
                        } catch(e2) { /*eslint no-empty:0 */ }
                    }

                    self.$node.find('.text-error').text(
                        error || 'Unknown Server Error'
                    );
                });
        };

        this.onLoginButton = function(event) {
            var self = this,
                $error = this.select('errorSelector'),
                $username = this.select('usernameSelector'),
                $password = this.select('passwordSelector');

            event.preventDefault();
            event.stopPropagation();
            event.target.blur();

            if (this.submitting) {
                return;
            }

            this.enableButton(false, true);
            this.submitting = true;
            $error.empty();

            $.post('login', {
                username: $username.val(),
                password: $password.val()
            }).fail(function(xhr, status, error) {
                self.submitting = false;
                if (xhr.status === 403) {
                    error = 'Invalid Username / Password';
                }
                $error.text(error);
                self.enableButton(true);
            })
            .done(function() {
                self.trigger('loginSuccess');
            })
        };

        this.enableButton = function(enable, loading) {
            if (this.submitting) return;
            var button = this.select('loginButtonSelector');

            if (enable) {
                button.removeClass('loading').removeAttr('disabled');
            } else {
                button.toggleClass('loading', !!loading)
                    .attr('disabled', true);
            }
        }

        this.enableResetButton = function(enable, loading) {
            var button = this.select('resetButtonSelector');

            if (enable) {
                button.removeClass('loading').removeAttr('disabled');
            } else {
                button.toggleClass('loading', !!loading)
                    .attr('disabled', true);
            }
        }
    }

})
