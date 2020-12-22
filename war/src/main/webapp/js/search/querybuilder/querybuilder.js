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
    'flight/lib/registry',
    './querybuilder.hbs',
    'search/sort',
    'util/vertex/formatters',
    'util/ontology/conceptSelect',
    'util/ontology/relationshipSelect',
    'util/withDataRequest',
    'configuration/plugins/registry',
    'd3',
    'jquery-query-builder'
], function(
    defineComponent,
    flightRegistry,
    template,
    SortFilter,
    F,
    ConceptSelector,
    RelationshipSelector,
    withDataRequest,
    registry,
    d3) {
    'use strict';

    return defineComponent(QueryBuilder, withDataRequest);

    function QueryBuilder() {
        this.visible = false;
        this.attributes({
            queryBuilderContainer: '.qb-container',
            resetButtonSelector: '.qb-reset-button',
            searchButtonSelector: '.qb-search-button',
            returnDivSelector: '.qb-return-div',
            toggleSelector: '.qb-toggle'
        });

        this.resetVisibility = function(event, data) {
            this.visible = false;
        };

        this.after('initialize', function() {
            this.$node.html(template({}));
            this.on(document, 'switchSearchTriggered', this.resetVisibility);

            const self = this;
            const DEFAULT_OPERATOR_LABEL = '-----';
            const EQUALS_CI_OPERATOR_LABEL = 'equal_case_insensitive';
            const SELECTED_ENTITIES_FILTER_GROUP = 'Selected entities';
            const UPDATE_TIMEOUT = 500; // millis
            const OPERATOR_TO_CYPHER_EXPR_TEMPLATE = {
                'equal': '[[prop]] = [[value]]',
                'equal_case_insensitive': 'toLower([[prop]]) = toLower([[value]])',
                'not_equal': '[[prop]] <> [[value]]',
                'less': '[[prop]] < [[value]]',
                'less_or_equal': '[[prop]] <= [[value]]',
                'greater': '[[prop]] > [[value]]',
                'greater_or_equal': '[[prop]] >= [[value]]',
                'is_null': '[[prop]] IS NULL',
                'is_not_null': 'NOT [[prop]] IS NULL',
                'begins_with': '[[prop]] STARTS WITH [[value]]',
                'not_begins_with': 'NOT [[prop]] STARTS WITH [[value]]',
                'contains': '[[prop]] CONTAINS [[value]]',
                'not_contains': 'NOT [[prop]] CONTAINS [[value]]',
                'between': '[[value1]] <= [[prop]] <= [[value2]]'
            };
            const QUERY_BUILDER_TYPES = ['string', 'integer', 'double', 'date', 'time', 'datetime', 'boolean'];
            const TYPE_TO_OPERATORS = {
                'string': ['equal', 'equal_case_insensitive', 'not_equal', 'begins_with', 'not_begins_with', 'contains', 'not_contains', 'ends_with', 'not_ends_with', 'is_empty', 'is_not_empty', 'is_null', 'is_not_null'],
                'integer': ['equal', 'not_equal', 'less', 'less_or_equal', 'greater', 'greater_or_equal', 'between', 'not_between', 'is_null', 'is_not_null'],
                'double': ['equal', 'not_equal', 'less', 'less_or_equal', 'greater', 'greater_or_equal', 'between', 'not_between', 'is_null', 'is_not_null'],
                'date': ['equal', 'not_equal', 'less', 'less_or_equal', 'greater', 'greater_or_equal', 'between', 'not_between', 'is_null', 'is_not_null'],
                'time': ['equal', 'not_equal', 'less', 'less_or_equal', 'greater', 'greater_or_equal', 'between', 'not_between', 'is_null', 'is_not_null'],
                'datetime': ['equal', 'not_equal', 'less', 'less_or_equal', 'greater', 'greater_or_equal', 'between', 'not_between', 'is_null', 'is_not_null'],
                'boolean': ['equal', 'not_equal', 'is_null', 'is_not_null']
            };

            // global state variables
            let updateInProgress = false;
            let userHasUpdatedReturn = false;

            this.dataRequest('ontology', 'ontology').then(function(results) {
                const conceptFilters = [];
                const propertyFilters = [];
                const operators = [];
                const globalOperators = [];
                /**
                 * Holds real-time reference to user-defined concept variables.
                 * For each concept, list of variables.
                 */
                const conceptVariables = {};
                let currentVariableIndex = 97; //a

                // add default operator
                globalOperators.push({ type: DEFAULT_OPERATOR_LABEL,  nb_inputs: 0, multiple: false, apply_to: ['string'] });
                operators.push(DEFAULT_OPERATOR_LABEL);
                globalOperators.push({ type: EQUALS_CI_OPERATOR_LABEL, nb_inputs: 1, multiple: false, apply_to: ['string'] });

                for (let i = 0; i < results.relationships.list.length; i++) {
                    const rel = results.relationships.list[i];
                    if (rel.userVisible) {
                        globalOperators.push({ type: rel.title,  nb_inputs: 1, multiple: false, apply_to: ['string'], optgroup: 'Relationships' });
                        operators.push(rel.title);
                    }
                }

                // VALUES
                const values = [];
                for (let i = 0; i < results.concepts.byTitle.length; i++) {
                    let concept = results.concepts.byTitle[i];
                    if (concept.userVisible) {
                        values.push({value: concept.id, label: concept.id});
                    }
                }

                // CONCEPT FILTERS
                for (let i = 0; i < results.concepts.byTitle.length; i++) {
                    const concept = results.concepts.byTitle[i];
                    if (concept.userVisible) {
                        conceptFilters.push({
                            id: concept.id,
                            label: concept.id,
                            type: 'string',
                            input_event: 'change',
                            input: 'select',
                            values: [...values],
                            optgroup: 'Entities',
                            operators: operators
                        });
                    }
                }

                // PROPERTY FILTERS
                function getTypeFromOntologyProp(prop) {
                    let mappedType = 'string';
                    if (QUERY_BUILDER_TYPES.indexOf(prop.dataType) >= 0) {
                        mappedType = prop.dataType;
                    }
                    return mappedType;
                }

                for (let i = 0; i < results.properties.list.length; i++) {
                    const prop = results.properties.list[i];
                    if (prop.userVisible) {
                        const propType = getTypeFromOntologyProp(prop);
                        const propOperators = TYPE_TO_OPERATORS[propType];

                        const propertyFilter = {
                            id: prop.title,
                            label: prop.title,
                            type: propType,
                            optgroup: 'Properties',
                            operators: propOperators
                        };

                        if (propertyFilter.type === 'boolean') {
                            propertyFilter.input = 'radio';
                            propertyFilter.operators = ['equal'];
                            propertyFilter.values = {"false":"No", "true":"Yes"};
                        }

                        if (propertyFilter.type === 'date') {
                            // date validation requires moment.js
                            // propertyFilter.validation = {
                            //     format: 'YYYY/MM/DD'
                            // };
                            propertyFilter.plugin = 'datepicker';
                            propertyFilter.plugin_config = {
                                format: 'yyyy-mm-dd',
                                todayBtn: 'linked',
                                todayHighlight: true,
                                autoclose: true
                            }
                        }

                        propertyFilters.push(propertyFilter);
                    }
                }

                initEvents();

                self.select('queryBuilderContainer').queryBuilder({
                    plugins: ['bt-tooltip-errors', 'filter-description', 'not-group'],
                    operators: $.fn.queryBuilder.constructor.DEFAULTS.operators.concat(globalOperators),
                    filters: conceptFilters.concat(propertyFilters),
                    lang: {
                        add_group: 'Property filter'
                    },
                    allow_groups: 1,
                    allow_empty: true
                });

                function initEvents() {
                    self.select('searchButtonSelector').on('click', function(event) {
                        convertToCypher();
                    });

                    self.select('resetButtonSelector').on('click', function(event) {
                        resetBuilder();
                    });

                    $($('.qb-return-input')[0]).on('keyup', function (event) {
                        userHasUpdatedReturn = true;
                    });

                    self.select('toggleSelector').on('click', function(event) {
                        self.visible = !self.visible;
                        if (!self.visible) {
                            self.select('queryBuilderContainer').hide();
                            self.select('searchButtonSelector').hide();
                            self.select('returnDivSelector').hide();
                        } else {
                            self.select('queryBuilderContainer').show();
                            self.select('searchButtonSelector').show();
                            self.select('returnDivSelector').show();
                            $($('.group-conditions')[0]).html('<span style="font-weight:bold; padding:5px;">Entity->Relationship->Entity rules<span>');
                        }
                    });

                    self.select('queryBuilderContainer').on('afterAddGroup.queryBuilder', function(event, group) {
                        // Hide 'NOT' operator
                        // $('button[data-not="group"]').hide();
                        const rules = getCurrentRules(true);
                        if (rules.length > 1 && !isGroup(rules[rules.length - 2])) {
                            console.log('Disable parent rule');
                            const ruleContainers = $('.qb-container .rule-container');
                            $(ruleContainers[ruleContainers.length-1]).find(':input').prop("disabled", true);
                            $(ruleContainers[ruleContainers.length-1]).css( "background-color", "gray" );
                        }
                    });

                    self.select('queryBuilderContainer').on('afterDeleteGroup.queryBuilder', function(event, group) {
                        const rules = getCurrentRules();
                        if (rules.length > 0 && !isGroup(rules[rules.length - 1])) {
                            const ruleContainers = $('.qb-container .rule-container');
                            $(ruleContainers[ruleContainers.length-1]).find(':input').prop("disabled", false);
                            $(ruleContainers[ruleContainers.length-1]).css( "background-color", "" );
                        }
                    });

                    self.select('queryBuilderContainer').on('beforeAddGroup.queryBuilder', function(event, group) {
                       const rules = getCurrentRules(true);
                       if (!builderIsValid() || isGroup(rules[rules.length - 1])) {
                           event.preventDefault();
                       }
                    });

                    self.select('queryBuilderContainer').on('getRuleFilters.queryBuilder.filter', function(event, rule) {
                        if (rule.level > 2) {
                            const firstEntityProps = [];
                            const secondEntityProps = [];
                            const cRules = getCurrentRules(true);
                            const associatedRule = cRules[cRules.length - 2];
                            const size = propertyFilters.length;

                            for (let i = 0; i < size; i++) {
                                if (!isDynamicConcept(associatedRule.id)) {
                                    continue;
                                }
                                if (isDynamicConcept(propertyFilters[i].id) && propertyFilters[i].optgroup === associatedRule.id) {
                                    firstEntityProps.push(Object.assign({}, propertyFilters[i]));
                                }

                                // in case rule doesn't have value completed - right selectbox, we don't generate properties for it
                                if (!isDynamicConcept(associatedRule.value)) {
                                    continue;
                                }
                                if (isDynamicConcept(propertyFilters[i].id) && propertyFilters[i].optgroup === associatedRule.value) {
                                    secondEntityProps.push(Object.assign({}, propertyFilters[i]));
                                }
                            }
                            event.value = firstEntityProps.concat(secondEntityProps);
                        } else {
                            event.value = conceptFilters;
                        }
                    });

                    self.select('queryBuilderContainer').on('afterUpdateRuleFilter.queryBuilder', function(event, rule, previousFilter) {
                        if (rule.level == 2 && !updateInProgress && rule.filter && !isDynamicConcept(getConceptId(rule))) {
                            rule.filter = addNewFilter(rule.filter);
                            setTimeout(function () {
                                refreshRules();
                            }, UPDATE_TIMEOUT);
                        } else {
                            builderIsValid();
                        }
                    });

                    self.select('queryBuilderContainer').on('afterUpdateRuleValue.queryBuilder', function(event, rule, previousValue) {
                        if (rule.level === 2 && !updateInProgress && isDynamicConcept(getConceptId(rule)) && rule.value && !isDynamicConcept(rule.value)) {
                            const curConcept = listContainsById(conceptFilters, rule.value);
                            if (curConcept) {
                                setTimeout(function() {
                                    if (!updateInProgress && !isDynamicConcept(rule.value)) {
                                        const newFilter = addNewFilter(curConcept);
                                        rule.value = newFilter.id;
                                        setTimeout(function () {
                                            refreshRules();
                                        }, UPDATE_TIMEOUT);
                                    }
                                    // updateIdGenerator();
                                }, UPDATE_TIMEOUT);
                            }
                        }

                        // Fix for Bootstrap Datepicker
                        if (rule.filter.plugin === 'datepicker') {
                            rule.$el.find('.rule-value-container input').datepicker('update');
                        }
                    });
                }

                function refreshRules() {
                    if (builderIsValid()) {
                        const rootGroup = self.select('queryBuilderContainer').queryBuilder('getRules');
                        self.select('queryBuilderContainer').queryBuilder('setRules', rootGroup);

                        // automatically add default variable to return input
                        if (!userHasUpdatedReturn) {
                            const rules = getCurrentRules();
                            if (rules.length > 0 && isDynamicConcept(rules[0].id)) {
                                const variable = getVariableFromFilter(rules[0].id);
                                $($('.qb-return-input')[0]).val(variable);
                            }
                        }
                    }

                    $($('.group-conditions')[0]).html('<span style="font-weight:bold; padding:5px;">Entity->Relationship->Entity rules<span>');
                }

                function updateFilters(newConceptFilters) {
                    self.select('queryBuilderContainer').queryBuilder('setFilters', true, newConceptFilters.concat(propertyFilters));
                }

                function updateIdGenerator() {
                    setTimeout(function() {
                        deleteUnusedConcepts();
                        currentVariableIndex++;
                        updateInProgress = false;
                        // update all rules, so option values are also updated
                        // refreshRules();
                    }, UPDATE_TIMEOUT);
                }

                function getNewIdAndLabel(existingFilter) {
                    const newObj = {
                        id: String.fromCharCode(currentVariableIndex) + ':' + existingFilter.id,
                        label: String.fromCharCode(currentVariableIndex) + ':' + existingFilter.label
                    };
                    return newObj;
                }

                function listContainsById(list, itemId) {
                    for (let i = 0; i < list.length; i++) {
                        if (list[i].id === itemId) {
                            return list[i];
                        }
                    }
                    return null;
                }

                function getConceptIdFromFilter(filterId) {
                    return filterId.split(':')[1];
                }

                function getVariableFromFilter(filterId) {
                    return filterId.split(':')[0];
                }

                function getBasePropertyName(dynamicProperty) {
                    return dynamicProperty.split('|')[1];
                }

                /**
                 * Add new variable to global list of variables.
                 *
                 * @param filter
                 * @param newFilter
                 * @param variableName
                 */
                function addToVariables(newFilter) {
                    const conceptId = getConceptIdFromFilter(newFilter.id);
                    const variableName = getVariableFromFilter(newFilter.id);
                    if (!conceptVariables[conceptId]) {
                        conceptVariables[conceptId] = [];
                    }
                    conceptVariables[conceptId].push({
                        id: newFilter.id,
                        label: newFilter.label,
                        variable: variableName
                    });
                }

                function deleteFromVariables(filterId) {
                    const conceptId = getConceptIdFromFilter(filterId);
                    const variableName = getVariableFromFilter(filterId);
                    if (!conceptVariables[conceptId]) {
                        return;
                    }
                    let lastIndex = -1;
                    for (let i = 0; i < conceptVariables[conceptId]; i++) {
                        const curVar = conceptVariables[i];
                        if (curVar.variable === variableName) {
                            lastIndex = i;
                            break;
                        }
                    }
                    conceptVariables[conceptId].splice(lastIndex, 1);
                }

                function addValueToFilter(filter, newValue) {
                    const filterValues = filter.values;
                    for (let i = 0; i < filterValues.length; i++) {
                        let curValue = filterValues[i];
                        if (curValue.value === newValue.value) {
                            return;
                        }
                    }
                    filterValues.push(newValue);
                }

                function deleteValueFromFilter(filter, value) {
                    const filterValues = filter.values;
                    let lastIndex = -1;
                    for (let i = 0; i < filterValues.length; i++) {
                        let curValue = filterValues[i];
                        if (curValue.value === value) {
                            lastIndex = i;
                            break;
                        }
                    }
                    filterValues.splice(lastIndex, 1);
                }

                function addNewFilter(sourceFilter) {
                    if (updateInProgress) {
                        return;
                    }
                    updateInProgress = true;
                    const newFilterIdAndLabel = getNewIdAndLabel(sourceFilter);
                    const newFilterId = newFilterIdAndLabel.id;
                    const newFilterLabel = newFilterIdAndLabel.label;
                    const existingFilter = listContainsById(conceptFilters, newFilterId);

                    if (existingFilter) {
                        updateInProgress = false;
                        return existingFilter;
                    }

                    const newFilter = Object.assign({}, sourceFilter);
                    newFilter.optgroup = SELECTED_ENTITIES_FILTER_GROUP;
                    newFilter.id = newFilterId;
                    newFilter.label = newFilterLabel;

                    addToVariables(newFilter);

                    conceptFilters.push(newFilter);
                    for (let i = 0; i < conceptFilters.length; i++) {
                        addValueToFilter(conceptFilters[i], {value: newFilterId, label: newFilterLabel, optgroup: SELECTED_ENTITIES_FILTER_GROUP});
                    }

                    const newPropertyFilters = [];
                    for (let i = 0; i< propertyFilters.length; i++) {
                        if (!isDynamicConcept(propertyFilters[i].id)) {
                            const newPropertyFilter = Object.assign({}, propertyFilters[i]);
                            newPropertyFilter.id = newFilterId + '|' + propertyFilters[i].id;
                            newPropertyFilter.optgroup = newFilterId;
                            newPropertyFilters.push(newPropertyFilter);
                        }
                    }
                    propertyFilters.push(...newPropertyFilters);
                    updateFilters(conceptFilters);

                    updateIdGenerator();

                    return newFilter;
                }

                function getConceptId(rule) {
                    if (rule.filter) {
                        return rule.filter.id;
                    } else if (rule.id) {
                        return rule.id;
                    }
                    return null;
                }

                function getRuleValue(rule) {
                    if (rule.value) {
                        return rule.value;
                    }
                    return null;
                }

                function isDynamicConcept(conceptId) {
                    if (!conceptId) {
                        return false;
                    }
                    return conceptId.indexOf(':') > 0;
                }

                function builderIsValid() {
                    let valid = false;
                    const root = self.select('queryBuilderContainer').queryBuilder('getRules');
                    if (root && root.valid === true) {
                        valid = true;
                    }

                    return valid;
                }


                function isGroup(rule) {
                    if (rule && rule.rules && rule.condition) {
                        return true;
                    }
                    return false;
                }

                function getCurrentRules(allowInvalid) {
                    let rules = [];
                    const rootGroup = self.select('queryBuilderContainer').queryBuilder('getRules', {allow_invalid: allowInvalid && allowInvalid === true});
                    if (rootGroup && rootGroup.rules) {
                        rules = rootGroup.rules;
                    }

                    return rules;
                }

                function deleteUnusedConcepts() {
                    if (!builderIsValid()) {
                        return;
                    }
                    const unusedConcepts = [];
                    const rules = getCurrentRules();
                    for (let i = 0; i < conceptFilters.length; i++) {
                        const conceptId = conceptFilters[i].id;
                        if (!isDynamicConcept(conceptId)) {
                            continue;
                        }
                        let conceptMatches = 0;
                        for (let j = 0; j < rules.length; j++) {
                            const curRule = rules[j];
                            const ruleConceptId = getConceptId(curRule);
                            const ruleValue = getRuleValue(curRule);
                            if ((ruleConceptId && ruleConceptId === conceptId)
                                    || (ruleValue && ruleValue === conceptId)) {
                                conceptMatches++;
                            }
                        }
                        if (conceptMatches === 0) {
                            unusedConcepts.push(conceptId);
                        }
                    }

                    if (unusedConcepts.length > 0) {
                        for (let i = 0; i < unusedConcepts.length; i++) {
                            const conceptToDelete = unusedConcepts[i];
                            deleteFromVariables(conceptToDelete);
                            let lastIndex = -1;
                            for (let i = 0; i < conceptFilters.length; i++) {
                                if (conceptFilters[i].id === conceptToDelete) {
                                    lastIndex = i;
                                    break;
                                }
                            }
                            conceptFilters.splice(lastIndex, 1);
                            for (let i = 0; i < conceptFilters.length; i++) {
                                deleteValueFromFilter(conceptFilters[i], conceptToDelete);
                            }
                        }
                        updateFilters(conceptFilters);
                        // setTimeout(function () {
                        refreshRules();
                        // }, UPDATE_TIMEOUT);
                    }
                }

                function getCypherValue(type, qbValue) {
                    let cypherValue;
                    if (type === 'date') {
                        cypherValue = `date('${qbValue}')`;
                    } else if (type === 'boolean' || type === 'integer' || type === 'double') {
                        cypherValue = `${qbValue}`;
                    } else {
                        cypherValue = `'${qbValue}'`;
                    }
                    return cypherValue;
                }

                function convertToCypherExpression(filterRule) {
                    let expression = null;
                    const variable = getVariableFromFilter(filterRule.id);
                    const property = getBasePropertyName(filterRule.id);
                    const cypherExprTempl = OPERATOR_TO_CYPHER_EXPR_TEMPLATE[filterRule.operator];
                    if (cypherExprTempl) {
                        expression = new String(cypherExprTempl);
                        if (filterRule.value instanceof Array) {
                            for (let i = 0; i < filterRule.value.length; i++) {
                                expression = expression.replace(`[[value${i+1}]]`, getCypherValue(filterRule.type, filterRule.value[i]));
                            }
                        } else {
                            expression = expression.replace('[[value]]', getCypherValue(filterRule.type, filterRule.value));
                        }
                        expression = expression.replace('[[prop]]', filterRule.type === 'date' ? `date(${variable}.${property})` : `${variable}.${property}`);
                    } else {
                        console.log(`WARN - operator ${filterRule.operator} has no Cypher mapping defined.`);
                    }
                    return expression;
                }

                function convertToCypher() {
                    const rules = getCurrentRules();

                    if (rules.length === 0) {
                        alert('No rules defined !');
                        return;
                    }

                    const matchClauses = [];
                    const whereClauses = [];
                    const returnClauses = [];

                    // MATCH AND WHERE
                    for (let i = 0; i < rules.length; i++) {
                        const rule = rules[i];
                        if (isGroup(rule)) {
                            // WHERE
                            const group = rule;
                            const groupNegation = group.not;
                            const groupCondition = group.condition;
                            const propRules = group.rules;
                            if (propRules.length > 0) {
                                const wherePatterns = [];
                                for (let propIndex = 0; propIndex < propRules.length; propIndex++) {
                                    const cypherExpression = convertToCypherExpression(propRules[propIndex]);
                                    if (cypherExpression) {
                                        wherePatterns.push(cypherExpression);
                                    }
                                }
                                if (wherePatterns.length > 0) {
                                    let whereClause = '';
                                    for (let pIndex = 0; pIndex < wherePatterns.length; pIndex++) {
                                        whereClause += ' ' + wherePatterns[pIndex];
                                        if (pIndex < wherePatterns.length - 1) {
                                            whereClause += ' ' + groupCondition;
                                        }
                                    }
                                    if (groupNegation === true) {
                                        whereClauses.push(`NOT (${whereClause})`);
                                    } else {
                                        whereClauses.push(whereClause);
                                    }
                                }
                            }
                        } else {
                            // MATCH
                            let leftRelVar = rule.id;
                            const concept = listContainsById(conceptFilters, rule.id);
                            if (concept) {
                                leftRelVar = concept.label;
                            }
                            if (rule.operator === DEFAULT_OPERATOR_LABEL) {
                                matchClauses.push(`(${leftRelVar})`);
                            } else {
                                let rightRelVar = rule.value;
                                const concept = listContainsById(conceptFilters, rule.value);
                                if (concept) {
                                    rightRelVar = concept.label;
                                }
                                matchClauses.push(`(${leftRelVar})-[:${rule.operator}]->(${rightRelVar})`);
                            }
                        }
                    }

                    // RETURN
                    const returnValue = $('.qb-return-input')[0].value;
                    if (returnValue && returnValue.length > 0) {
                        returnClauses.push(returnValue);
                    } else {
                        // by default return first variable
                        const firstVariable = getVariableFromFilter(rules[0].id);
                        returnClauses.push(firstVariable);
                    }

                    if (matchClauses.length === 0) {
                        alert('No concepts rule selected !');
                        return;
                    }
                    const query = buildCypherQuery(matchClauses, whereClauses, returnClauses);
                    self.trigger('visualSearch', {query: query});
                }

                function buildCypherQuery(matchClauses, whereClauses, returnClauses) {
                    let query = 'MATCH ';

                    // MATCH
                    query += matchClauses.join(',');

                    // WHERE
                    if (whereClauses.length > 0) {
                        query += ' WHERE ';
                        for (let i = 0; i < whereClauses.length; i++) {
                            query += '(' + whereClauses[i] + ')';
                            if (i < whereClauses.length - 1) {
                                query += ' AND ';
                            }
                        }
                    }

                    // RETURN
                    query += ' RETURN ' + returnClauses.join(',');
                    return query;
                }

                function resetBuilder() {
                    self.select('queryBuilderContainer').queryBuilder('setRules', {rules:[]});
                    refreshRules();
                }
            });
        });
    }

});
