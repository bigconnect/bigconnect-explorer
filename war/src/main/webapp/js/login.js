
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
    'loginTpl.hbs',
    'configuration/plugins/registry',
    'util/withDataRequest',
    'tpl!util/alert',
    'util/requirejs/promise!util/service/propertiesPromise'
], function(
    defineComponent,
    template,
    registry,
    withDataRequest,
    alertTemplate,
    configProperties) {
    'use strict';

   const LoginMessageKey = 'loginErrorMessage';
    const ExpireLoginErrorMessageMillis = 60 * 1000;

    const LoginComponent = defineComponent(Login, withDataRequest);

    LoginComponent.setErrorMessage = function(errorMessage) {
        try {
            if (errorMessage) {
                sessionStorage.setItem(LoginMessageKey, JSON.stringify({
                    errorMessage,
                    date: Date.now()
                }));
            } else {
                sessionStorage.removeItem(LoginMessageKey);
            }
        } catch(e) {
            console.warn('Unable to write to sessionStorage, can\'t set error message', e);
        }
    }

    return LoginComponent;

    function Login() {

        this.defaultAttrs({
            authenticationSelector: '.authentication-box-content'
        });

        this.before('teardown', function() {
            this.$node.remove();
        });

        this.after('initialize', function() {
            /**
             * Provide custom authentication interface to login users.
             *
             * _BigConnect Explorer will display an error if:_
             *
             * * No authentication plugins are registered
             * * More than one plugins are registered
             *
             * @param {string} componentPath {@link org.bigconnect.authentication~Component|Component} that renders the interface to login users
             */
            registry.documentExtensionPoint('org.bigconnect.authentication',
                'Provides interface for authentication',
                function(e) {
                    return _.isString(e.componentPath);
                },
                'https://docs.bigconnect.io/developer-guide/plugin-development/web-plugins/extension-point-reference-1/authentication'
            );

            this.$node.html(template({ showPoweredBy: configProperties['login.showPoweredBy'] === 'true' }));
            var self = this,
                authPlugins = registry.extensionsForPoint('org.bigconnect.authentication'),
                authNode = this.select('authenticationSelector'),
                error = '',
                componentPath = '';

            this.on('showErrorMessage', function(event, data) {
                authNode.html(alertTemplate({ error: data.message }));
            })

            if (authPlugins.length === 0) {
                error = 'No authentication extension registered.';
            } else if (authPlugins.length > 1) {
                error = 'Multiple authentication extensions registered. (See console for more info)';
                console.error('Authentication plugins:', authPlugins);
            } else {
                componentPath = authPlugins[0].componentPath;
            }

            if (error) {
                authNode.html(alertTemplate({ error: error }));
            } else if (componentPath) {
                require([componentPath], function(AuthenticationPlugin) {

                    let errorMessage = self.attr.errorMessage;
                    const messageJson = sessionStorage.getItem(LoginMessageKey);

                    if (!errorMessage) {
                        const message = messageJson && JSON.parse(messageJson);
                        // Ignore messages from too far back
                        if (message &&
                            _.isString(message.errorMessage) &&
                            _.isNumber(message.date) &&
                            (Date.now() - message.date) < ExpireLoginErrorMessageMillis) {
                            errorMessage = message.errorMessage;
                        }
                    }
                    if (messageJson) {
                        LoginComponent.setErrorMessage(null);
                    }
                    /**
                     * Custom authentication interface. Trigger `loginSucess`
                     * upon successful login.
                     *
                     * Display `errorMessage` property somewhere in interface
                     * if it is non-empty.
                     *
                     * @typedef org.bigconnect.authentication~Component
                     * @property {string} [errorMessage=''] Error Message to display
                     * @fires org.bigconnect.authentication#loginSuccess
                     */
                    AuthenticationPlugin.attachTo(authNode, {
                        errorMessage
                    });

                    /**
                     * Notify BC that user is valid and application should
                     * start.
                     *
                     * Will fail if `/user/me` actually returns `403` errors
                     *
                     * @event org.bigconnect.authentication#loginSuccess
                     * @example
                     * this.trigger('loginSuccess')
                     */
                });
            }
        });

    }

});
