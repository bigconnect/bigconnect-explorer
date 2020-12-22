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
require([
    'jquery',
    'flight/lib/compose',
    'flight/lib/registry',
    'flight/lib/advice',
    'flight/lib/logger',
    'flight/lib/debug',
    'underscore',
    'underscore.inflection',
    'util/visibility',
    'util/privileges',
    'util/jquery.flight',
    'util/jquery.removePrefixedClasses',
    'util/jquery/plugins',
    'util/promise'
],
function(jQuery,
         compose,
         registry,
         advice,
         withLogging,
         debug,
         _,
         _inflection,
         Visibility,
         Privileges) {
    'use strict';

    $.ui = { keyCode: { ENTER: 13 } };
    // For backward compatibility
    jQuery.fn.size = function() {
        console.warn('$.size is deprecated');
        return this.length;
    };
    jQuery.fn.andSelf = function() {
        console.warn('$.andSelf is deprecated, use $.addBack');
        return jQuery.fn.addBack.apply(this, arguments);
    };

    lockDownUnderscore(_);

    // Debug retina/non-retina by changing to 1/2
    // window.devicePixelRatio = 1;

	window.requestIdleCallback =
        typeof window === 'undefined' ?
        function() { } :
        (
            window.requestIdleCallback ||
            function(callback) {
                return setTimeout(callback, 1000 / 60);
            }
        );
    window.cancelIdleCallback =
        typeof window === 'undefined' ?
        function() { } :
        (
            window.cancelIdleCallback ||
            function(handle) {
                clearTimeout(handle, 1000 / 60);
            }
        );
    window.requestAnimationFrame =
        typeof window === 'undefined' ?
        function() { } :
        (
            window.requestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function(callback) {
                return setTimeout(callback, 1000 / 60);
            }
        );

    window.TRANSITION_END = 'transitionend webkitTransitionEnd MSTransitionEnd oTransitionEnd otransitionend';
    window.ANIMATION_END = 'animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd oanimationend';
    window.BC_MIMETYPES = _.mapObject({
        _PREFIX: 'application/x-bc.',
        _FORMAT: '+json',
        _DataTransferHasBC: (dataTransfer, specificType) => {
            return _.any(dataTransfer.types, (type) => {
                if (specificType) return type === specificType
                return type.indexOf(BC_MIMETYPES._PREFIX) === 0;
            })
        },

        ELEMENTS: 'elements',
        RESOLVED_INFO: 'resolvedInfo'
    }, (str, key, obj) => {
        if (key.substring(0, 1) !== '_') {
            return obj._PREFIX + str + obj._FORMAT;
        }
        return str;
    });

    var progress = 0,
        progressBar = null,
        progressBarText = null,
        TOTAL_PROGRESS = 4,
        MAX_RESIZE_TRIGGER_INTERVAL = 250,
        App, FullScreenApp, F, withDataRequest,
        previousUrl = window.location.href;

    $(function() {
        require(['cli']);
        require(['data/data'], configureApplication);
        require(['urlPolyfill']);

        function configureApplication(Data) {
            // Flight Logging
            try {
                debug.enable(false);
                DEBUG.events.logNone();
            } catch(e) {
                console.warn('Error enabling DEBUG mode for flight' +
                ', probably because Safari Private Browsing enabled', e);
            }

            // Default templating
            _.templateSettings.escape = /\{([\s\S]+?)\}/g;
            _.templateSettings.evaluate = /<%([\s\S]+?)%>/g;
            _.templateSettings.interpolate = /\{-([\s\S]+?)\}/g;

            Data.attachTo(document);
            Visibility.attachTo(document);
            Privileges.attachTo(document);
            $(window)
                .on('hashchange', loadApplicationTypeBasedOnUrlHash)
                .on('resize', _.throttle(function(event) {
                    if (event.target !== window) {
                        return;
                    }
                    $(document).trigger('windowResize');
                }, MAX_RESIZE_TRIGGER_INTERVAL));

            Promise.require('util/messages')
                .then(function(_i18n) {
                    window.i18n = _i18n;
                    updateLoadingProgress('dependencies');

                    require([
                        'react',
                        'util/vertex/urlFormatters',
                        'util/withDataRequest',
                        'util/handlebars/before_auth_helpers'
                    ], function(React, _F, _withDataRequest) {
                        // Don't need to require react in jsx even if never used
                        window.React = React;

                        // Provide for react-virtualized
                        define('React', [], React);
                        define('ReactDOM', ['react-dom'], _.identity);

                        F = _F;
                        withDataRequest = _withDataRequest;
                        loadApplicationTypeBasedOnUrlHash();
                    })
                })
        }
    });

    function userHasValidPrivileges(me) {
        return me.privileges && me.privileges.length > 0;
    }

    /**
     * Switch between bigconnect and bigconnect-fullscreen-details based on url hash
     */
    function loadApplicationTypeBasedOnUrlHash(e) {
        var toOpen = F.vertexUrl.parametersInUrl(location.href),
            vertexIds = toOpen && toOpen.vertexIds,
            edgeIds = toOpen && toOpen.edgeIds,
            toOpenIds = (
                (vertexIds && vertexIds.length) ||
                (edgeIds && edgeIds.length)
            ),

            workspaceId = toOpen && toOpen.workspaceId,

            redirectUrl = toOpen && toOpen.redirectUrl,

            // Is this the popoout details app? ids passed to hash?
            popoutDetails = !!(toOpen && toOpen.type === 'FULLSCREEN' && toOpenIds),

            // If this is a hash change
            event = e && e.originalEvent,

            // Is this the default BigConnect Explorer application?
            mainApp = !popoutDetails,
            newUrl = window.location.href;

        if (event && (isAddUrl(previousUrl) || isRedirectUrl(previousUrl)) && isMainApp(newUrl)) {
            previousUrl = newUrl;
            return;
        }

        if (event && isPopoutUrl(previousUrl) && isPopoutUrl(newUrl)) {
            previousUrl = newUrl;
            return $('#app').trigger('vertexUrlChanged', {
                vertexIds: vertexIds,
                edgeIds: edgeIds,
                workspaceId: workspaceId,
                redirectUrl: redirectUrl
            });
        }

        previousUrl = newUrl;
        Promise.all(bcPluginResources.beforeAuth.map(Promise.require))
            .then(loadUser)
            .then(function(me) {
                if (!userHasValidPrivileges(me)) {
                    throw new Error('missing privileges')
                }
                attachApplication(false, null, null, me);
            })
            .catch(function() {
                attachApplication(true, '', {});
            });

        function attachApplication(loginRequired, message, options, user) {
            if (!event) {
                $('html')
                    .toggleClass('fullscreenApp', mainApp)
                    .toggleClass('fullscreenDetails', popoutDetails);

                window.isFullscreenDetails = popoutDetails;
            }

            bcData.isFullscreen = false;

            if (loginRequired) {
                // Login required, once less progress item (no after-auth plugins)
                TOTAL_PROGRESS--;
                updateLoadingProgress('userinterface');

                $(document).one('loginSuccess', function() {
                    loadUser().then(user => {
                      Promise.all(bcPluginResources.afterAuth.map(Promise.require))
                        .catch(function(error) {
                            $('#login').trigger('showErrorMessage', {
                                message: i18n('bc.loading.progress.pluginerror')
                            })
                            throw error;
                        })
                        .then(function() {
                            loginSuccess({ animate: true, user });
                        })
                   })
                });

                require(['login'], function(Login) {
                    removeBCLoading().then(function() {
                        Login.teardownAll();
                        Login.attachTo('#login', {
                            errorMessage: message,
                            errorMessageOptions: options,
                            toOpen: toOpen
                        });
                    })
                });
            } else {
                updateLoadingProgress('extensions', 0);
                var len = bcPluginResources.afterAuth.length,
                    i = 0,
                    pluginTimes = [];
                Promise.all(bcPluginResources.afterAuth.map(function(path) {
                    const t0 = new Date().getTime();
                    return Promise.require(path).then(function() {
                        const t1 = new Date().getTime();
                        pluginTimes.push({ path, 'duration (ms)': t1 - t0 });
                        updateLoadingProgress('extensions', ++i / len);
                    })
                }))
                    .catch(function(error) {
                        removeBCLoading('pluginerror');
                        throw error;
                    })
                    .then(function() {
                        updateLoadingProgress('userinterface');
                        loginSuccess({ user });
                    })
                    .finally(function() {
                         if (window.console) {
                             if ('groupCollapsed' in console && 'table' in console) {
                                 console.groupCollapsed('Plugin Load Metrics');
                                 console.log('Later plugins will be slower due to network concurrency limits')
                                 console.table(pluginTimes);
                                 console.groupEnd();
                             }
                         }
                    })
            }
        }

        function loadUser() {
            return withDataRequest.dataRequest('user', 'me')
        }

        function loginSuccess({ animate = false, user }) {
            if (animate && (/^#?[a-z]+=/i).test(location.hash)) {
                window.location.reload();
            } else {
                Promise.resolve(user || loadUser()).then(function(me) {
                    if (!userHasValidPrivileges(me)) {
                        $('#login .authentication').html(
                            '<span style="color: #D42B34;">' + i18n('bc.login.missingPrivileges')
                            + '<p/><a class="logout" href="">' + i18n('bc.login.logout') + '</a>'
                            + '</span>');
                        return;
                    }

                    require([
                        'util/requirejs/promise!util/service/propertiesPromise',
                        'util/formatters',
                        'util/jquery/bootstrapTypeaheadScrollFix',
                        'bootstrap',
                        'easing',
                        'jquery-scrollstop',
                        'px/extensions/bootstrap-datepicker',
                        'px/extensions/bootstrap-timepicker',
                        'px-libs/bootstrap3-typeahead',
                        'util/visibility/util',
                        'util/handlebars/after_auth_helpers'
                    ], function(config, F, bootstrapTypeaheadScrollFix) {

                        configureDateFormats(config, F)

                        bootstrapTypeaheadScrollFix();

                        if (popoutDetails) {
                            bcData.isFullscreen = true;
                            $('#login').remove();
                            require(['appFullscreenDetails'], function(comp) {
                                removeBCLoading().then(function() {
                                    if (event) {
                                        location.reload();
                                    } else {
                                        if (App) {
                                            App.teardownAll();
                                        }
                                        FullScreenApp = comp;
                                        FullScreenApp.teardownAll();
                                        FullScreenApp.attachTo('#app', {
                                            vertexIds: vertexIds,
                                            edgeIds: edgeIds,
                                            workspaceId: workspaceId
                                        });
                                    }
                                });
                            });
                        } else {
                            if (!animate) {
                                $('#login').remove();
                            }
                            require(['app'], function(comp) {
                                removeBCLoading().then(function() {
                                    App = comp;
                                    if (event) {
                                        location.reload();
                                    } else {
                                        if (FullScreenApp) {
                                            FullScreenApp.teardownAll();
                                        }
                                        App.teardownAll();
                                        var appOptions = {};
                                        if (toOpen && toOpen.type === 'ADD' && vertexIds.length) {
                                            appOptions.addVertexIds = toOpen;
                                        }
                                        if (toOpen && toOpen.type === 'ADMIN' && toOpen.section && toOpen.name) {
                                            appOptions.openAdminTool = _.pick(toOpen, 'section', 'name');
                                        }
                                        if (toOpen && toOpen.type === 'REDIRECT' && toOpen.redirectUrl) {
                                            window.location.href = toOpen.redirectUrl;
                                            return;
                                        }
                                        if (toOpen && toOpen.type === 'TOOLS' && !_.isEmpty(toOpen.tools)) {
                                            appOptions.openMenubarTools = toOpen.tools;
                                        }
                                        if (animate) {
                                            $('#login .authentication button.loading').removeClass('loading');
                                            appOptions.animateFromLogin = true;
                                        }

                                        App.attachTo('#app', appOptions);
                                        _.defer(function() {
                                            // Cache login in case server goes down
                                            require(['login']);
                                        });

                                        if (animate) {
                                            $('#login').one(TRANSITION_END, function() {
                                                $('#login')
                                                    .find('.authentication').teardownAllComponents()
                                                    .end().teardownAllComponents();
                                            });
                                        }
                                    }
                                });
                            });
                        }
                    });
                });
            }
        }
    }

    function configureDateFormats(config, F) {
        const dateDisplay = config['formats.date.dateDisplay'];
        const timeDisplay = config['formats.date.timeDisplay'];
        const showTz = config['formats.date.showTimezone'] !== 'false';

        F.date.setDateFormat(dateDisplay);
        F.date.setTimeFormat(timeDisplay, showTz);

        // Default datepicker options
        $.fn.datepicker.defaults.format = F.date.datepickerFormat();
        $.fn.datepicker.defaults.autoclose = true;

        // Check whether to show am/pm and twelve hour time in timepicker
        const showMeridian = /(h|a|A)/.test(timeDisplay);
        $.fn.timepicker.defaults.showMeridian = showMeridian;
        $.fn.timepicker.defaults.maxHours = showMeridian ? 12 : 24;
    }

    function updateLoadingProgress(string, percentInProgress) {
        if (!progressBar) {
            progressBar = $('#bc-loading-static .progress-bar')[0];
            progressBarText = $('#bc-loading-static span')[0];
        }
        if (progressBar.dataset.finished) return;

        var translatedString = i18n('bc.loading.progress.' + string);

        if (arguments.length === 2 && percentInProgress < 1.0) {
            var segment = 1 / TOTAL_PROGRESS,
                inc = segment * percentInProgress;
            progressBarText.textContent = translatedString;
            progressBar.style.width = Math.round((progress / TOTAL_PROGRESS + inc) * 100) + '%';
        } else {
            progress++;
            progressBarText.textContent = translatedString;
            progressBar.style.width = Math.round(progress / TOTAL_PROGRESS * 100) + '%';
        }
    }

    function removeBCLoading(error) {
        if (error) {
            progressBar.dataset.finished = true;
            progressBarText.textContent = i18n('bc.loading.progress.' + error);
            progressBarText.style.color = '#D42B34';
        } else {
            updateLoadingProgress('starting');
            return new Promise(function(fulfill) {
                _.delay(function() {
                    $('#bc-loading-static').remove();
                    fulfill();
                }, 500)
            });
        }
    }

    function isPopoutUrl(url) {
        return F.vertexUrl.isFullscreenUrl(url);
    }

    function isAddUrl(url) {
        return (/#add=/).test(url);
    }

    function isRedirectUrl(url) {
        return (/#redirect=/).test(url);
    }

    function isMainApp(url) {
        return (/#\s*$/).test(url) || url.indexOf('#') === -1;
    }

    // Both lodash and underscore pollute the global 'window' object with '_', this prevents future includes of these
    // libraries from doing that.
    function lockDownUnderscore(_) {
        Object.defineProperty(window, '_', {
            value: _,
            writable: false
        });
    }
});
