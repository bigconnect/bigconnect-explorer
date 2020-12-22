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
    'colorjs'
], function(createReactClass, PropTypes, colorjs) {

    let CssIdentifier = 1;
    const BLACK = 'rgb(0,0,0)';
    const saturation = 0.7;
    const lightness = 0.5;
    const shades = [
        { s: 21, v: 'Red' },
        { s: 52, v: 'Orange' },
        { s: 68, v: 'Yellow' },
        { s: 154, v: 'Green' },
        { s: 190, v: 'Teal' },
        { s: 249, v: 'Blue' },
        { s: 290, v: 'Purple' },
        { s: 330, v: 'Pink' },
        { s: 361, v: 'Red' }
    ];

    const ColorSelector = createReactClass({
        propTypes: {
            onSelected: PropTypes.func.isRequired,
            value: PropTypes.string
        },

        getDefaultProps() {
            return { value: BLACK };
        },

        getInitialState() {
            return { value: this.props.value };
        },

        componentWillMount() {
            this.cssIdentifier = `_cs-${CssIdentifier++}`;
        },

        componentDidMount() {
            this.publish = _.debounce(this._publish, 100);
        },

        componentWillReceiveProps(nextProps) {
            if (this.state.value !== nextProps.value) {
                this.setState({ value: nextProps.value || BLACK })
            }
        },

        componentWillUnmount() {
            clearTimeout(this._hideTooltip);
        },

        render() {
            const { value, colorTooltip } = this.state;
            const black = this.isBlack();
            const color = colorjs(value);
            const hue = color.getHue();
            const colorStyle = `hsl(${hue}, ${saturation * 100}%, ${lightness * 100}%);`
            const style = black ? '' : `
                #${this.cssIdentifier} input[type=range]::-moz-range-thumb { background: ${colorStyle} }
                #${this.cssIdentifier} input[type=range]::-ms-thumb { background: ${colorStyle} }
                #${this.cssIdentifier} input[type=range]::-webkit-slider-thumb { background: ${colorStyle} }`;
            const percent = hue / 360;
            const shade = black ? '' : _.find(shades, s => hue < s.s).v;

            return (
                <div id={this.cssIdentifier} className={`color-selector ${black ? 'black' : ''}`} style={{ display: 'flex' }}>
                    <div title="Set to Black" className="black">
                        <button onClick={this.onClickBlack} onMouseDown={this.onMouseDownBlack}>Set to Black</button>
                    </div>
                    <div title="Set to Color" className="gradient" style={{position: 'relative'}}>
                        <style>{style}</style>
                        <input value={hue} min="0" max="359" step="1" onChange={this.onChange} type="range" />
                        { black || !colorTooltip ? null : (
                            <div className="tooltip bottom" style={{
                                opacity: 1,
                                left: percent * 100 + '%',
                                marginLeft: ((1 - percent) * (11 * 2) - 11) + 'px',
                                top: '100%',
                                transform: 'translate(-50%, 0px)'
                            }}>
                                <div className="tooltip-arrow"></div>
                                <div style={{ background: 'black' }} className="tooltip-inner">{shade}</div>
                            </div>
                        )}
                    </div>
                </div>
            )
        },

        isBlack() {
            return this.state.value === BLACK;
        },

        onClickBlack() {
            if (!this.isBlack()) {
                this.update(BLACK);
            }
        },

        onMouseDownBlack() {
            if (!this.isBlack()) {
                this.update(BLACK);
            }
        },

        onChange(event) {
            const color = colorjs({ hue: event.target.value, saturation, lightness }).toCSSHex();
            this.update(color);
            clearTimeout(this._hideTooltip);
            if (!this.state.colorTooltip) {
                this.setState({ colorTooltip: true })
            }
            this._hideTooltip = _.delay(() => {
                this.setState({ colorTooltip: false })
            }, 750);
        },

        update(newValue) {
            this.setState({ value: newValue });
            this.publish(newValue);
        },

        _publish(newValue) {
            this.props.onSelected(newValue);
        }
    });

    return ColorSelector;
});
