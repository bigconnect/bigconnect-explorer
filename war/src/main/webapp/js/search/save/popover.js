
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
    'util/popovers/withPopover',
    'util/withDataRequest',
    'px/extensions/growl'
], function(
    defineComponent,
    withPopover,
    withDataRequest) {
    'use strict';

    var SCOPES = {
        GLOBAL: 'Global'
    };

    return defineComponent(SavedSearches, withPopover, withDataRequest);

    function normalizeParameters(params) {
        return _.chain(params)
            .map(function(value, key) {
                return [
                    key.replace(/\[\]$/, ''),
                    value
                ];
            })
            .object()
            .value();
    }

    function queryParametersChanged(param1, param2) {
        return !_.isEqual(
            normalizeParameters(param1),
            normalizeParameters(param2)
        );
    }

    function SavedSearches() {

        this.defaultAttrs({
            listSelector: 'li a',
            saveSelector: '.form button',
            nameInputSelector: '.form input.name',
            globalSearchSelector: '.form .global-search',
            globalInputSelector: '.form .global-search input',
            deleteSelector: 'ul .btn-del',
            deleteConfirmSelector: 'ul .btn-del-confirm'
        });

        this.before('initialize', function(node, config) {
            config.template = '/search/save/template';
            config.canSaveGlobal = bcData.currentUser.privileges.indexOf('SEARCH_SAVE_GLOBAL') > -1;
            config.maxHeight = $(window).height() / 2;
            config.name = config.update && config.update.name || '';
            config.updatingGlobal = config.update && config.update.scope === SCOPES.GLOBAL;
            config.text = i18n('search.savedsearches.button.' + (config.update ? 'update' : 'create'));
            config.teardownOnTap = true;
            config.canAddOrUpdate = _.isUndefined(config.update) || !config.updatingGlobal ||
                (config.updatingGlobal && config.canSaveGlobal);
            config.list = config.list.map(function(item) {
                var isGlobal = item.scope === SCOPES.GLOBAL,
                    canDelete = true;
                if (isGlobal) {
                    canDelete = config.canSaveGlobal;
                }
                return _.extend({}, item, {
                    isGlobal: isGlobal,
                    canDelete: canDelete
                })
            });

            this.after('setupWithTemplate', function() {
                this.on(this.popover, 'click', {
                    listSelector: this.onClick,
                    saveSelector: this.onSave,
                    deleteSelector: this.onDeleteConfirm,
                    deleteConfirmSelector: this.onDelete,
                });

                this.on(this.popover, 'keyup change', {
                    nameInputSelector: this.onChange,
                    globalInputSelector: this.onChange
                });

                this.validate();
                this.positionDialog();
            });
        });

        this.after('initialize', function() {
            this.on('setCurrentSearchForSaving', this.onSetCurrentSearchForSaving);
        });

        this.onSetCurrentSearchForSaving = function(event, data) {
            this.attr.query = data;
            this.validate();
        };

        this.onChange = function(event) {
            if (this.attr.update) {
                var $button = this.popover.find('.form button'),
                    query = this.getQueryForSaving();

                $button.text(
                    ('id' in query) ?
                    'Update' : 'Create'
                );
            }

            if (this.validate() && event.type === 'keyup' && event.which === 13) {
                this.save();
            }
        };

        this.validate = function() {
            var $input = this.popover.find(this.attr.nameInputSelector),
                $button = this.popover.find(this.attr.saveSelector),
                $global = this.popover.find(this.attr.globalSearchSelector),
                query = this.getQueryForSaving(),
                noParameters = _.isEmpty(query.parameters);

            $button.prop('disabled', !query.name || noParameters);
            $input.prop('disabled', noParameters || !query.url);
            $global.toggle(!(noParameters || !query.url));

            return query.name && query.url && !noParameters;
        };

        this.getQueryForSaving = function() {
            var $nameInput = this.popover.find(this.attr.nameInputSelector),
                $globalInput = this.popover.find(this.attr.globalInputSelector),
                query = {
                    name: $nameInput.val().trim(),
                    global: $globalInput.is(':checked'),
                    url: this.attr.query && this.attr.query.url,
                    parameters: this.attr.query && this.attr.query.parameters
                };

            if (this.attr.update && query.parameters) {
                var nameChanged = this.attr.update.name !== query.name,
                    queryChanged = queryParametersChanged(this.attr.update.parameters, query.parameters);

                if ((nameChanged && !queryChanged) || (!nameChanged && queryChanged) ||
                   (!nameChanged && !queryChanged)) {
                    query.id = this.attr.update.id;
                }
            }

            return query;
        };

        this.onSave = function(event) {
            const isUpdate = this.attr.update && this.attr.update.id ? true : false;
            this.save(isUpdate);
        };

        this.save = function(isUpdate) {
            var self = this,
                $button = this.popover.find(this.attr.saveSelector).addClass('loading'),
                query = this.getQueryForSaving();
            query.update = isUpdate;
            this.dataRequest('search', 'save', query)
                .then(function() {
                    self.teardown();
                })
                .catch(function(rej) {
                    $.growl.error({
                        message: (rej.json && rej.json.error) || 'Something went wrong with your request.',
                    });
                })
                .finally(function() {
                    $button.removeClass('loading');
                })
        };

        this.onDeleteConfirm = function(event) {
            const $btn = $(event.target),
                $btnConfirm = $btn.siblings('.btn-del-confirm'),
                hasBtnCancel = $btn.siblings('btn-cancel').length > 0,
                $btnCancel = $('<button class="btn btn-xs btn-raised btn-cancel">No</button>');

            if (!hasBtnCancel) {
                $btnCancel.on('click', () => {
                    $btn.show();
                    $btnConfirm.hide();
                    $btnCancel.remove();
                });
                $btn.parent().append($btnCancel);
            }

            $btn.hide();
            $btnConfirm.css('right', '5em');
            $btnConfirm.show();
        };

        this.onDelete = function(event) {
            var self = this,
                $li = $(event.target).closest('li'),
                index = $li.index(),
                query = this.attr.list[index],
                $button = $(event.target).addClass('loading');

            $li.addClass('loading');

            this.dataRequest('search', 'delete', query.id)
                .then(function() {
                    if ($li.siblings().length === 0) {
                        $li.closest('ul').html(
                            $('<li class="empty">No Saved Searches Found</li>')
                        );
                    } else $li.remove();

                    self.attr.list.splice(index, 1);

                    if (self.attr.update && self.attr.update.id === query.id) {
                        self.popover.find(self.attr.nameInputSelector).val('');
                        self.popover.find(self.attr.saveSelector).text('Create');
                        self.attr.update = null;
                        self.validate();
                    }
                })
                .catch((e) => {
                  if (e && e.message === 'access.denied') {
                      $.growl.error({ message: 'Access denied' });
                  }
                })
                .finally(function() {
                    $button.removeClass('loading');
                    $li.removeClass('loading');
                })
        };

        this.onClick = function(event) {
            var query = this.attr.list[$(event.target).closest('li').index()];

            this.trigger('savedQuerySelected', {
                query: query
            });

            this.teardown();
        };
    }
});
