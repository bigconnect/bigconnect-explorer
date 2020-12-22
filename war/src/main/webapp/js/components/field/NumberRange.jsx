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
    'create-react-class',
    'prop-types',
    'classnames'
], function(createReactClass, PropTypes, classNames) {
    'use strict';

    const NumberRange = createReactClass({
        propTypes: {
            value: PropTypes.number,
            min: PropTypes.number,
            max: PropTypes.number,
            step: PropTypes.number,
            editable: PropTypes.bool,
            displayTooltip: PropTypes.bool,
            labelRenderer: PropTypes.func,
            onChange: PropTypes.func.isRequired,
        },

        getDefaultProps() {
            return {
                min: 0,
                max: 1,
                step: 0.1,
                editable: true,
                displayTooltip: true,
                labelRenderer: value => value
            };
        },

        render() {
            const { value, min, max, step, editable, displayTooltip, labelRenderer, onChange } = this.props;
            const percent = calculatePercent(min, max, value);
            const hasValue = value !== undefined && value !== null;

            return (
                <div className={classNames('number-range-wrapper', { 'empty': !hasValue })}>
                    <input
                        ref={r => { this.input = r }}
                        className="number-range-input"
                        type="range"
                        disabled={!editable}
                        min={min}
                        max={max}
                        step={step}
                        defaultValue={value}
                        onChange={(e) => { onChange(Number.parseFloat(this.input.value)); }}
                    />
                    {displayTooltip ?
                        <div className="tooltip bottom" style={{
                            left: percent * 100 + '%',
                            marginLeft: ((1 - percent) * (25 * 2) - 25) + 'px',
                            transform: 'translate(-50%, 0px)'
                        }}>
                            <div className="tooltip-arrow"></div>
                            <div style={{ background: 'black' }} className="tooltip-inner">
                                { hasValue ? labelRenderer(value) : null }
                            </div>
                        </div>
                        : null}
                </div>
            );
        }

    });

    function calculatePercent(min, max, value) {
        if (value !== null && value !== undefined) {
            const range = Math.abs(max - min);
            const rangeValue = max > min ? Math.abs(value - min) : Math.abs(min - value);
            return rangeValue / range;
        } else {
            return 1;
        }
    }

    return NumberRange;
});
