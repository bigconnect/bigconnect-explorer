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
    'd3-force'
], function (d3) {

    const defaults = Object.freeze({
        animate: false, // whether to show the layout as it's running; special 'end' value makes the layout animate like a discrete layout
        maxIterations: 500, // max iterations before the layout will bail out
        maxSimulationTime: 10000, // max length in ms to run the layout
        ungrabifyWhileSimulating: false, // so you can't drag nodes during layout
        fixedAfterDragging: false, // fixed node after dragging
        fit: false, // on every layout reposition of nodes, fit the viewport
        padding: 30, // padding around the simulation
        boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }

        /**d3-force API**/
        alpha: undefined, // sets the current alpha to the specified number in the range [0,1]
        alphaMin: undefined, // sets the minimum alpha to the specified number in the range [0,1]
        alphaDecay: undefined, // sets the alpha decay rate to the specified number in the range [0,1]
        alphaTarget: undefined, // sets the current target alpha to the specified number in the range [0,1]
        velocityDecay: undefined, // sets the velocity decay factor to the specified number in the range [0,1]
        collideRadius: undefined, // sets the radius accessor to the specified number or function
        collideStrength: undefined, // sets the force strength to the specified number in the range [0,1]
        collideIterations: undefined, // sets the number of iterations per application to the specified number
        linkId: undefined, // sets the node id accessor to the specified function
        linkDistance: 30, // sets the distance accessor to the specified number or function
        linkStrength: undefined, // sets the strength accessor to the specified number or function
        linkIterations: undefined, // sets the number of iterations per application to the specified number
        manyBodyStrength: undefined, // sets the strength accessor to the specified number or function
        manyBodyTheta: undefined, // sets the Barnes–Hut approximation criterion to the specified number
        manyBodyDistanceMin: undefined, // sets the minimum distance between nodes over which this force is considered
        manyBodyDistanceMax: undefined, // sets the maximum distance between nodes over which this force is considered
        xStrength: undefined, // sets the strength accessor to the specified number or function
        xX: undefined, // sets the x-coordinate accessor to the specified number or function
        yStrength: undefined, // sets the strength accessor to the specified number or function
        yY: undefined, // sets the y-coordinate accessor to the specified number or function
        radialStrength: undefined, // sets the strength accessor to the specified number or function
        radialRadius: undefined, // sets the circle radius to the specified number or function
        radialX: undefined, // sets the x-coordinate of the circle center to the specified number
        radialY: undefined, // sets the y-coordinate of the circle center to the specified number
        // layout event callbacks
        ready: function () {
        }, // on layoutready
        stop: function () {
        }, // on layoutstop
        tick: function () {
        }, // on every iteration
        // positioning options
        randomize: false, // use random node positions at beginning of layout
        // infinite layout options
        infinite: false // overrides all other options for a forces-all-the-time mode
    });

    class ContinuousLayout {
        constructor(options) {
            let o = this.options = Object.assign({}, defaults, options);
            this.state = Object.assign({}, o, {
                layout: this,
                nodes: o.eles.nodes(),
                edges: o.eles.edges(),
                progress: 0,
                iterations: 0,
                startTime: 0
            });
            this.simulation = null;
            this.removeCytoscapeEvents = null;
        }

        makeBoundingBox(bb, cy) {
            if (bb == null) {
                bb = {x1: 0, y1: 0, w: cy.width(), h: cy.height()};
            } else {
                bb = {x1: bb.x1, x2: bb.x2, y1: bb.y1, y2: bb.y2, w: bb.w, h: bb.h};
            }
            if (bb.x2 == null) {
                bb.x2 = bb.x1 + bb.w;
            }
            if (bb.w == null) {
                bb.w = bb.x2 - bb.x1;
            }
            if (bb.y2 == null) {
                bb.y2 = bb.y1 + bb.h;
            }
            if (bb.h == null) {
                bb.h = bb.y2 - bb.y1;
            }

            return bb;
        }

        setInitialPositionState(node, state) {
            let p = node.position();
            let bb = state.currentBoundingBox;
            let scratch = node.scratch(state.name);

            if (scratch == null) {
                scratch = {};

                node.scratch(state.name, scratch);
            }

            Object.assign(scratch, state.randomize ? {
                x: bb.x1 + Math.round(Math.random() * bb.w),
                y: bb.y1 + Math.round(Math.random() * bb.h)
            } : {
                x: p.x,
                y: p.y
            });
            if (node.locked()) {
                Object.assign(scratch, {
                    fx: p.x,
                    fy: p.y
                });
            }
        }

        refreshPositions(nodes, state, fit) {
            nodes.positions(function (node) {
                let scratch = node.scratch(state.name);
                return {
                    x: scratch.x,
                    y: scratch.y
                };
            });
            fit && state.cy.fit(state.padding);
        }

        getScratch(el) {
            let name = this.state.name;
            let scratch = el.scratch(name);

            if (!scratch) {
                scratch = {};

                el.scratch(name, scratch);
            }
            return scratch;
        }

        ungrabify(nodes) {
            if (!this.state.ungrabifyWhileSimulating) {
                return;
            }
            nodes.filter(node => {
                let nodeGrabbable = this.getScratch(node).grabbable = node.grabbable();
                return nodeGrabbable;
            });
            nodes.ungrabify();
        }

        regrabify(nodes) {
            if (!this.state.ungrabifyWhileSimulating) {
                return;
            }
            nodes.filter(node => {
                let nodeGrabbable = this.getScratch(node).grabbable;
                return nodeGrabbable;
            });
            nodes.grabify();
        }

        tick() {
            const s = this.state;
            s.progress += 1 / Math.ceil(Math.log(this.simulation.alphaMin()) / Math.log(1 - this.simulation.alphaDecay()));
            s.iterations++;
            let _iterations = s.maxIterations && !s.infinite ? s.iterations / s.maxIterations : 0;
            let _timeRunning = Date.now() - s.startTime;
            let _timeIterations = s.maxSimulationTime && !s.infinite ? _timeRunning / s.maxSimulationTime : 0;
            let _progress = Math.max(_iterations, _timeIterations, s.progress);
            _progress = _progress > 1 ? 1 : _progress;
            if (_progress >= 1 && !s.infinite) {
                this.end();
                return;
            }
            s.tick && s.tick(_progress);
            if (s.animate) {
                this.refreshPositions(s.nodes, s, s.fit);
            }
        }

        end() {
            const s = this.state;
            this.refreshPositions(s.nodes, s, s.fit);
            this.emit('layoutstop', s.cy);
            this.reset();
        }

        reset(destroyed) {
            this.simulation && this.simulation.stop();
            const s = this.state;
            (destroyed || !s.infinite) && this.removeCytoscapeEvents && this.removeCytoscapeEvents();
            s.animate && this.regrabify(s.nodes);
            return this;
        }

        run() {
            this.reset();
            let l = this;
            let s = this.state;
            let ready = false;
            s.currentBoundingBox = this.makeBoundingBox(s.boundingBox, s.cy);
            if (s.ready) {
                l.one('layoutready', s.ready);
            }
            if (s.stop) {
                l.one('layoutstop', s.stop);
            }

            s.nodes.forEach(n => this.setInitialPositionState(n, s));
            if (!ready) {
                ready = true;
                l.emit('layoutready');
            }

            if (!l.simulation) {
                let _forcenodes = s.nodes.map(n => Object.assign(l.getScratch(n), n.data()));
                let _forceedges = s.edges.map(e => Object.assign({}, e.data()));
                l.simulation = d3.forceSimulation(_forcenodes);
                s.alpha && l.simulation.alpha(s.alpha);
                s.alphaMin && l.simulation.alphaMin(s.alphaMin);
                s.alphaDecay && l.simulation.alphaDecay(s.alphaDecay);
                s.alphaTarget && l.simulation.alphaTarget(s.alphaTarget);
                s.velocityDecay && l.simulation.velocityDecay(s.velocityDecay);
                let _collide = d3.forceCollide();
                s.collideRadius && _collide.radius(s.collideRadius);
                s.collideStrength && _collide.strength(s.collideStrength);
                s.collideIterations && _collide.iterations(s.collideIterations);
                let _link = d3.forceLink(_forceedges);
                s.linkId && _link.id(s.linkId);
                s.linkDistance && _link.distance(s.linkDistance);
                s.linkStrength && _link.strength(s.linkStrength);
                s.linkIterations && _link.iterations(s.linkIterations);
                let _manyBody = d3.forceManyBody();
                s.manyBodyStrength && _manyBody.strength(s.manyBodyStrength);
                s.manyBodyTheta && _manyBody.theta(s.manyBodyTheta);
                s.manyBodyDistanceMin && _manyBody.distanceMin(s.manyBodyDistanceMin);
                s.manyBodyDistanceMax && _manyBody.distanceMax(s.manyBodyDistanceMax);
                let _x = d3.forceX();
                s.xX && _x.x(s.xX);
                s.xStrength && _x.strength(s.xStrength);
                let _y = d3.forceY();
                s.yY && _y.y(s.yY);
                s.yStrength && _y.strength(s.yStrength);
                let _radius = null;
                if (s.radialRadius || s.radialStrength || s.radialX || s.radialY) {
                    _radius = d3.forceRadial();
                    s.radialRadius && _radius.radius(s.radialRadius);
                    s.radialStrength && _radius.strength(s.radialStrength);
                    s.radialX && _radius.x(s.radialX);
                    s.radialY && _radius.y(s.radialY);
                }
                let _center = d3.forceCenter(s.currentBoundingBox.w / 2, s.currentBoundingBox.h / 2);
                l.simulation
                    .force('collide', _collide)
                    .force('link', _link)
                    .force('many-body', _manyBody)
                    .force('x', _x)
                    .force('y', _y)
                    .force("center", _center);
                _radius && l.simulation.force('radius', _radius);
                l.simulation
                    .on("tick", () => {
                        l.tick();
                    })
                    .on("end", () => {
                        l.end();
                    });
            }
            l.prerun(s);
            l.emit('layoutstart');
            s.progress = 0;
            s.iterations = 0;
            s.startTime = Date.now();
            if (s.animate) {
                if (!l.removeCytoscapeEvents) {
                    let _cytoscapeEvent = function (e) {
                        let node = this;
                        let pos = node.position();
                        let nodeIsTarget = e.cyTarget === node || e.target === node;
                        if (!nodeIsTarget) {
                            return;
                        }
                        let _scratch = l.getScratch(node);
                        s.progress = 0;
                        s.iterations = 0;
                        s.startTime = Date.now();
                        _scratch.x = pos.x;
                        _scratch.y = pos.y;
                        _scratch.fx = pos.x;
                        _scratch.fy = pos.y;
                        console.log('e.type = ', e.type, e);
                        if (e.type === 'grab') {
                            l.simulation.alphaTarget(0.3).restart();
                        } else if ((e.type === 'unlock' || e.type === 'free') && !s.fixedAfterDragging) {
                            delete _scratch.fx;
                            delete _scratch.fy;
                        }
                    };
                    l.removeCytoscapeEvents = function () {
                        s.nodes.off('grab free drag lock unlock', _cytoscapeEvent);
                        l.removeCytoscapeEvents = null;
                    };
                    s.nodes.on('grab free drag lock unlock', _cytoscapeEvent);
                }
                l.ungrabify(s.nodes);
            }
            l.postrun(s);
            return this;
        }

        prerun() {
        }

        postrun() {
        }

        stop() {
            this.end();
            return this;
            // return this.reset(true);
        }
    }

    // registers the extension on a cytoscape lib ref
    let register = function (cytoscape) {
        if (!cytoscape) {
            return;
        } // can't register if cytoscape unspecified

        cytoscape('layout', 'd3-force', ContinuousLayout); // register with cytoscape.js
    };

    if (typeof cytoscape !== 'undefined') { // expose to global cytoscape (i.e. window.cytoscape)
        register(cytoscape);
    }

    return register;
})
