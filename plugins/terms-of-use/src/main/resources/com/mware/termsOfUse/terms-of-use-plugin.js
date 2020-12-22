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
require([
    'jquery',
    'util/messages'
], function($, i18n) {
    'use strict';

    var template;

    $(document).on('applicationReady', function(event) {
        $.get('terms')
            .done(function(json) {
                var terms = json.terms;
                if (terms.date) {
                    terms.date = new Date(terms.date);
                }

                if (json.status.current !== true) {
                    require([
                        'flight/lib/component',
                        'util/withDataRequest',
                        'com/mware/termsOfUse/terms-of-use.hbs'
                    ], function(defineComponent, withDataRequest, tpl) {
                        template = tpl;

                        var Terms = defineComponent(TermsOfUse, withDataRequest);
                        Terms.attachTo($('#app'), {
                            terms: terms
                        });
                    });
                }
            })
            .fail(function() {
                console.error("error getting the terms of use and current user's acceptance status");
            });
    });

    function TermsOfUse() {

        this.defaultAttrs({
            termsSelector: '.terms-modal',
            acceptSelector: '.terms-modal .btn-primary',
            declineSelector: '.terms-modal .btn-danger'
        });

        this.after('initialize', function() {
            this.$node.append(template(this.attr));

            this.on('click', {
                acceptSelector: this.onAccept,
                declineSelector: this.onDecline
            });

            this.showModal();
        });

        this.onAccept = function(event) {
            event.stopPropagation();
            event.preventDefault();

            var button = $(event.target)
                .addClass('loading')
                .attr('disabled', true);

            $.post('terms', { hash: this.attr.terms.hash })
                .done(function() {
                    var modal = button.closest('.modal');
                    modal.modal('hide');
                    _.delay(function() {
                        modal.remove();
                    }, 1000);
                })
                .fail(this.showButtonError.bind(
                    this,
                    button,
                    i18n('termsOfUse.button.accept.error'))
                );
        };

        this.onDecline = function(event) {
            event.stopPropagation();
            event.preventDefault();

            var self = this,
                button = $(event.target)
                    .addClass('loading')
                    .attr('disabled', true);

            this.dataRequest('user', 'logout')
                .then(function() {
                    location.reload();
                })
                .catch(function() {
                    self.showButtonError(button, i18n('termsOfUse.button.decline.error'));
                })
        };

        this.showButtonError = function(button, errorText) {
            button.removeClass('loading')
                .text(errorText);

            _.delay(function() {
                button.text('Accept').removeAttr('disabled');
            }, 3000);
        }

        this.showModal = function() {
            var modal = this.select('termsSelector');
            modal
                .find('.modal-body').css({
                    padding: 0,
                    maxHeight: Math.max(50, $(window).height() * 0.5) + 'px'
                })
                .find('.term-body').css({
                    padding: '0 1.2em',
                    fontSize: '10pt'
                });

            _.defer(function() {
                modal.modal('show');
            });
        }

    }
});
