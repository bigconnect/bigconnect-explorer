
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
    './overlay.hbs',
    'util/formatters',
    'util/privileges',
    'util/withDataRequest'
], function(
    defineComponent,
    template,
    F,
    Privilege,
    withDataRequest) {
    'use strict';

    var UPDATE_WORKSPACE_DIFF_SECONDS = 5,
        SHOW_UNPUBLUSHED_CHANGES_SECONDS = 3;


    return defineComponent(WorkspaceOverlay, withDataRequest);

    function WorkspaceOverlay() {

        this.defaultAttrs({
            nameSelector: '.name',
            toggleTimelineSelector: '.toggle-timeline'
        });

        this.after('initialize', function() {
            var self = this;

            this.updateDiffBadge = _.throttle(this.updateDiffBadge.bind(this), UPDATE_WORKSPACE_DIFF_SECONDS * 1000)
            const publishPrivilege = bcData.currentUser.privileges.includes('PUBLISH');

            this.$node.hide().html(template({
                publishPrivilege
            }));

            requestAnimationFrame(function() {
                self.$node.addClass('visible');
            });

            this.on(document, 'didToggleDisplay', this.onDidToggleDisplay);
            this.on(document, 'workspaceLoaded', this.onWorkspaceLoaded);
            this.on(document, 'switchWorkspace', this.onSwitchWorkspace);

            this.on(document, 'verticesUpdated', this.updateDiffBadge);
            this.on(document, 'verticesDeleted', this.updateDiffBadge);
            this.on(document, 'edgesUpdated', this.updateDiffBadge);
            this.on(document, 'edgesDeleted', this.updateDiffBadge);
            this.on(document, 'ontologyUpdated', this.updateDiffBadge);
            this.on(document, 'textUpdated', this.updateDiffBadge);
            this.on(document, 'updateDiff', this.updateDiffBadge);

            this.on(document, 'toggleDiffPanel', this.toggleDiffPanel);
            this.on(document, 'escape', this.closeDiffPanel);

            this.on('click', {
                toggleTimelineSelector: this.onToggleTimeline
            });

            this.trigger(document, 'registerKeyboardShortcuts', {
                scope: ['graph.help.scope', 'map.help.scope'].map(i18n),
                shortcuts: {
                    'alt-d': { fire: 'toggleDiffPanel', desc: i18n('workspaces.help.show_diff') }
                }
            });

            this.trigger(document, 'registerKeyboardShortcuts', {
                scope: ['graph.help.scope', 'map.help.scope'].map(i18n),
                shortcuts: {
                    'alt-i': { fire: 'toggleTimeline', desc: i18n('workspaces.help.toggle_timeline') }
                }
            });

            var width = $(window).width(),
                height = $(window).height(),
                popover = this.$node.find('.popover'),
                paddingH = 100,
                paddingV = 75,
                popoverCss = {
                    maxWidth: (width - paddingH),
                    maxHeight: (height - paddingV)
                };

            this.popoverCss = popoverCss;
            if (popover.length) {
                this.updatePopoverSize(popover);
            }
        });

        this.onDidToggleDisplay = function(event, data) {
            if (data.name === 'products-full' && data.visible) {
                this.select('toggleTimelineSelector').show();
            } else if (data.visible && data.type === 'full') {
                this.select('toggleTimelineSelector').hide()
                this.trigger('toggleTimeline');
            }
        };

        this.onToggleTimeline = function() {
            this.trigger('toggleTimeline');
        }

        this.toggleDiffPanel = function() {
            var badge = this.$node.find('.badge');
            if (badge.is(':visible')) {
                badge.popover('toggle');
            }
        };

        this.closeDiffPanel = function() {
            var badge = this.$node.find('.badge');
            if (badge.is(':visible')) {
                badge.popover('hide');
            }
        };

        this.updatePopoverSize = function(tip) {
            var css = {};
            if (tip.width() > this.popoverCss.maxWidth) {
                css.width = this.popoverCss.maxWidth + 'px';
            }
            if (tip.height() > this.popoverCss.maxHeight) {
                css.height = this.popoverCss.maxHeight + 'px';
            }

            tip.resizable('option', 'maxWidth', this.popoverCss.maxWidth);
            tip.resizable('option', 'maxHeight', this.popoverCss.maxHeight);
            if (_.keys(css).length) {
                tip.css(css);
            }
        }

        this.onSwitchWorkspace = function(event, data) {
            if (this.previousWorkspace !== data.workspaceId) {
                this.previousDiff = null;
                this.$node.find('.badge').popover('destroy').remove();
            }
        };

        this.onWorkspaceLoaded = function(event, data) {
            this.$node.show();
            this.previousWorkspace = data.workspaceId;
            this.updateDiffBadge();
            this.workspaceName = data.title;
            this.$node.find('.workspaceName').text(this.workspaceName);
        };

        this.onDiffBadgeMouse = function(event) {
            this.trigger(
                event.type === 'mouseenter' ? 'focusElements' : 'defocusElements',
                { elementIds: this.currentDiffIds || [] }
            );
        };

        this.updateDiffBadge = function(event, data) {
            var self = this,
                node = this.select('nameSelector'),
                badge = this.$node.find('.badge');

            if (!bcData.currentUser.privileges.includes('PUBLISH'))
                return;

            if (!badge.length) {
                badge = $('<span class="badge"></span>')
                    .insertAfter(node)
                    .on('mouseenter mouseleave', this.onDiffBadgeMouse.bind(this))
            }

            Promise.all([
                this.dataRequest('workspace', 'diff'),
                this.dataRequest('ontology', 'ontology')
            ]).spread(function({ diffs }, { properties: ontologyProperties, concepts: ontologyConcepts }) {
                const sameDiff = self.previousDiff && _.isEqual(diffs, self.previousDiff);

                if (sameDiff) {
                    return;
                }
                self.previousDiff = diffs;

                var vertexDiffsById = _.indexBy(diffs, function(diff) {
                        return diff.vertexId;
                    }),
                    count = 0,
                    alreadyCountedCompoundProperties = [],
                    filteredDiffs = _.filter(diffs, function(diff) {
                        if (diff.type === 'PropertyDiffItem') {
                            var ontologyProperty = ontologyProperties.byTitle[diff.name];
                            if (!ontologyProperty ||
                                !(ontologyProperty.userVisible || ontologyProperty.title === ONTOLOGY_CONSTANTS.PROP_COMMENT_ENTRY)) {
                                return false;
                            }

                            var vertexDiff = vertexDiffsById[diff.elementId];
                            if (vertexDiff && diff.name === 'title') return true;

                            var compoundProperty = ontologyProperties.byDependentToCompound[diff.name],
                                ontologyConcept = ontologyConcepts.byId[diff.elementConcept];
                            if (compoundProperty && ontologyConcept && ontologyConcept.properties.indexOf(compoundProperty) >= 0) {
                                var alreadyCountedKey = diff.elementId + diff.key + compoundProperty;
                                if (_.contains(alreadyCountedCompoundProperties, alreadyCountedKey)) {
                                    return true;
                                }
                                alreadyCountedCompoundProperties.push(alreadyCountedKey);
                            }
                        }
                        count++;
                        return true;
                    });
                self.formattedCount = F.number.pretty(count);

                self.currentDiffIds = _.uniq(filteredDiffs.map(function(diff) {
                    return diff.vertexId || diff.elementId || diff.edgeId;
                }));


                require(['workspaces/diff/diff'], function(Diff) {
                    var popover = badge.data('bs.popover'),
                        tip = popover && popover.tip();

                    if (tip && tip.is(':visible')) {
                        self.trigger(popover.tip().find('.popover-content'),
                             'diffsChanged',
                             { diffs: filteredDiffs });
                        popover.show();
                    } else {
                        badge
                            .popover('destroy')
                            .popover({
                                placement: 'top',
                                content: i18n('workspaces.diff.loading'),
                                title: i18n('workspaces.diff.header.unpublished_changes')
                            });

                        popover = badge.data('bs.popover');
                        tip = popover.tip();

                        var left = 10;
                        tip.css({
                                width: '400px',
                                height: '250px'
                            })
                            .data('sizePreference', 'diff');

                        tip.find('.arrow').css({
                            left: parseInt(badge.position().left - (left / 2) + 1, 10) + 'px',
                            marginLeft: 0
                        });

                        // We fill in our own content
                        popover.setContent = function() {}
                        badge.on('shown.bs.popover', function() {
                            var css = {
                                top: (parseInt(tip.css('top')) - 10) + 'px'
                            };

                            tip.find('.arrow').css({
                                left: parseInt(badge.position().left - (left / 2) + 1, 10) + 'px',
                                marginLeft: 0
                            });

                            tip.resizable({
                                handles: 'n, e, ne',
                                maxWidth: self.popoverCss.maxWidth,
                                maxHeight: self.popoverCss.maxHeight
                            }).css({top: top});

                            self.updatePopoverSize(tip);

                            const $popoverContent = tip.find('.popover-content');

                            $popoverContent
                                .toggleClass(
                                    'loading-small-animate',
                                    Boolean(!$popoverContent.lookupComponent(Diff))
                                );

                            Diff.attachTo($popoverContent, {
                                diffs: filteredDiffs
                            });
                        }).on('hide', () => {
                            tip.find('.popover-content').teardownComponent(Diff);
                        })

                        Diff.teardownAll();
                    }
                });

                badge.removePrefixedClasses('badge-').addClass('badge-info')
                    .attr('title', i18n('workspaces.diff.unpublished_change.' + (
                        self.formattedCount === 1 ?
                        'one' : 'some'), self.formattedCount))
                    .text(count > 0 ? self.formattedCount : '');

                if (count > 0) {
                    self.animateBadge(badge);
                } else if (count === 0) {
                    // this will trigger an error due to a bootstrap bug
                    badge.popover('destroy');
                }
            })
        };

        var badgeReset, animateTimer;
        this.animateBadge = function(badge) {
            badge.text(this.formattedCount).css('width', 'auto');

            var self = this,
                html = '<span class="number">' + this.formattedCount + '</span>' +
                    '<span class="suffix"> ' + i18n('workspaces.diff.unpublished') + '</span>',
                previousWidth = badge.outerWidth(),
                findWidth = function() {
                    return (
                        badge.find('.number').outerWidth(true) +
                        badge.find('.suffix').outerWidth(true) +
                        parseInt(badge.css('paddingRight'), 10) * 2
                    ) + 'px';
                };

            if (animateTimer) {
                clearTimeout(animateTimer);
                animateTimer = _.delay(
                    badgeReset.bind(null, previousWidth),
                    SHOW_UNPUBLUSHED_CHANGES_SECONDS * 1000
                );
                return badge.html(html).css({ width: findWidth() })
            }

            var duration = '0.5s';
            badge.css({
                width: previousWidth + 'px',
                backgroundColor: '#ff9906',
                transition: 'all cubic-bezier(.29,.79,0,1.48) ' + duration,
                position: 'relative'
            }).html(html);

            requestAnimationFrame(function() {
                badge.css({
                    width: findWidth()
                }).find('.suffix').css({
                    transition: 'opacity ease-out ' + duration
                })

                animateTimer = _.delay((badgeReset = function(previousWidth) {
                    animateTimer = null;
                    badge.on(TRANSITION_END, function(e) {
                        if (e.originalEvent.propertyName === 'width') {
                            badge.off(TRANSITION_END);
                            badge.text(self.formattedCount).css('width', 'auto');
                        }
                    }).css({
                        transition: 'all cubic-bezier(.92,-0.42,.37,1.31) ' + duration,
                        width: previousWidth + 'px'
                    }).find('.suffix').css('opacity', 0);
                }).bind(null, previousWidth), SHOW_UNPUBLUSHED_CHANGES_SECONDS * 1000);
            })
        };
    }
});
