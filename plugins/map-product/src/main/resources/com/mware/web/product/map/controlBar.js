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
define(['openlayers'], function (ol) {
    'use strict';

    /**
     * Control bar for OL3
     * The control bar is a container for other controls. It can be used to create toolbars.
     * Control bars can be nested and combined with ol.control.Toggle to handle activate/deactivate.
     *
     * @constructor
     * @extends {ol.control.Control}
     * @param {Object=} opt_options Control options.
     *        className {String} class of the control
     *        group {bool} is a group, default false
     *        toggleOne {bool} only one toggle control is active at a time, default false
     *        autoDeactivate {bool} used with subbar to deactivate all control when top level control deactivate, default false
     *        controls {Array<ol.control>} a list of control to add to the bar
     */
    ol.control.Bar = function (options) {
        if (!options) options = {};
        var element = $("<div>").addClass('ol-unselectable ol-control ol-bar');
        if (options.className) element.addClass(options.className);
        if (options.group) element.addClass('ol-group');

        ol.control.Control.call(this,
            {
                element: element.get(0),
                target: options.target
            });

        this.set('toggleOne', options.toggleOne);
        this.set('autoDeactivate', options.autoDeactivate);

        this.controls_ = [];
        if (options.controls instanceof Array) {
            for (var i = 0; i < options.controls.length; i++) {
                this.addControl(options.controls[i]);
            }
        }
    };

    ol.inherits(ol.control.Bar, ol.control.Control);

    /**
     * Set the control visibility
     * @param {boolean} b
     */
    ol.control.Bar.prototype.setVisible = function (val) {
        if (val) $(this.element).show();
        else $(this.element).hide();
    }

    /**
     * Get the control visibility
     * @return {boolean} b
     */
    ol.control.Bar.prototype.getVisible = function () {
        return ($(this.element).css('display') != 'none');
    }

    /**
     * Set the map instance the control is associated with
     * and add its controls associated to this map.
     * @param {ol.Map} map The map instance.
     */
    ol.control.Bar.prototype.setMap = function (map) {
        ol.control.Control.prototype.setMap.call(this, map);

        for (var i = 0; i < this.controls_.length; i++) {
            var c = this.controls_[i];
            // map.addControl(c);
            c.setMap(map);
        }
    };

    /**
     * Get controls in the panel
     *    @param {Array<ol.control>}
     */
    ol.control.Bar.prototype.getControls = function () {
        return this.controls_;
    };

    /**
     * Set tool bar position
     *    @param {top|left|bottom|right}
     */
    ol.control.Bar.prototype.setPosition = function (pos) {
        $(this.element).removeClass('ol-left ol-top ol-bottom ol-right');
        pos = pos.split('-');
        for (var i = 0; i < pos.length; i++) {
            switch (pos[i]) {
                case 'top':
                case 'left':
                case 'bottom':
                case 'right':
                    $(this.element).addClass("ol-" + pos[i]);
                    break;
                default:
                    break;
            }
        }
    };

    /**
     * Add a control to the bar
     *    @param {ol.control} c control to add
     */
    ol.control.Bar.prototype.addControl = function (c) {
        this.controls_.push(c);
        c.setTarget(this.element);
        if (this.getMap()) {
            this.getMap().addControl(c);
        }
        // Activate and toogleOne
        c.on('change:active', this.onActivateControl_, this);
        if (c.getActive && c.getActive()) {
            c.dispatchEvent({type: 'change:active', key: 'active', oldValue: false, active: true});
        }
    };

    /**
     * Deativate all controls in a bar
     * @param {ol.control} except a control
     */
    ol.control.Bar.prototype.deactivateControls = function (except) {
        for (var i = 0; i < this.controls_.length; i++) {
            if (this.controls_[i] !== except && this.controls_[i].setActive) {
                this.controls_[i].setActive(false);
            }
        }
    };

    /**
     * Auto activate/deactivate controls in the bar
     * @param {boolean} b activate/deactivate
     */
    ol.control.Bar.prototype.setActive = function (b) {
        if (!b && this.get("autoDeactivate")) {
            this.deactivateControls();
        }
        if (b) {
            var ctrls = this.getControls();
            for (var i = 0, sb; (sb = ctrls[i]); i++) {
                if (sb.get("autoActivate")) sb.setActive(true);
            }
        }
    }

    /**
     * Post-process an activated/deactivated control
     *    @param {ol.event} an object with a target {ol.control} and active flag {bool}
     */
    ol.control.Bar.prototype.onActivateControl_ = function (e) {
        if (!e.active || !this.get('toggleOne')) return;
        var n;
        var ctrl = e.target;
        for (n = 0; n < this.controls_.length; n++) {
            if (this.controls_[n] === ctrl) break;
        }
        // Not here!
        if (n == this.controls_.length) return;
        this.deactivateControls(this.controls_[n]);
    };

    /** A simple push button control
     *
     * @constructor
     * @extends {ol.control.Control}
     * @param {Object=} opt_options Control options.
     *        className {String} class of the control
     *        title {String} title of the control
     *        html {String} html to insert in the control
     *        handleClick {function} callback when control is clicked (or use change:active event)
     */
    ol.control.Button = function (options) {
        options = options || {};
        var element = $("<div>").addClass((options.className || "") + ' ol-button ol-unselectable ol-control');
        var self = this;

        $("<button>").html(options.html || "")
            .attr('title', options.title)
            .on("touchstart click", function (e) {
                if (e && e.preventDefault) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (options.handleClick) options.handleClick.call(self, e);
            })
            .appendTo(element);

        ol.control.Control.call(this,
            {
                element: element.get(0),
                target: options.target
            });

        if (options.title) this.set("title", options.title);
    };

    ol.inherits(ol.control.Button, ol.control.Control);

    /**
     * A simple push button control drawn as text
     */
    ol.control.TextButton = function (options) {
        options = options || {};
        options.className = (options.className || "") + " ol-text-button";
        ol.control.Button.call(this, options);
    };
    ol.inherits(ol.control.TextButton, ol.control.Button);


    /** A simple toggle control
     * The control can be created with an interaction to control its activation.
     *
     * @constructor
     * @extends {ol.control.Button}
     * @fires change:active
     * @param {Object=} opt_options Control options.
     *		className {String} class of the control
     *		title {String} title of the control
     *		html {String} html to insert in the control
     *		interaction {ol.interaction} interaction associated with the control
     *		active {bool} the control is created active, default false
     *		bar {ol.control.Bar} a subbar associated with the control (drawn when active if control is nested in a ol.control.Bar)
     *		autoActive {bool} the control will activate when shown in an ol.control.Bar, default false
     *		onToggle {function} callback when control is clicked (or use change:active event)
     */
    ol.control.Toggle = function (options) {
        options = options || {};
        var self = this;

        this.interaction_ = options.interaction;
        if (this.interaction_) {
            this.interaction_.on("change:active", function (e) {
                self.setActive(!e.oldValue);
            });
        }

        if (options.toggleFn) options.onToggle = options.toggleFn; // compat old version
        options.handleClick = function () {
            self.toggle();
            if (options.onToggle) options.onToggle.call(self, self.getActive());
        };
        options.className = (options.className || "") + " ol-toggle";
        ol.control.Button.call(this, options);

        this.set("title", options.title);

        this.set("autoActivate", options.autoActivate);
        if (options.bar) {
            this.subbar_ = options.bar;
            this.subbar_.setTarget(this.element);
            $(this.subbar_.element).addClass("ol-option-bar");
        }

        this.setActive(options.active);
    };

    ol.inherits(ol.control.Toggle, ol.control.Button);

    /**
     * Set the map instance the control is associated with
     * and add interaction attached to it to this map.
     * @param {ol.Map} map The map instance.
     */
    ol.control.Toggle.prototype.setMap = function (map) {
        if (!map && this.getMap()) {
            if (this.interaction_) {
                this.getMap().removeInteraction(this.interaction_);
            }
            if (this.subbar_) this.getMap().removeControl(this.subbar_);
        }

        ol.control.Control.prototype.setMap.call(this, map);

        if (map) {
            if (this.interaction_) map.addInteraction(this.interaction_);
            if (this.subbar_) map.addControl(this.subbar_);
        }
    };

    /**
     * Get the subbar associated with a control
     * @return {ol.control.Bar}
     */
    ol.control.Toggle.prototype.getSubBar = function () {
        return this.subbar_;
    };

    /**
     * Test if the control is active.
     * @return {bool}.
     * @api stable
     */
    ol.control.Toggle.prototype.getActive = function () {
        return $(this.element).hasClass("ol-active");
    };

    /**
     * Toggle control state active/deactive
     */
    ol.control.Toggle.prototype.toggle = function () {
        if (this.getActive()) this.setActive(false);
        else this.setActive(true);
    };

    /**
     * Change control state
     * @param {bool} b activate or deactivate the control, default false
     */
    ol.control.Toggle.prototype.setActive = function (b) {
        if (this.getActive() == b) return;
        if (b) $(this.element).addClass("ol-active");
        else $(this.element).removeClass("ol-active");
        if (this.interaction_) this.interaction_.setActive(b);
        if (this.subbar_) this.subbar_.setActive(b);

        this.dispatchEvent({type: 'change:active', key: 'active', oldValue: !b, active: b});
    };

    /**
     * Set the control interaction
     * @param {ol.interaction} i interaction to associate with the control
     */
    ol.control.Toggle.prototype.setInteraction = function (i) {
        this.interaction_ = i;
    };

    /**
     * Get the control interaction
     * @return {ol.interaction} interaction associated with the control
     */
    ol.control.Toggle.prototype.getInteraction = function () {
        return this.interaction_;
    };

    return ol.control.Bar;
});
