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
    'util/withDropdown',
    './confirmForm.hbs',
    'tpl!util/alert',
    'util/withDataRequest',
    'data/web-worker/store/product/actions',
    'data/web-worker/store/product/selectors',
], function(
    defineComponent,
    withDropdown,
    template,
    alertTemplate,
    withDataRequest,
    productActions,
    productSelectors) {
    'use strict';

    return defineComponent(ConfirmForm, withDropdown, withDataRequest);

    function ConfirmForm() {

        this.defaultAttrs({
            primarySelector: '.btn-danger'
        });

        this.after('initialize', function() {
            this.render();
        });

        this.render = function() {
            this.on('click', {
                primarySelector: this.onDelete
            })

            const message = this.attr.message || i18n('detail.confirm.form.warning.explanation');

            this.$node.html(template({
                data: this.attr.data,
                message
            }));
        }

        this.onDelete = function(event) {
            var self = this;

            if (event) {
                this.buttonLoading('.btn-danger');
            }

            this.trigger('maskWithOverlay', {
                loading: true,
                text: 'Deleting...'
            });

            this.dataRequest(this.attr.service, this.attr.method, this.attr.arguments)
                .finally(function() {
                    self.trigger('maskWithOverlay', { done: true });
                })
                .then(function() {
                    self.teardown();

                    // force update of the product to redraw products
                    bcData.storePromise.then(store => {
                        const product = productSelectors.getProduct(store.getState());
                        if (product) {
                            store.dispatch(productActions.get(product.id, true))
                        }
                    });
                })
                .catch(function(error) {
                    if (self.$node.is(':empty')) {
                        self.render();
                    }
                    self.markFieldErrors(error);
                    self.clearLoading();
                })
        };
    }
});
