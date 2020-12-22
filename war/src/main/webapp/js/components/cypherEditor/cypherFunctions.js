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

/*
 * Copyright (c) 2002-2017 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
 *
 * This file is part of Neo4j.
 *
 * Neo4j is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// https://neo4j.com/docs/developer-manual/current/cypher/functions/
/**
 * Signature syntax examples:
 * - (name :: TYPE?, name = default :: INTEGER?) :: VOID
 * - () :: (TYPE?)
 */
define([], function() {

  function func (name, signature) {
    return { name, signature }
  }

  const predicate = [
    func('all', '(variable IN list WHERE predicate :: ANY) :: (BOOLEAN)'),
    func('any', '(variable IN list WHERE predicate :: ANY) :: (BOOLEAN)'),
    func('exists', '(property|pattern :: ANY) :: (BOOLEAN)'),
    func('none', '(variable in list WHERE predicate :: ANY) :: (BOOLEAN)'),
    func('single', '(variable in list WHERE predicate :: ANY) :: (BOOLEAN)')
  ];

  const shortestPath = [
    func('shortestPath', '(pattern :: PATH) :: (PATH)'),
    func('allShortestPaths', '(pattern :: PATH) :: (LIST OF PATH)')
  ];

  const scalar = [
    func('coalesce', '(expression... :: ANY) :: (ANY)'),
    func('endNode', '(relationship :: RELATIONSHIP) :: (NODE)'),
    func('head', '(expression :: LIST OF ANY) :: (ANY)'),
    func('id', '(node :: NODE) :: (INTEGER)'),
    func('id', '(relationship :: RELATIONSHIP) :: (INTEGER)'),
    func('last', '(expression :: LIST OF ANY) :: (ANY)'),
    func('length', '(path :: ANY) :: (INTEGER)'),
    func('length', '(string :: STRING) :: (INTEGER)'),
    func('properties', '(entity :: ENTITY) :: (MAP)'),
    func('size', '(list :: LIST OF ANY) :: (INTEGER)'),
    func('size', '(pattern :: PATTERN) :: (INTEGER)'),
    func('startNode', '(relationship :: RELATIONSHIP) :: (NODE)'),
    func('timestamp', '() :: (INTEGER)'),
    func('toBoolean', '(expression :: STRING) :: (BOOLEAN)'),
    func('toFloat', '(expression :: STRING) :: (FLOAT)'),
    func('toInteger', '(expression :: STRING) :: (INTEGER)'),
    func('type', '(relationship :: RELATIONSHIP) :: (STRING)')
  ];

  const aggregation = [
    func('avg', '(expression :: NUMBER) :: (FLOAT)'),
    func('collect', '(expression :: ANY) :: (LIST OF ANY)'),
    func('count', '(expression :: ANY) :: (INTEGER)'),
    func('max', '(expression :: NUMBER) :: (NUMBER)'),
    func('min', '(expression :: NUMBER) :: (NUMBER)'),
    func(
      'percentileCont',
      '(expression :: NUMBER, percentile :: FLOAT) :: (FLOAT)'
    ),
    func(
      'percentileDisc',
      '(expression :: NUMBER, percentile :: FLOAT) :: (NUMBER)'
    ),
    func('stDev', '(expression :: NUMBER) :: (FLOAT)'),
    func('stDevP', '(expression :: NUMBER) :: (FLOAT)'),
    func('sum', '(expression :: NUMBER) :: (NUMBER)')
  ];

  const list = [
    func('extract', '(variable IN list | expression :: ANY) :: (LIST OF ANY)'),
    func('filter', '(variable IN list WHERE predicate :: ANY) :: (LIST OF ANY)'),
    func('keys', '(node :: NODE) :: (LIST OF STRING)'),
    func('keys', '(relationship :: RELATIONSHIP) :: (LIST OF STRING)'),
    func('labels', '(node :: NODE) :: (LIST OF STRING)'),
    func('nodes', '(path :: PATH) :: (LIST OF NODE)'),
    func(
      'range',
      '(start :: INTEGER, end :: INTEGER, step = 1 :: INTEGER) :: (LIST OF INTEGER)'
    ),
    func(
      'reduce',
      '(accumulator = initial :: ANY, variable IN list | expression :: ANY) :: (ANY)'
    ),
    func('relationships', '(path :: PATH) :: (LIST OF RELATIONSHIP)'),
    func('rels', '(path :: PATH) :: (LIST OF RELATIONSHIP)'),
    func('tail', '(expression :: LIST OF ANY) :: (LIST OF ANY)')
  ];

  const mathematicNumeric = [
    func('abs', '(expression :: NUMBER) :: (INTEGER)'),
    func('ceil', '(expression :: NUMBER) :: (INTEGER)'),
    func('floor', '(expression :: NUMBER) :: (INTEGER)'),
    func('rand', '() :: (FLOAT)'),
    func('round', '(expression :: NUMBER) :: (INTEGER)'),
    func('sign', '(expression :: NUMBER) :: (INTEGER)')
  ];

  const mathematicLogarithmic = [
    func('e', '() :: (FLOAT)'),
    func('exp', '(expression :: NUMBER) :: (FLOAT)'),
    func('log', '(expression :: NUMBER) :: (FLOAT)'),
    func('log10', '(expression :: NUMBER) :: (FLOAT)'),
    func('sqrt', '(expression :: NUMBER) :: (FLOAT)')
  ];

  const mathematicTrigonometric = [
    func('acos', '(expression :: NUMBER) :: (FLOAT)'),
    func('asin', '(expression :: NUMBER) :: (FLOAT)'),
    func('atan', '(expression :: NUMBER) :: (FLOAT)'),
    func('atan2', '(expression :: NUMBER, expression :: NUMBER) :: (FLOAT)'),
    func('cos', '(expression :: NUMBER) :: (FLOAT)'),
    func('cot', '(expression :: NUMBER) :: (FLOAT)'),
    func('degrees', '(expression :: NUMBER) :: (FLOAT)'),
    func('haversin', '(expression :: NUMBER) :: (FLOAT)'),
    func('pi', '() :: (FLOAT)'),
    func('radians', '(expression :: NUMBER) :: (FLOAT)'),
    func('sin', '(expression :: NUMBER) :: (FLOAT)'),
    func('tan', '(expression :: NUMBER) :: (FLOAT)')
  ];

  const string = [
    func('left', '(original :: STRING, length :: INTEGER) :: (STRING)'),
    func('lTrim', '(original :: STRING) :: (STRING)'),
    func(
      'replace',
      '(original :: STRING, search :: STRING, replace :: STRING) :: (STRING)'
    ),
    func('reverse', '(original :: STRING) :: (STRING)'),
    func('right', '(original :: STRING, length :: INTEGER) :: (STRING)'),
    func('rTrim', '(original :: STRING) :: (STRING)'),
    func(
      'split',
      '(original :: STRING, splitPattern :: STRING) :: (LIST OF STRING)'
    ),
    func(
      'substring',
      '(original :: STRING, start :: INTEGER, length = length(original) :: INTEGER) :: (STRING)'
    ),
    func('toLower', '(original :: STRING) :: (STRING)'),
    func('toString', '(expression :: ANY) :: (STRING)'),
    func('toUpper', '(original :: STRING) :: (STRING)'),
    func('trim', '(original :: STRING) :: (STRING)')
  ];

  const spatial = [
    func('distance', '(point1 :: POINT, point2 :: POINT) :: (NUMBER)'),
    func('point', '({longitude | x, latitude | y [, crs]} :: MAP) :: (POINT)'),
    func('point', '({x, y [, crs]} :: MAP) :: (POINT)')
  ];

  return [
      ...predicate,
      ...shortestPath,
      ...scalar,
      ...aggregation,
      ...list,
      ...mathematicNumeric,
      ...mathematicLogarithmic,
      ...mathematicTrigonometric,
      ...string,
      ...spatial
  ];
});
