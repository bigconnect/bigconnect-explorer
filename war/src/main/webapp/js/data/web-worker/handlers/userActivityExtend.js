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

/* globals ajaxFilters:false */
define(['../util/ajax'], function(ajax) {
    'use strict';

    const now = () => new Date().getTime();

    let nextExpiration;
    let defaultExpiration;
    let scheduledTimer;
    let sending = false;

    ajaxFilters.post.push((request, json, options) => {
        const expiration = request.getResponseHeader('BC-Auth-Token-Expiration')
        if (expiration) {
            nextExpiration = now() + parseInt(expiration, 10);
        }
    })

    return function({ init = false, defaultExpiration: de, schedule = true }) {
        if (!init) {
            if (!defaultExpiration) {
                defaultExpiration = de;
            }
            if (nextExpiration && defaultExpiration) {
                sendOrScheduleHeartBeat(schedule);
            }
        }
    }

    function sendHeartBeat() {
        const change = val => { sending = val; }
        change(true)
        ajax('GET', '/user/heartbeat')
            .catch(error => {
                dispatchMain('sessionTimeoutActivityHeartBeatFailed');
            })
            .finally(() => change(false))
    }

    function sendOrScheduleHeartBeat(schedule) {
        clearTimeout(scheduledTimer)
        if (sending) {
            return false;
        }

        let nearlyExpired = (defaultExpiration / 2 - 5000)
        const timeLeft = nextExpiration - now();
        const expiringSoon = timeLeft < nearlyExpired;

        if (expiringSoon) {
            sendHeartBeat();
        } else if (schedule) {
            const scheduled = timeLeft - nearlyExpired;
            scheduledTimer = setTimeout(sendHeartBeat, scheduled)
        }
    }
});
