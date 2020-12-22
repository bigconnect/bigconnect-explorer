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
package com.mware.web.routes.notification;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.model.notification.SystemNotification;
import com.mware.core.model.notification.SystemNotificationRepository;
import com.mware.core.model.notification.SystemNotificationSeverity;
import com.mware.core.model.workQueue.WebQueueRepository;
import com.mware.core.user.User;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;

@Singleton
public class SystemNotificationSave implements ParameterizedHandler {
    private final SystemNotificationRepository systemNotificationRepository;
    private final WebQueueRepository webQueueRepository;
    private static final String DATE_FORMAT = "yyyy-MM-dd HH:mm 'UTC'";

    @Inject
    public SystemNotificationSave(
            final SystemNotificationRepository systemNotificationRepository,
            final WebQueueRepository webQueueRepository
    ) {
        this.systemNotificationRepository = systemNotificationRepository;
        this.webQueueRepository = webQueueRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            @Optional(name = "notificationId") String notificationId,
            @Required(name = "severity") SystemNotificationSeverity severity,
            @Required(name = "title") String title,
            @Required(name = "message") String message,
            @Required(name = "startDate") String startDateParameter,
            @Optional(name = "endDate") String endDateParameter,
            @Optional(name = "externalUrl", allowEmpty = false) String externalUrl,
            User user
    ) throws Exception {
        SimpleDateFormat sdf = new SimpleDateFormat(DATE_FORMAT);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        Date startDate = sdf.parse(startDateParameter);
        Date endDate = endDateParameter != null ? sdf.parse(endDateParameter) : null;

        SystemNotification notification;

        if (notificationId == null) {
            notification = systemNotificationRepository.createNotification(severity, title, message, externalUrl, startDate, endDate, user);
        } else {
            notification = systemNotificationRepository.getNotification(notificationId, user);
            notification.setSeverity(severity);
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setStartDate(startDate);
            notification.setEndDate(endDate);
            if (externalUrl != null) {
                notification.setExternalUrl(externalUrl);
            }
            notification = systemNotificationRepository.updateNotification(notification, user);
        }

        if (notification.isActive()) {
            webQueueRepository.pushSystemNotification(notification);
        } else {
            webQueueRepository.pushSystemNotificationUpdate(notification);
        }

        return BcResponse.SUCCESS;
    }
}
