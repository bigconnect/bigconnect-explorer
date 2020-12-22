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
define(['handlebars'], function(Handlebars) {
    'use strict';

    // Modified version of handlebars `each`

    return Handlebars.registerHelper('eachWithLimit', function(context, options) {
        var fn = options.fn,
            inverse = options.inverse,
            limit = options.hash.limit,
            i = 0,
            ret = '',
            data;

        if (isNaN(limit)) {
            throw new Error('limit option is required');
        }

        if (Handlebars.Utils.isFunction(context)) {
            context = context.call(this);
        }

        data = Handlebars.createFrame(options.data || {});

        if (context && typeof context === 'object') {
            if (Handlebars.Utils.isArray(context)) {
                for (var j = context.length; i < j; i++) {
                    if (data) {
                        data.index = i;
                        data.first = (i === 0);
                        data.last = (i === (context.length - 1));
                        data.hidden = i >= limit;
                        data.showButton = data.last && data.hidden;
                    }
                    ret = ret + fn(context[i], { data: data });
                }
            } else {
                throw new Error('Array required for eachWithLimit');
            }
        }

        if (i === 0) {
            ret = inverse(this);
        }

        return ret;
    });

});
