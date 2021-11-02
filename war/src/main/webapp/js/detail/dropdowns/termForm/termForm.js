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
    'util/withDropdown',
    './termForm.hbs',
    'tpl!util/alert',
    'util/vertex/formatters',
    'util/ontology/conceptSelect',
    'util/vertex/vertexSelect',
    'util/withDataRequest'
], function(
    defineComponent,
    withDropdown,
    dropdownTemplate,
    alertTemplate,
    F,
    ConceptSelector,
    VertexSelector,
    withDataRequest) {
    'use strict';

    return defineComponent(TermForm, withDropdown, withDataRequest);

    function TermForm() {

        this.defaultAttrs({
            actionButtonSelector: '.btn.btn-sm.btn-primary',
            buttonDivSelector: '.buttons',
            visibilitySelector: '.visibility',
            conceptContainerSelector: '.concept-container',
            vertexContainerSelector: '.vertex-container',
            helpSelector: '.help',
            addNewPropertiesSelector: '.none',
            relationshipsSelector: '.relationships'
        });

        this.after('teardown', function() {
            if (this.promoted && this.promoted.length) {
                this.demoteSpanToTextVertex(this.promoted);
            }

            // Remove extra textNodes
            if (this.node.parentNode) {
                this.node.parentNode.normalize();
            }
        });

        this.after('initialize', function() {
            this.deferredConcepts = $.Deferred();
            this.setupContent();
            this.registerEvents();
        });

        this.showTypeahead = function(options) {
            if (!this.unresolve) {
                this.select('vertexContainerSelector').trigger('showTypeahead', options);
            }
        };

        this.reset = function() {
            this.currentGraphVertexId = null;
            this.select('helpSelector').show();
            this.select('visibilitySelector').hide();
            this.select('conceptContainerSelector').hide();
            this.select('actionButtonSelector').hide();
            this.select('relationshipsSelector').hide();
        };

        this.onVertexSelected = function(event, data) {
            if (data && data.vertex) {
                this.sign = F.vertex.title(data.vertex);
                this.graphVertexChanged(data.vertex.id, data.vertex);
            } else {
                this.sign = data.sign;
                this.graphVertexChanged(null, null);
            }
        };

        this.graphVertexChanged = function(newGraphVertexId, item, initial) {
            var self = this;

            this.currentGraphVertexId = newGraphVertexId;
            if (!initial || newGraphVertexId) {
                var info = _.isObject(item) ? item.properties || item : $(this.attr.mentionNode).data('info');

                this.trigger(this.select('conceptContainerSelector'), 'enableConcept', {
                    enable: !newGraphVertexId
                });

                var conceptType = _.isArray(info) ?
                    _.findWhere(info, { name: ONTOLOGY_CONSTANTS.PROP_CONCEPT_TYPE }) :
                    (info && (info[ONTOLOGY_CONSTANTS.PROP_CONCEPT_TYPE] || info.concept));
                conceptType = conceptType && conceptType.value || conceptType || '';

                if (conceptType === '' && self.attr.restrictConcept) {
                    conceptType = self.attr.restrictConcept;
                }
                this.selectedConceptId = conceptType;

                this.deferredConcepts.done(function() {
                    self.trigger(self.select('conceptContainerSelector').show(), 'selectConceptId', {
                        conceptId: conceptType
                    });
                    self.checkValid();
                });

                if (this.unresolve) {
                    this.select('actionButtonSelector')
                        .text(i18n('detail.resolve.form.button.unresolve'))
                        .show();
                    this.$node.find('input,select').attr('disabled', true);
                } else {
                    this.select('actionButtonSelector')
                        .text(newGraphVertexId && !initial && !this.attr.coords ?
                              i18n('detail.resolve.form.button.resolve.existing') :
                              i18n('detail.resolve.form.button.resolve.new'))
                        .show();
                }
                this.select('helpSelector').hide();
                this.select('visibilitySelector').show();
                this.select('relationshipsSelector').show();

                this.$node.find('.visibility').teardownAllComponents();

                require(['util/visibility/edit'], function(Visibility) {
                    Visibility.attachTo(self.$node.find('.visibility'), {
                        value: '',
                        readonly: self.unresolve
                    });
                });

                if (!this.unresolve) {
                    this.$node.find('.justification').teardownAllComponents();
                    require(['detail/dropdowns/propertyForm/justification'], function(Justification) {
                        Justification.attachTo(self.$node.find('.justification'));
                    });
                }

                if(this.selectedConceptId && !this.unresolve) {
                    this.select('relationshipsSelector').show();
                    this.getRelationshipLabels(self.attr.conceptType, this.selectedConceptId);
                } else {
                    this.select('relationshipsSelector').hide();
                }
            } else if (this.attr.restrictConcept) {
                this.deferredConcepts.done(function() {
                    self.trigger(self.select('conceptContainerSelector'), 'selectConceptId', {
                        conceptId: self.attr.restrictConcept
                    })
                });
            }
        };

        this.onButtonClicked = function(event) {
            if (!this.attr.detectedObject) {
                this.termModification(event);
            } else {
                this.detectedObjectModification(event);
            }
        };

        this.termModification = function(event) {
            var self = this,
                $mentionNode = $(this.attr.mentionNode),
                newObjectSign = $.trim(this.sign),
                mentionStart,
                mentionEnd;

            const relationship = $.trim(this.select('relationshipsSelector').find('select').val());

            if (this.attr.existing) {
                var dataInfo = $mentionNode.data('info');
                mentionStart = dataInfo.start;
                mentionEnd = dataInfo.end;
            } else {
                mentionStart = this.selectedStart;
                mentionEnd = this.selectedEnd;
            }
            var parameters = {
                sign: newObjectSign,
                propertyKey: this.attr.propertyKey,
                propertyName: this.attr.propertyName,
                conceptId: this.selectedConceptId,
                mentionStart: mentionStart,
                mentionEnd: mentionEnd,
                artifactId: this.attr.artifactId,
                relationship: relationship,
                visibilitySource: this.visibilitySource ? this.visibilitySource.value : ''
            };

            if (this.currentGraphVertexId) {
                parameters.resolvedVertexId = this.currentGraphVertexId;
                parameters.edgeId = $mentionNode.data('info') ? $mentionNode.data('info').edgeId : null;
            }

            _.defer(this.buttonLoading.bind(this));

            if (!parameters.conceptId || parameters.conceptId.length === 0) {
                this.select('conceptContainerSelector').find('select').focus();
                return;
            }

            if (newObjectSign.length) {
                parameters.objectSign = newObjectSign;
                $mentionNode.attr('title', newObjectSign);
            }

            if (!this.unresolve) {
                if (self.attr.snippet) {
                    parameters.sourceInfo = {
                        vertexId: parameters.artifactId,
                        textPropertyKey: parameters.propertyKey,
                        textPropertyName: parameters.propertyName,
                        startOffset: parameters.mentionStart,
                        endOffset: parameters.mentionEnd,
                        snippet: self.attr.snippet
                    };
                }

                if (this.justification && this.justification.justificationText) {
                    parameters.justificationText = this.justification.justificationText;
                }

                this.dataRequest('vertex', 'resolveTerm', parameters)
                    .then(function(data) {
                        self.highlightTerm(data);
                        self.trigger('termCreated', data);

                        self.trigger(document, 'loadEdges');
                        self.trigger('closeDropdown');

                        _.defer(self.teardown.bind(self));
                    })
                    .catch(this.requestFailure.bind(this))
            } else {
                parameters.termMentionId = this.termMentionId;
                this.dataRequest('vertex', 'unresolveTerm', parameters)
                    .then(function(data) {
                        self.highlightTerm(data);

                        self.trigger(document, 'loadEdges');
                        self.trigger('closeDropdown');

                        _.defer(self.teardown.bind(self));
                    })
                    .catch(this.requestFailure.bind(this))
            }
        };

        this.requestFailure = function(request, message, error) {
            this.markFieldErrors(error);
            _.defer(this.clearLoading.bind(this));
        };

        this.detectedObjectModification = function(event) {
            var self = this,
                newSign = $.trim(this.sign),
                parameters = {
                    title: newSign,
                    conceptId: this.selectedConceptId,
                    originalPropertyKey: this.attr.dataInfo.originalPropertyKey,
                    graphVertexId: this.attr.dataInfo.resolvedVertexId ?
                        this.attr.dataInfo.resolvedVertexId :
                        this.currentGraphVertexId,
                    artifactId: this.attr.artifactData.id,
                    x1: parseFloat(this.attr.dataInfo.x1),
                    y1: parseFloat(this.attr.dataInfo.y1),
                    x2: parseFloat(this.attr.dataInfo.x2),
                    y2: parseFloat(this.attr.dataInfo.y2),
                    visibilitySource: this.visibilitySource ? this.visibilitySource.value : ''
                };

            if (!parameters.graphVertexId) {
                delete parameters.graphVertexId;
            }

            if (this.justification && this.justification.justificationText) {
                parameters.justificationText = this.justification.justificationText;
            }

            _.defer(this.buttonLoading.bind(this));
            if (this.unresolve) {
                self.unresolveDetectedObject({
                    vertexId: this.attr.artifactData.id,
                    multiValueKey: this.attr.dataInfo.key || this.attr.dataInfo.propertyKey
                });
            } else {
                self.resolveDetectedObject(parameters);
            }
        };

        this.resolveDetectedObject = function(parameters) {
            var self = this;
            this.dataRequest('vertex', 'resolveDetectedObject', parameters)
                .then(function(data) {
                    self.trigger('termCreated', data);
                    self.trigger(document, 'loadEdges');
                    self.trigger('closeDropdown');
                    self.teardown.bind(self);
                })
                .catch(this.requestFailure.bind(this))
        };

        this.unresolveDetectedObject = function(parameters) {
            var self = this;
            this.dataRequest('vertex', 'unresolveDetectedObject', parameters)
                .then(function(data) {
                    self.trigger(document, 'loadEdges');
                    self.trigger('closeDropdown');
                    self.teardown.bind(self);
                })
                .catch(this.requestFailure.bind(this))
        };

        this.onConceptSelected = function(event, data) {
            var relationshipSelector = this.select('relationshipsSelector'),
                vertexContainer = this.select('vertexContainerSelector');

            this.selectedConceptId = data && data.concept && data.concept.id || '';
            if (this.selectedConceptId) {
                vertexContainer.trigger('setConcept', { conceptId: this.selectedConceptId });
                relationshipSelector.show();
                this.getRelationshipLabels(this.attr.conceptType, this.selectedConceptId);
            } else {
                vertexContainer.trigger('setConcept');
                relationshipSelector.hide();
            }
            this.checkValid();
        };

        this.onVisibilityChange = function(event, data) {
            this.visibilitySource = data;
            this.checkValid();
        };

        this.onJustificationChange = function(event, data) {
            this.justification = data;
            this.checkValid();
        };

        this.checkValid = function() {
            var button = this.select('actionButtonSelector');
            var visibilityValid = this.visibilitySource && this.visibilitySource.valid;

            if (!this.unresolve) {
                this.select('visibilitySelector').find('input').toggleClass('invalid', !visibilityValid);
                if (this.justification && this.justification.valid && this.selectedConceptId && visibilityValid) {
                    button.removeAttr('disabled');
                } else {
                    button.attr('disabled', true);
                }
            } else {
                button.removeAttr('disabled');
            }
        };

        this.setupContent = function() {
            var self = this,
                vertex = this.$node,
                existingEntity,
                objectSign = '',
                data, graphVertexId, title;

            if (!this.attr.detectedObject) {
                var mentionVertex = $(this.attr.mentionNode);
                data = mentionVertex.data('info');
                existingEntity = this.attr.existing ? mentionVertex.addClass('focused').hasClass('resolved') : false;
                title = $.trim(data && data.title || '');

                if (this.attr.selection && !existingEntity) {
                    this.trigger(document, 'ignoreSelectionChanges.detail');
                    this.promoted = this.promoteSelectionToSpan();

                    _.defer(function() {
                        self.trigger(document, 'resumeSelectionChanges.detail');
                    });
                }

                if (existingEntity && mentionVertex.hasClass('resolved')) {
                    objectSign = title;
                    this.unresolve = this.attr.unresolve;
                    graphVertexId = this.unresolve && data && data.metadata[ONTOLOGY_CONSTANTS.PROP_DETECTED_OBJECT_META] &&
                        (data.metadata[ONTOLOGY_CONSTANTS.PROP_DETECTED_OBJECT_META].resolvedToVertexId || data.metadata[ONTOLOGY_CONSTANTS.PROP_DETECTED_OBJECT_META].resolvedVertexId);
                    this.termMentionId = data && data.id;
                } else {
                    objectSign = this.attr.sign || mentionVertex.text();
                }
            } else {
                data = this.attr.dataInfo;
                objectSign = data && data.title;
                existingEntity = this.attr.existing;
                this.unresolve = this.attr.unresolve;
                graphVertexId = this.unresolve && data && data.metadata[ONTOLOGY_CONSTANTS.PROP_DETECTED_OBJECT_META] &&
                    (data.metadata[ONTOLOGY_CONSTANTS.PROP_DETECTED_OBJECT_META].resolvedToVertexId || data.metadata[ONTOLOGY_CONSTANTS.PROP_DETECTED_OBJECT_META].resolvedVertexId);
            }

            vertex.html(dropdownTemplate({
                classNames: `${this.unresolve ? 'form unresolve' : 'form'}`,
                sign: $.trim(objectSign),
                graphVertexId: graphVertexId || '',
                objectSign: $.trim(objectSign) || '',
                buttonText: existingEntity ?
                    i18n('detail.resolve.form.button.resolve.existing') :
                    i18n('detail.resolve.form.button.resolve.new'),
                unresolve: this.unresolve
            }));

            ConceptSelector.attachTo(this.select('conceptContainerSelector').toggle(!!graphVertexId), {
                restrictConcept: this.attr.restrictConcept
            });

            VertexSelector.attachTo(this.select('vertexContainerSelector'), {
                value: objectSign || '',
                filterResultsToTitleField: true,
                defaultText: i18n('detail.resolve.form.entity_search.placeholder'),
                allowNew: false
            });

            this.graphVertexChanged(graphVertexId, data, true);

            if (!this.unresolve && objectSign) {
                this.select('vertexContainerSelector').trigger('disableAndSearch', {
                    query: objectSign
                })
            }

            this.sign = objectSign;
            this.startSign = objectSign;
        };

        this.getRelationshipLabels = function(sourceConceptTypeId, destConceptTypeId) {
            var relationshipSelect = this.select('relationshipsSelector').find('select');

            relationshipSelect.html('<option>' + i18n('popovers.connection.loading') + '</option>');

            return Promise.all([
                this.dataRequest('ontology', 'relationshipsBetween', sourceConceptTypeId, destConceptTypeId),
                this.dataRequest('ontology', 'relationships')
            ]).then(function(results) {
                var relationships = results[0],
                    ontologyRelationships = results[1],
                    relationshipsTpl = [];

                relationships.forEach(function(relationship) {
                    var ontologyRelationship = ontologyRelationships.byTitle[relationship.title];
                    if (ontologyRelationship && ontologyRelationship.userVisible !== false) {
                        relationshipsTpl.push({
                            title: relationship.title,
                            displayName: ontologyRelationship.displayName
                        });
                    }
                });

                return relationshipsTpl;
            }).done(function(relationships) {
               if (relationships.length) {
                    relationshipSelect.html(
                        relationships.map(function(d) {
                            return '<option value="' + d.title + '">' + d.displayName + '</option>';
                        }).join('')
                    );
                } else {
                    relationshipSelect.html('<option>' + i18n('relationship.form.no_valid_relationships') + '</option>');
                }
            });
        };

        this.conceptForConceptType = function(conceptType, allConcepts) {
            return _.findWhere(allConcepts, { id: conceptType });
        };

        this.registerEvents = function() {

            this.on('visibilitychange', this.onVisibilityChange);
            this.on('justificationchange', this.onJustificationChange);

            this.on('conceptSelected', this.onConceptSelected);
            this.on('resetTypeahead', this.reset);
            this.on('vertexSelected', this.onVertexSelected);

            this.on('click', {
                actionButtonSelector: this.onButtonClicked,
                helpSelector: function() {
                    this.showTypeahead({
                        focus: true
                    });
                }
            });

            this.on('opened', function() {
                var self = this;

                this.loadConcepts()
                    .then(function() {
                        self.deferredConcepts.resolve(self.allConcepts);
                    })
            });
        };

        this.loadConcepts = function() {
            var self = this;
            self.allConcepts = [];
            return this.dataRequest('ontology', 'concepts')
                .then(function(concepts) {
                    var vertexInfo;

                    if (self.attr.detectedObject) {
                        vertexInfo = self.attr.dataInfo;
                    } else {
                        var mentionVertex = $(self.attr.mentionNode);
                        vertexInfo = mentionVertex.data('info');
                    }

                    self.allConcepts = _.filter(concepts.byTitle, function(c) {
                        return c.userVisible !== false;
                    });

                    self.selectedConceptId = vertexInfo && (
                        vertexInfo[ONTOLOGY_CONSTANTS.PROP_CONCEPT_TYPE] ||
                        (
                            vertexInfo.properties &&
                            vertexInfo.properties[ONTOLOGY_CONSTANTS.PROP_CONCEPT_TYPE].value
                        )
                    ) || '';

                    self.trigger(self.select('conceptContainerSelector'), 'selectConceptId', {
                        conceptId: self.selectedConceptId
                    });

                    if (!self.selectedConceptId) {
                        self.select('actionButtonSelector').attr('disabled', true);
                    }
                });
        };

        this.highlightTerm = function(data) {
            var mentionVertex = $(this.attr.mentionNode),
                updatingEntity = this.attr.existing;

            if (updatingEntity) {
                mentionVertex.removeClass();
                if (data.cssClasses) {
                    mentionVertex.addClass(data.cssClasses.join(' '));
                }
                mentionVertex.data('info', data.info).removeClass('focused');

            } else if (this.promoted) {
                this.promoted.data('info', data.info)
                    .addClass((data.cssClasses && data.cssClasses.join(' ')) || '')
                    .removeClass('focused');
                this.promoted = null;
            }
        };

        this.promoteSelectionToSpan = function() {
            var isTranscript = this.$node.closest('.av-times').length,
                range = this.attr.selection.range,
                el,
                tempTextNode,
                transcriptIndex = 0,
                span = document.createElement('span');

            span.className = 'vertex focused';

            var newRange = document.createRange();
            newRange.setStart(range.startContainer, range.startOffset);
            newRange.setEnd(range.endContainer, range.endOffset);

            var r = range.cloneRange();

            if (isTranscript) {
                var dd = this.$node.closest('dd');
                r.selectNodeContents(dd.get(0));
                transcriptIndex = dd.data('index');
            } else {
                var $text = this.$node.closest('.text');
                if ($text.length) {
                    r.selectNodeContents($text.get(0));
                }
            }
            r.setEnd(range.startContainer, range.startOffset);
            var l = r.toString().length;

            this.selectedStart = l;
            this.selectedEnd = l + range.toString().length;

            if (isTranscript) {
                this.selectedStart = F.number.compactOffsetValues(transcriptIndex, this.selectedStart);
                this.selectedEnd = F.number.compactOffsetValues(transcriptIndex, this.selectedEnd);
            }

            // Special case where the start/end is inside an inner span
            // (surroundsContents will fail so expand the selection
            if (/vertex/.test(range.startContainer.parentNode.className)) {
                el = range.startContainer.parentNode;
                var previous = el.previousSibling;

                if (previous && previous.nodeType === 3) {
                    newRange.setStart(previous, previous.textContent.length);
                } else {
                    tempTextNode = document.createTextNode('');
                    el.parentNode.insertBefore(tempTextNode, el);
                    newRange.setStart(tempTextNode, 0);
                }
            }
            if (/vertex/.test(range.endContainer.parentNode.className)) {
                el = range.endContainer.parentNode;
                var next = el.nextSibling;

                if (next && next.nodeType === 3) {
                    newRange.setEnd(next, 0);
                } else {
                    tempTextNode = document.createTextNode('');
                    if (next) {
                        el.parentNode.insertBefore(tempTextNode, next);
                    } else {
                        el.appendChild(tempTextNode);
                    }
                    newRange.setEnd(tempTextNode, 0);
                }
            }
            newRange.surroundContents(span);

            return $(span).find('.vertex').addClass('focused').end();
        };

        this.demoteSpanToTextVertex = function(vertex) {

            while (vertex[0].childNodes.length) {
                $(vertex[0].childNodes[0]).removeClass('focused');
                vertex[0].parentNode.insertBefore(vertex[0].childNodes[0], vertex[0]);
            }
            vertex.remove();
        };
    }
});
