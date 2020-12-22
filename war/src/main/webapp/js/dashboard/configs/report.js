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
    'configuration/plugins/registry',
    './reportTpl.hbs'
], function(
    defineComponent,
    registry,
    template) {
    'use strict';

    return defineComponent(ReportConfiguration);

    function ReportConfiguration() {

        this.defaultAttrs({
            typeSelector: 'select.reportType',
            configSelector: '.custom_report_config'
        });

        this.after('initialize', function() {
            var self = this,
                configuration = this.attr.item.configuration || {},
                renderers = registry.extensionsForPoint('org.bigconnect.web.dashboard.reportrenderer');

            this.on('change', {
                typeSelector: this.onChange
            })

            this.$node.html(template({
                extension: this.attr.extension,
                item: this.attr.item
            }));

            var reportRenderer = _.findWhere(renderers, { identifier: configuration.reportRenderer });
            if (reportRenderer && reportRenderer.configurationPath) {
                require([reportRenderer.configurationPath], function(Config) {
                    Config.attachTo(self.select('configSelector'), {
                        extension: self.attr.extension,
                        item: self.attr.item
                    })
                })
            }

            this.on('reportResults', function(event, data) {
                var $select = this.select('typeSelector'),
                    validReportRenderers = _.filter(registry.extensionsForPoint('org.bigconnect.web.dashboard.reportrenderer'), function(e) {
                        try {
                            return e.supportsResponse(data.results);
                        } catch(error) {
                            console.error(error);
                        }
                    });

                if (validReportRenderers.length) {
                    $select.html($.map(validReportRenderers, function(r) {
                        return $('<option>')
                            .val(r.identifier)
                            .text(r.label)
                            .prop('selected', r.identifier === configuration.reportRenderer)
                    })).prop('disabled', false);
                } else {
                    $select.html($('<select>').text('No Supported Visualizations Found'))
                        .prop('disabled', true)
                }
            })
            this.trigger('redirectEventToItem', {
                name: 'getReportResults'
            });
        });

        this.onChange = function(event) {
            this.attr.item.configuration.reportRenderer = $(event.target).val();

            this.trigger('configurationChanged', {
                extension: this.attr.extension,
                item: this.attr.item
            });
        };
    }
});
