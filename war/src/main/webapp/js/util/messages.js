
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
    'util/requirejs/promise!./service/messagesPromise'
], function(messages) {
    'use strict';

    // Set to true to not replace messages and just
    // show keys to debug keys that are hard-coded
    var DEBUG_MESSAGES = false;
    try {
        if ('true' === localStorage.getItem('i18nDebug')) {
            DEBUG_MESSAGES = true;
        }
    } catch(e) {
        console.error(e);
    }

    /**
     * Use message bundles to convert keys to internationalized values.
     *
     * Use `registerMessageBundle` in web plugin to register custom bundles.
     *
     * Tokens can be placed in message values of the form: `{n}`, where `n` is
     * the argument number to replace.
     *
     * <div class="warning">
     * Will display console warning if key doesn't exist
     * </div>
     *
     * @global
     * @name i18n
     * @function
     * @param {string} key The key to lookup
     * @param {...string} args The arguments to replace in the value
     * @return {string} The string
     * @example <caption>Message Bundle Properties</caption>
     * bc.help.logout=Logout
     * bc.offline_overlay.last_check=Last checked {0}
     * @example <caption>Handlebars Template</caption>
     * {{ i18n 'bc.help.logout' }}
     * {{ i18n 'bc.offline_overlay.last_check', date }}
     * @example <caption>JavaScript Usage</caption>
     * i18n('bc.help.logout')
     * // => Logout of BigConnect Explorer
     *
     * i18n('bc.offline_overlay.last_check', new Date().toString())
     * // => Last checked 2017-02-09T18:29:47.333Z
     */
    return function(ignoreWarning, key/**, args **/) {
        var args = Array.prototype.slice.call(arguments);
        if (ignoreWarning === true) {
            args.shift();
        } else {
            ignoreWarning = false;
        }

        key = args[0];

        if (DEBUG_MESSAGES) {
            return key;
        }

        if (key in messages) {
            if (args.length === 1) {
                return messages[key];
            }

            args.shift();
            return messages[key].replace(/\{(\d+)\}/g, function(m) {
                var index = parseInt(m[1], 10);
                return args[index];
            });
        }

        if (ignoreWarning) {
            return;
        } else {
            console.error('No message for key', key);
        }
        return key;
    };
});
