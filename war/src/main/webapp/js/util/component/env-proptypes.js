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
 * Replaces prop-types library with no-check shims in production,
 * Normally webpack would handle this for us, but not using that yet...
 */
define(bcEnvironment.dev ? ['react-proptypes-dev'] : [], function(PropTypes) {
    const PropTypeShims = getPropTypeShims();

    if (PropTypes) {
        if (!shimPropTypesSameAsReal(PropTypeShims, PropTypes)) {
            // We shim the PropTypes in production for performance, but in dev
            // also make sure our shims match what react provides.
            const realKeys = Object.keys(PropTypes)
            const shimKeys = Object.keys(PropTypeShims)
            const missing = _.difference(realKeys, shimKeys).join(', ');
            const extra = _.difference(shimKeys, realKeys).join(', ');
            if (missing.length) console.warn('PropTypes shim is missing:', missing);
            if (extra.length) console.warn('PropTypes shim has extras:', extra);
            console.warn('PropTypes that are defined for production differ from those in react');
        }
        return PropTypes;
    }

    return PropTypeShims;

    function shimPropTypesSameAsReal(shims, real) {
        const shimKeys = Object.keys(shims);
        const realKeys = Object.keys(real);
        return shimKeys.length === realKeys.length &&
            _.intersection(shimKeys, realKeys).length === shimKeys.length;
    }

    function getPropTypeShims() {
        const shim = function() {};
        shim.isRequired = shim;
        const getShim = function() { return shim; }
        const PropTypeShims = {
            any: shim,
            array: shim,
            arrayOf: getShim,
            bool: shim,
            checkPropTypes: shim,
            element: shim,
            exact: getShim,
            func: shim,
            instanceOf: getShim,
            node: shim,
            number: shim,
            object: shim,
            objectOf: getShim,
            oneOf: getShim,
            oneOfType: getShim,
            shape: getShim,
            string: shim,
            symbol: shim
        };
        PropTypeShims.PropTypes = PropTypeShims;
        return PropTypeShims;
    }
})
