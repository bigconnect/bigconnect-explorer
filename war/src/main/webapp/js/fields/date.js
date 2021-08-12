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
    './dateTpl.hbs',
    './dateTimezone.hbs',
    'util/vertex/formatters',
    './withPropertyField',
    './withHistogram',
    'util/popovers/withElementScrollingPositionUpdates'
], function(
    defineComponent,
    template,
    timezoneTemplate,
    F,
    withPropertyField,
    withHistogram,
    withPositionUpdates) {
    'use strict';

    return defineComponent(DateField, withPropertyField, withHistogram, withPositionUpdates);

    function DateField() {

        this.defaultAttrs({
            timeFieldSelector: '.timepicker',
            timezoneSelector: '.timezone',
            preventChangeHandler: true
        });

        this.before('initialize', function(node, config) {
            config.focus = false;
        });

        this.after('initialize', function() {
            var self = this,
                dateString = F.date.dateString(new Date()),
                timeString = '00:00';

            this.displayTime = this.attr.property.displayType !== 'dateOnly' && this.attr.property.dataType !== 'localDate';
            this.currentTimezone = F.timezone.currentTimezone();

            this.$node.html(template({
                dateString: dateString,
                timeString: timeString,
                today: F.date.dateString(new Date()),
                todayTime: F.date.timeString(new Date()),
                displayTime: this.displayTime
            }));

            this.select('timeFieldSelector').timepicker({
                template: 'dropdown',
                showInputs: false,
                showSeconds: false,
                minuteStep: 15,
                defaultTime: timeString || false,
                disableMousewheel: true
            }).on('changeTime.timepicker', function () {
                self.triggerFieldUpdated();
            });

            this.on('click', {
                timezoneSelector: this.onTimezoneOpen
            });
            this.on('selectTimezone', this.onSelectTimezone);
            this.updateTimezone();

            const input = this.select('inputSelector').eq(0);

            // Set this value once here so the datepicker can open
            // to selected month and highlight the day
            if (this.attr.value) {
                if (this.displayTime) {
                    input.val(F.date.dateString(this.attr.value))
                } else {
                    input.val(F.date.dateStringUtc(this.attr.value))
                }
            }

            input.datepicker({
                todayHighlight: true,
                todayBtn: 'linked',
            }).on('changeDate', () => {
                const timeField = input.next('input.timepicker');
                if (!timeField.val()) {
                    timeField.val('00:00');
                }
                this.triggerFieldUpdated();
            });
        });

        this.getValue = function() {
            const input = this.select('inputSelector').eq(0);
            const dateStr = input.val();

            if (this.displayTime) {
                var timeField = input.next('input.timepicker'),
                    timeVal = timeField.val();

                if (!timeVal) {
                    timeVal = '00:00';
                }
                if (dateStr && timeVal && this.currentTimezone) {
                    return F.timezone.dateTimeStringServer(dateStr + ' ' + timeVal, this.currentTimezone.name);
                }
            } else if (dateStr) {
                return F.date.dateStringServer(dateStr);
            }
        };

        this.getMetadata = function() {
            return this.currentTimezoneMetadata;
        }

        this.setValue = function(value) {
            let dateString, timeString;

            if (value) {
                var millis = _.isNumber(value) ? value : undefined,
                    date;

                if (_.isUndefined(millis) && _.isString(value) && value.length) {
                    if ((/^-?[0-9]+$/).test(value)) {
                        millis = parseInt(value, 10);
                    } else {
                        var looksLikeCorrectFormat = (/^\d+-\d+-\d+ \d+:\d+$/).test(value);
                        if (looksLikeCorrectFormat) {
                            var parsed = F.timezone.dateInServerFormat(value, 'Etc/UTC');
                            if (parsed) {
                                date = parsed.toDate();
                            }
                        } else {
                            date = F.date.looslyParseDate(value);
                        }
                        if (date) {
                            millis = date.getTime();
                        }
                    }
                } else if (value instanceof Date) {
                    dateString = F.date.dateString(value.getTime());
                } else if (isNaN(new Date(millis).getTime())) {
                    millis = null;
                }

                if (millis) {
                    if (this.displayTime) {
                        var fromZoneName = F.timezone.currentTimezone().name,
                            toZoneName = this.currentTimezone ?
                                this.currentTimezone.name :
                                fromZoneName;

                        if (fromZoneName !== toZoneName) {
                            millis = F.timezone.dateTimeStringToTimezone(millis, fromZoneName, toZoneName);
                        }
                        dateString = F.date.dateString(millis);
                        timeString = F.date.timeString(millis);
                    } else {
                        dateString = F.date.dateStringUtc(millis);
                    }
                }
            }

            this.select('inputSelector').eq(0).val(dateString);
            if (this.displayTime) {
                if (timeString) {
                    // Unable to change how am/pm is shown in timepicker
                    // so uppercase to match
                    timeString = timeString.toUpperCase();
                }
                this.select('timeFieldSelector').val(timeString);
            }
        };

        this.isValid = function(value) {
            return _.isString(value) && value.length && F.date.local(value);
        };

        this.onSelectTimezone = function(event, data) {
            if (data.name) {
                this.updateTimezone(data);
                this.triggerFieldUpdated();
            }
        };

        this.updateTimezone = function(tz) {
            if (this.displayTime) {

                var dateStringValue = this.getValue(),
                    date = dateStringValue && new Date(dateStringValue);

                if (tz) {
                    if (!_.isString(tz)) {
                        tz = tz.name;
                    }
                    this.currentTimezone = F.timezone.lookupTimezone(tz, date);
                } else {
                    if (!this.currentTimezone) {
                        this.currentTimezone = F.timezone.currentTimezone();
                    } else {
                        this.currentTimezone = F.timezone.lookupTimezone(this.currentTimezone.name, date);
                    }
                }

                this.currentTimezoneMetadata = {
                    [ONTOLOGY_CONSTANTS.PROP_SOURCE_TIMEZONE]: this.currentTimezone.name,
                    [ONTOLOGY_CONSTANTS.PROP_SOURCE_TIMEZONE_OFFSET]: this.currentTimezone.offset,
                    [ONTOLOGY_CONSTANTS.PROP_SOURCE_TIMEZONE_OFFSET_DST]: this.currentTimezone.tzOffset
                };

                this.select('timezoneSelector').replaceWith(
                    timezoneTemplate(this.currentTimezone)
                );

            }
        };

        this.onTimezoneOpen = function(event) {
            var self = this,
                $target = $(event.target).closest('.timezone');

            event.preventDefault();

            if (!this.Timezone) {
                require(['util/popovers/timezone/timezone'], function(Timezone) {
                    self.Timezone = Timezone;
                    self.onTimezoneOpen(event);
                });
                return;
            }

            if ($target.lookupComponent(this.Timezone)) {
                return;
            }

            this.Timezone.attachTo($target, {
                scrollSelector: '.content',
                timezone: this.currentTimezone.name,
                sourceTimezone: this.attr.vertexProperty &&
                    this.attr.vertexProperty[ONTOLOGY_CONSTANTS.PROP_SOURCE_TIMEZONE]
            });
        };
    }
});
