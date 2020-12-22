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
define(['flight/lib/component'], function(defineComponent) {
    'use strict';

    return defineComponent(DefaultConfiguration);

    function DefaultConfiguration() {

        this.defaultAttrs({
            inputSelector: 'input',
            buttonSelector: 'button'
        });

        this.after('initialize', function() {
            var self = this,
                configuration = this.attr.item.configuration || {},
                extension = this.attr.extension;

            $('<section><label><header></header>' +
              '<button class="btn btn-link btn-small"></button></label>' +
              '<input type="text"></section>')
                .find('input')
                .val(this.getTitle())
                .attr('class', 'form-control')
                .end()
                .find('header')
                .text(i18n('dashboard.configure.title'))
                .end()
                .find('button')
                .text(i18n('dashboard.configure.title.reset'))
                .css({
                    width: 'auto',
                    margin: '0 0 0 0.5em',
                    padding: '0',
                    'line-height': '1.3em'
                })
                .toggle(this.hasCustomTitle())
                .end()
                .appendTo(this.$node.empty())

            this.on('click', {
                buttonSelector: this.onReset
            });

            this.triggerChangeImmediate = this.triggerChange;
            this.triggerChange = _.debounce(this.triggerChange.bind(this), 500);

            this.on('keyup change blur', {
                inputSelector: this.onChange
            });

            this.$node.closest('.dashboardConfigurePopover').on('cardTitleChanged', function(event, data) {
                self.select('inputSelector').val(data.title);
            });
        });

        this.hasCustomTitle = function() {
            var item = this.attr.item,
                config = item.configuration;
            return Boolean(item.title && (
                (config.initialTitle || this.attr.extension.title) !== item.title
            ));
        };

        this.getTitle = function() {
            var item = this.attr.item,
                config = item && item.configuration;
            return item.title || config.initialTitle || this.attr.extension.title;
        };

        this.onReset = function(event) {
            var item = this.attr.item;

            if (item.configuration) {
                if (item.configuration.initialTitle) {
                    item.title = item.configuration.initialTitle;
                } else {
                    item.title = '';
                }
            }
            this.select('inputSelector').val(this.getTitle());
            this.triggerChangeImmediate();
        };

        this.onChange = function(event) {
            var title = event.target.value.trim();

            if (!title.length) return;

            this.attr.item.title = title;
            if (event.type === 'keyup') {
                this.triggerChange();
            } else {
                this.triggerChangeImmediate();
            }
        };

        this.triggerChange = function() {
            this.select('buttonSelector').toggle(this.hasCustomTitle());

            this.trigger('configurationChanged', {
                extension: this.attr.extension,
                item: this.attr.item,
                options: {
                    changed: 'item.title'
                }
            });
        };
    }
});
