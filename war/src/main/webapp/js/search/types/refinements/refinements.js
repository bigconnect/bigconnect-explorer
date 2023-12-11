
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
    './refinement.hbs',
    './termRefinement',
    './histogramRefinement',
], function(
    defineComponent,
    withDataRequest,
    template,
    TermRefinement,
    NumericHistogramRefinement
) {
    'use strict';

    return defineComponent(Refinements, withDataRequest);

    function Refinements() {
        this.after('initialize', function() {
            const refinements = this.attr.aggregates,
                  self = this;

            this.showRefinements = false;

            _.chain(refinements)
                .keys()
                .sortBy(function(key){ return key; })
                .map(function(key) {
                    const ref = refinements[key];
                    ref.title = key;

                    // avoid ElasticSearch bug for N/A aggregation
                    var totalNonNAcount = 0;
                    _.each(ref.buckets,function(bucket) {
                        if (bucket.label != 'N/A') totalNonNAcount+=bucket.count;
                    });

                    // show refinement if it has at least two values
                    if(_.reject(ref.buckets,function(bucket) {
                            return bucket.count === 0 || (bucket.label == 'N/A' && bucket.count == totalNonNAcount);
                        }).length > 1) {
                            self.createRefinementPanel(ref);
                        }

                });

            if(!this.showRefinements) {
                this.$node.append('<div class="no-refinements">No refinements</div>');
            }

            this.on('applyRefinement', this.onApplyRefinement);
        });

        this.onApplyRefinement = function(event, data) {
            var appliedRefs = $('.applied-refinements');
            this.addAppliedRefinement(appliedRefs, data);
            this.trigger('refinementAdded', data);
        };

        this.addAppliedRefinement = function(container, data) {
            var $appliedRef = $('<div class="applied-ref">'),
                $refName = $('<div class="applied-ref-name">'),
                $refDelete = $('<div class="applied-ref-delete">'),
                self = this;

            $refName.append('<span>' + data.category + ':' + data.displayName + '</span>');
            $refDelete.html('x');
            $refDelete.click(function() {
                self.removeAppliedRefinement($appliedRef, data);
            });
            $appliedRef.append($refName);
            $appliedRef.append($refDelete);
            $appliedRef.attr('refid', data.field);
            container.append($appliedRef);
        };

        this.removeAppliedRefinement = function(element, data) {
            var refinementId = data.field+'='+data.bucketKey;
            element.remove();
            this.trigger('refinementRemoved', data);
        };

        this.createRefinementPanel = function(ref) {
            var $refPanel = $(template({ header : ref.title }));
            var refPanelContainer = $refPanel.find('.ref-panel-content');
            if (ref.type === 'term') {
                TermRefinement.attachTo(refPanelContainer, {
                    refinement: ref
                });
            }
            else if (ref.type === 'histogram' && (ref.fieldType === 'double' || ref.fieldType === 'integer')) {
                NumericHistogramRefinement.attachTo(refPanelContainer, {
                    refinement: ref
                });
            } else if (ref.type === 'histogram' && ref.fieldType === 'date') {
                NumericHistogramRefinement.attachTo(refPanelContainer, {
                    refinement: ref
                });
            } else {
                throw new Error('Histogram type not supported: '+ref.fieldType);
            }

            this.$node.append($refPanel);
            this.showRefinements = true; // we have at least one refinement
        };
    }
});
