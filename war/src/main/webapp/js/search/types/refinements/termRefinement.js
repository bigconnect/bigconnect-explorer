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
    './termRefinement.hbs'
], function(
    defineComponent,
    withDataRequest,
    template
) {
    'use strict';

    return defineComponent(TermRefinement, withDataRequest);

    function TermRefinement() {
        this.defaultAttrs({
            refItemSelector: '.ref-item-link'
        });

        this.after('initialize', function() {
            const refinement = this.attr.refinement;
            this.attr.finalRefinement = {};
            var self = this;
            var totalNotEmpty = 0;
            var emptyBucket = null;

            _.keys(refinement.buckets).map(function(key) {
                if (refinement.buckets[key].label != 'N/A') {
                   self.attr.finalRefinement[key] = refinement.buckets[key];
                   totalNotEmpty += refinement.buckets[key].count;
                } else {
                    emptyBucket = refinement.buckets[key];
                }
            });

            if (emptyBucket) {
                emptyBucket.count = (emptyBucket.count - totalNotEmpty)/2;
                if (emptyBucket.count > 0) {
                    this.attr.finalRefinement['N/A'] = emptyBucket;
                }
            }

            this.on('click', { refItemSelector: this.onRefinementClick });

            this.$node.html(template({
                refItems: _.keys(this.attr.finalRefinement)
                    .sort((a, b) => self.attr.finalRefinement[b].count - self.attr.finalRefinement[a].count)
                    .map(function(key) {
						if (self.attr.finalRefinement[key].label !== null)
                        return {
                            refItemText: self.attr.finalRefinement[key].label,
                            refItemKey: key,
                            refItemCount: self.attr.finalRefinement[key].count,
                        }
                    })
            }))
        });

        this.onRefinementClick = function(event) {
            const $refLink = $(event.target),
                refBucketKey = $refLink.attr('bucket-key'),
                refBucket = this.attr.finalRefinement[refBucketKey],
                self = this;

            this.trigger('applyRefinement', {
                field: self.attr.refinement.field,
                bucketKey: refBucketKey,
                bucketValue: refBucket.label,
                bucketLabel: refBucket.label,
                category: self.attr.refinement.title,
                type: 'term'
            });
        }
    }
});
