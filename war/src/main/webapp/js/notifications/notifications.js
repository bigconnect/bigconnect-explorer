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
    'util/withDataRequest',
    'd3'
], function(defineComponent, withDataRequest, d3) {
    'use strict';

    var NOTIFICATION_HOVER_EXPAND_DELAY_MILLIS = 250;

    return defineComponent(Notifications, withDataRequest);

    function Notifications() {

        this.attributes({
            allowSystemDismiss: true,
            animated: true,
            emptyMessage: true,
            showInformational: true,
            showUserDismissed: false,
            notificationSelector: '.notifications .notification'
        });

        this.after('initialize', function() {
            if ('localStorage' in window) {
                var previouslyDismissed = localStorage.getItem('notificationsDismissed');
                if (previouslyDismissed) {
                    this.userDismissed = JSON.parse(previouslyDismissed);
                }
            }
            if (!this.userDismissed) {
                this.userDismissed = {};
            }
            this.stack = [];
            this.markRead = [];

            this.on(document, 'postLocalNotification', this.onPostLocalNotification);
            this.on(document, 'notificationActive', this.onNotificationActive);
            this.on(document, 'notificationDeleted', this.onNotificationDeleted);
            this.on(document, 'notificationClearAll', this.onDismissAllNotifications);
            this.on('refreshData', this.onRefresh);

            this.on('mouseover', {
                notificationSelector: this.onMouseOver
            });

            this.immediateUpdate = this.update;
            this.update = _.debounce(this.update.bind(this), 250);
            this.sendMarkRead = _.debounce(this.sendMarkRead.bind(this), 3000);

            this.loadData();

            this.$container = $('<div>')
                .addClass('notifications')
                .appendTo(this.$node);
        });

        this.loadData = function() {
            this.stack = [];
            this.markRead = [];

            var self = this;

            Promise.all([
                this.dataRequest('config', 'properties'),
                this.dataRequest('notification', 'list')
            ]).done(function(result) {
                var properties = result.shift(),
                    notifications = result.shift();

                self.autoDismissSeconds = {
                    local: parseInt(properties['notifications.local.autoDismissSeconds'] || '-1'),
                    system: parseInt(properties['notifications.system.autoDismissSeconds'] || '-1'),
                    user: parseInt(properties['notifications.user.autoDismissSeconds'] || '-1')
                };
                self.displayNotifications(notifications.system.active.concat(notifications.user));
            });
        };

        this.onRefresh = function() {
            this.loadData();
        };

        this.onPostLocalNotification = function(event, data) {
            var notification = data && data.notification;
            if (!notification) {
                throw new Error('Notification must be passed to create local notifications');
            }

            notification.type = 'local';
            notification.hash = 'local_' + new Date().getTime();
            this.displayNotifications([notification]);
        };

        this.onNotificationActive = function(event, data) {
            this.displayNotifications([data.notification]);
        };

        this.onNotificationDeleted = function(event, data) {
            this.stack = _.reject(this.stack, function(n) {
                return data.notificationId === n.id;
            });
            this.update();
            this.trigger('notificationCountUpdated', { count: this.stack.length });
        };

        this.onMouseOver = function(event, data) {
            var self = this,
                $notification = $(event.target).closest(this.attr.notificationSelector);

            clearTimeout(self.hoverTimer);
            self.hoverTimer = setTimeout(function() {
                $notification.addClass('expanded-notification');
            }, NOTIFICATION_HOVER_EXPAND_DELAY_MILLIS);

            $notification.off('mouseover', 'mouseleave').on('mouseleave', function() {
                clearTimeout(self.hoverTimer);
                $notification.removeClass('expanded-notification');
            })
        };

        this.displayNotifications = function(notifications) {
            var self = this,
                shouldDisplay = notifications && _.filter(notifications, function(n) {
                    if (self.attr.showUserDismissed !== true &&
                        self.userDismissed[n.id] && self.userDismissed[n.id] === n.hash) {
                        return false;
                    }
                    if (n.type === 'user') {
                        return true;
                    }

                    return self.attr.showInformational === true || n.severity !== 'INFORMATIONAL';
                });

            if (shouldDisplay && shouldDisplay.length) {
                shouldDisplay = collapseDuplicates(shouldDisplay);
                shouldDisplay.forEach(function(updated) {
                    var index = -1;
                    self.stack.forEach(function(n, i) {
                        if (n.id === updated.id) {
                            index = i;
                        }
                    });

                    if (index >= 0) {
                        self.stack.splice(index, 1, updated);
                    } else {
                        self.stack.push(updated);
                    }

                    if (self.attr.showUserDismissed !== true) {
                        var autoDismiss = self.autoDismissSeconds[updated.type];
                        if (autoDismiss > 0) {
                            _.delay(function() {
                                self.dismissNotification([updated], {
                                    markRead: false,
                                    userDismissed: true
                                });
                            }, autoDismiss * 1000);
                        }
                    }
                })

                if (!self.attr.animated) {
                    self.stack = _.sortBy(self.stack, function(notification) {
                        return notification.startDate || new Date(notification.sentDate).getTime();
                    }).reverse();
                }
            }
            this.update();
            this.trigger('notificationCountUpdated', { count: this.stack.length });
        };

        this.setUserDismissed = function(notificationId, notificationHash) {
            this.userDismissed[notificationId] = notificationHash;
            try {
                if ('localStorage' in window) {
                    localStorage.setItem('notificationsDismissed', JSON.stringify(this.userDismissed));
                }
            } catch(e) { /*eslint no-empty:0*/ }
        };

        this.onDismissAllNotifications = function(event, data) {
            var self = this;
            this.dataRequest('notification', 'list')
                .done(function(notifications) {
                    var allNotifications = notifications.system.active.concat(notifications.user);
                    var options = {
                        markRead: true,
                        userDismissed: false,
                        immediate: true,
                        animate: false
                    }
                    self.dismissNotification(allNotifications, options);
                });
        }

        this.dismissNotification = function(notifications, options) {
            var self = this,
                immediate = options && options.immediate,
                animate = options && options.animate,
                markRead = options && !_.isUndefined(options.markRead) ? options.markRead : true,
                userDismissed = options && !_.isUndefined(options.userDismissed) ? options.userDismissed : false;

            notifications.forEach(function(notification) {
                self.stack = _.reject(self.stack, function(n) {
                    if (n.collapsedIds) {
                        return _.contains(n.collapsedIds, notification.id);
                    }
                    return n.id === notification.id;
                });

                if (markRead) {
                    if (notification.type === 'user') {
                        if (notification.collapsedIds) {
                            notification.collapsedIds.forEach(function(nId) {
                                self.markRead.push(nId);
                            })
                        } else {
                            self.markRead.push(notification.id);
                        }
                    } else if (notification.hash) {
                        self.setUserDismissed(notification.id, notification.hash);
                    } else {
                        console.warn('Notification missing hash', notification);
                    }
                }
                if (userDismissed && notification.type === 'user' && notification.hash) {
                    self.setUserDismissed(notification.id, notification.hash);
                }
            });

            if (this.markRead.length > 0) {
                this.sendMarkRead();
            }

            if (immediate) {
                this.immediateUpdate(animate);
            } else {
                this.update(animate);
            }
        };

        this.sendMarkRead = function() {
            var self = this,
                toSend = this.markRead.slice(0);

            if (!this.markReadErrorCount) {
                this.markReadErrorCount = 0;
            }

            this.markRead.length = 0;
            this.dataRequest('notification', 'markRead', toSend)
                .then(function() {
                    self.markReadErrorCount = 0;
                })
                .catch(function(error) {
                    self.markRead.splice(self.markRead.length - 1, 0, toSend);
                    if (++self.markReadErrorCount < 2) {
                        console.warn('Retrying to mark as read');
                        self.sendMarkRead();
                    }
                })
                .done();
        };

        this.canDismissNotification = function(notification) {
            return this.attr.allowSystemDismiss !== false || notification.type !== 'system';
        };

        this.update = function(forceAnimation) {
            var self = this;

            d3.select(this.$container[0])
                .selectAll('.notification')
                .data(this.stack || [], function(n) {
                    return n.id;
                })
                .call(function() {
                    var newOnes = this.enter().insert('li')
                        .attr('class', 'notification')
                        .style('opacity', 0)
                        .style('left', '-50px')
                        .call(function() {
                            this.append('h1')
                            this.append('h2')
                            this.append('button').style('display', 'none');
                        })

                    this.on('click', function(clicked) {
                        var clickedButton = $(d3.event.target).is('button');
                        if (!clickedButton && clicked.actionEvent) {
                            if (clicked.actionEvent === 'EXTERNAL_URL' &&
                                clicked.actionPayload &&
                                clicked.actionPayload.url) {
                                window.open(clicked.actionPayload.url);
                            } else if (clicked.actionEvent === 'OBJECT_ID' &&
                                clicked.actionPayload &&
                                clicked.actionPayload.id) {
                                self.trigger(document, 'selectObjects', {
                                    vertexIds: [],
                                    edgeIds: []
                                });
                                setTimeout(() => {
                                    self.trigger(document, 'selectObjects', {
                                        vertexIds: [clicked.actionPayload.id],
                                        edgeIds: []
                                    });
                                },100);
                            } else {
                                _.defer(function() {
                                    self.trigger(clicked.actionEvent, clicked.actionPayload);
                                });
                            }
                        }

                        if (clickedButton) {
                            if (self.canDismissNotification(clicked)) {
                                self.dismissNotification([clicked], {
                                    immediate: true,
                                    animate: true
                                });
                            }
                        }
                    });
                    this.classed('critical', function(n) {
                        return (/CRITICAL/i).test(n.severity);
                    })
                    this.classed('warning', function(n) {
                        return (/WARNING/i).test(n.severity);
                    });
                    this.classed('informational', function(n) {
                        return !n.severity || (/INFO/i).test(n.severity);
                    });
                    this.classed('canDismiss', function(n) {
                        return self.canDismissNotification(n);
                    });
                    this.select('button').style('display', function(n) {
                        return self.canDismissNotification(n) ? '' : 'none';
                    });
                    this.select('h1').html(function(n) {
                        return n.title
                    }).style('cursor', function(n) {
                        return n.actionPayload ? 'pointer' : 'default';
                    });
                    this.select('h2').html(function(n) {
                        return n.message
                    }).style('cursor', function(n) {
                        return n.actionPayload ? 'pointer' : 'default';
                    });

                    if (forceAnimation || self.attr.animated !== false) {
                        newOnes = newOnes.transition()
                            .delay(function(d, i) {
                                return i / newOnes.size() * 100 + 100;
                            })
                            .duration(750)
                    }

                    newOnes
                        .style('left', '0px')
                        .style('opacity', 1)

                    var exiting = this.exit(),
                        exitingSize = exiting.size();

                    self.$container.css('min-width', Math.max(self.$container.width(), 200) + 'px');

                    if (forceAnimation || self.attr.animated !== false) {
                        exiting = exiting
                            .style('left', '0px')
                            .transition()
                            .delay(function(d, i) {
                                if (exitingSize === 1) {
                                    return 0;
                                } else {
                                    return (exitingSize - 1 - i) / exitingSize * 100 + 100;
                                }
                            })
                            .duration(500)
                            .style('left', '-50px')
                            .style('opacity', 0)
                    }

                    exiting.remove()
                });

            if (this.attr.emptyMessage) {
                this.$container.find('.empty').remove();
                if (!this.stack.length) {
                    $('<li>')
                        .addClass('empty')
                        .text(i18n('dashboard.notifications.empty'))
                        .appendTo(this.$container)
                }
            }
        };

    }

    function collapseDuplicates(notifications) {
        var grouped = _.groupBy(notifications, 'title'),
            toAdd = [],
            toCollapseIds = [];

        _.each(grouped, function(list, title) {
            var validToCollapse = list.length > 1 && _.all(list, function(n) {
                return n.type === 'user' && !n.actionEvent && !n.actionPayload;
            });
            if (validToCollapse) {
                var ids = _.pluck(list, 'id'),
                    add = _.extend({}, list[0], {
                        collapsedIds: ids,
                        title: title + ' (' + list.length + ')',
                        message: message(list)
                    });

                toAdd.push(add);
                toCollapseIds = toCollapseIds.concat(ids);
            }
        })

        return _.chain(notifications)
            .reject(function(n) {
                return _.contains(toCollapseIds, n.id)
            })
            .tap(function(list) {
                toAdd.forEach(function(a) {
                    list.push(a);
                })
            })
            .value()

        function message(notifications) {
            var prefix = sharedPrefix(notifications);
            return (prefix || '') + _.chain(notifications)
                .map(function(n) {
                    if (prefix && prefix.length) {
                        return n.message.substring(prefix.length)
                    }
                    return n.message;
                })
                .compact()
                .sortBy(function(s) {
                    return s.toLowerCase();
                })
                .value().join(', ')
        }

        function sharedPrefix(notifications) {
            var sorted = _.pluck(notifications, 'message').sort(),
                first = _.first(sorted),
                last = _.last(sorted),
                firstLen = first.length,
                i = 0;
                if (_.isString(first) && _.isString(last)) {
                    while (i < firstLen && first.charAt(i) === last.charAt(i)) {
                        i++;
                    }
                    return first.substring(0, i);
                }
        }
    }

});
