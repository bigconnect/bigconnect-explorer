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
    'react',
    'react-dom',
    'prop-types',
    'create-react-class',
    'react-virtualized-select',
    '../../../components/Alert',
    '../../../components/ontology/RelationshipSelector',
    'public/v1/api'
], function (React, ReactDOM, PropTypes, createReactClass, {default: VirtualizedSelect}, Alert, RelationshipSelector, bcApi) {

    const RelationshipMapper = createReactClass({
        propTypes: {
            getStore: PropTypes.func.isRequired,
            updateStore: PropTypes.func.isRequired,
            rowData: PropTypes.array.isRequired
        },

        getInitialState() {
            return {
                allRoles: [],
                rels: null,
                rel: null,
                relVisibility: '',
                entityIds: [],
                currentMapping: null,
                error: null,
                paths: [],
                sourceType: null,
                destType: null
            }
        },

        componentDidMount() {
            this.props.dataRequest('role', 'all')
                .done(roles => {
                    let allRoles = roles.map(r => {
                        return {
                            label: r.roleName,
                            value: r.id
                        }
                    });

                    allRoles.push({
                        label: 'Public',
                        value: ''
                    });

                    this.setState({allRoles: allRoles});
                });

            this.isMounted = true;
        },

        componentWillUnmount() {
            this.isMounted = false;
        },

        componentWillReceiveProps(nextProps) {
            if (nextProps.rowData) {
                let entityIds = _.chain(nextProps.rowData)
                    .filter(row => row.colEntityId && row.colConcept && row.colProperty)
                    .map((row) => { return {
                        id: row.colEntityId,
                        type: row.colConcept
                    }})
                    .uniq(false, row => row.id)
                    .value();

                // remove mappings for invalid entityIds
                let existingMappings = this.props.getStore().relMappings;
                if(existingMappings) {
                    let newMapping = existingMappings.filter(m => {
                        let flatArray = _.chain(entityIds).map(e => _.values(e)).flatten().value();
                        return flatArray.indexOf(m.sourceId) > -1 && flatArray.indexOf(m.targetId) > -1;
                    });

                    this.props.updateStore({relMappings: newMapping});
                    this.recomputePaths();
                }

                this.setState({entityIds: entityIds});
            }
        },

        onEntityMouseDown(e) {
            this.mousedownTarget = e.target;
            this.handleEventElement(e);
        },

        onEntityMouseUp(e) {
            if (!$(e.target).is(this.mousedownTarget)) {
                this.handleEventElement(e);
            }
        },

        handleEventElement(e) {
            let $gel = $(e.target).closest('li').toggleClass('active'),
                selected = $gel.parent().find('.active'),
                len = selected.length;

            if (len === 2) {
                this.targetEntity = selected.not(this.sourceEntity)[0];
                this.configureRelation();
            } else {
                if (len < 2) {
                    this.targetEntity = null;
                }
                if (len === 1) {
                    this.sourceEntity = selected[0];
                } else if (len < 1) {
                    this.sourceEntity = null;
                }

                this.updateCurve(len);
            }
        },

        configureRelation() {
            let $node = $(ReactDOM.findDOMNode(this)),
                sourceEid = $(this.sourceEntity).attr('data-eid'),
                sourceType = $(this.sourceEntity).attr('data-etyp'),
                destEid = $(this.targetEntity).attr('data-eid'),
                destType = $(this.targetEntity).attr('data-etyp'),
                $path = $node.find('path.line'),
                mappingId = sourceEid+destEid;

            this.sourceEntity = null;
            this.targetEntity = null;

            $node.find('.relList .active').removeClass('active');
            this.updateCurve(0);
            $path.remove();

            // check to see if we already have the mapping
            let mappingExists = this.props.getStore().relMappings && this.props.getStore().relMappings.filter(m => m.id === mappingId);
            if(mappingExists && mappingExists.length > 0) {
                this.setState({error: { statusText: 'This relation already exists.'}})
                return;
            }

            let newMapping = (this.props.getStore().relMappings && this.props.getStore().relMappings.slice(0)) || [];
            newMapping.push({
                id: mappingId,
                sourceId: sourceEid,
                sourceType: sourceType,
                targetId: destEid,
                targetType: destType
            });

            this.props.updateStore({relMappings: newMapping});
            this.recomputePaths();
            this.setState({
                currentMapping: mappingId,
                sourceType: sourceType,
                destType: destType
            });
        },

        updateCurve(selected) {
            var self = this,
                $el1 = $(ReactDOM.findDOMNode(this)),
                $bodyOffset = $('.relList').parent().offset();

            require(['d3'], function(d3) {
                d3.select($('section.relationships svg')[0])
                    .selectAll('path.line')
                    .data(function() {
                        if (selected === 2 && self.sourceEntity && self.targetEntity) {
                            $el1.off('mousemove');
                            return [1];
                        }
                        if (selected === 1 && self.sourceEntity && window.lastMousePositionX) {
                            return [1];
                        }
                        $el1.off('mousemove');
                        return []
                    })
                    .call(function() {
                        this.enter().append('path')
                            .attr('class', 'line')
                            .attr('marker-end', 'url(#triangle)');
                        this.exit().remove();
                    })
                    .attr('d', function() {
                        return calculatePath();
                    })

                if (!self.targetEntity && self.sourceEntity) {
                    var $line = $('path.line');
                    $el1.off('mousemove');
                    $el1.on('mousemove', function(event) {
                        var $target = $(event.target).closest('li'),
                            eligible;
                        if ($target.is('.vertex:not(.active)')) {
                            eligible = $target[0];
                        }
                        $line.attr('d', calculatePath(eligible));
                    });
                }
            });

            function calculatePath(eligible) {
                var padding = 8,
                    controlDistance = 25,
                    toXY = function(el) {
                        var pos = [];
                        if (el || eligible) {
                            var $el = $(el || eligible),
                                position = $el.position();
                            pos[0] = position.left + $el.outerWidth(true) / 2;
                            pos[1] = position.top + $el.outerHeight(true);
                        } else {
                            pos[0] = window.lastMousePositionX - $bodyOffset.left;
                            pos[1] = window.lastMousePositionY - $bodyOffset.top;
                        }
                        return pos;
                    },
                    sourcePosition = toXY(self.sourceEntity),
                    targetPosition = toXY(self.targetEntity),
                    controlPosition = [];

                targetPosition[1] += padding;
                controlPosition[0] = targetPosition[0] + padding * (sourcePosition[0] < targetPosition[0] ? -1 : 1);
                controlPosition[1] = targetPosition[1] + controlDistance;

                return [
                    'M' + sourcePosition.join(','),
                    'Q' + controlPosition.join(','),
                    targetPosition.join(',')
                ].join(' ')
            }
        },

        handleAlertDismiss() {
            this.setState({
                error: null
            });
        },

        onSave(e) {
            e.preventDefault();

            if(!this.state.currentMapping)
                return;

            if (!this.validateForm()) {
                return;
            }

            // get the actual mapping
            let m = this.props.getStore().relMappings.filter(m => m.id == this.state.currentMapping)[0];
            m.rel = this.state.rel;
            m.relVisibility = this.state.relVisibility;

            this.setState({
                rels: [],
                rel: null,
                relVisibility: null,
                currentMapping: null
            });
        },

        validateForm() {
            if(!this.state.rel) {
                this.setState({error: {statusText: 'Please specify a valid relationship'}});
                return false;
            }

            return true;
        },

        removeMapping(e) {
            e.preventDefault();

            this.props.updateStore({
                relMappings: this.props.getStore().relMappings.filter(m => m.id != this.state.currentMapping)
            })

            this.setState({
                paths: this.state.paths.filter(p => p.id != this.state.currentMapping)
            });

            this.setState({
                rels: [],
                rel: null,
                relVisibility: null,
                currentMapping: null
            });
        },

        cancelMapping(e) {
            e.preventDefault();

            let m = this.props.getStore().relMappings.filter(m => m.id == this.state.currentMapping)[0];
            if(!m.rel) {
                this.props.updateStore({
                    relMappings: this.props.getStore().relMappings.filter(m => m.id != this.state.currentMapping)
                })

                this.setState({
                    paths: this.state.paths.filter(p => p.id != this.state.currentMapping)
                });
            }

            this.setState({
                rels: [],
                rel: null,
                relVisibility: null,
                currentMapping: null
            });
        },

        pathClicked(e) {
            let mappingId = $(e.target).attr('data-eid'),
                mapping = this.props.getStore().relMappings.filter(m => m.id === mappingId)[0];

            this.props.dataRequest('ontology', 'relationshipsBetween', mapping.sourceType, mapping.targetType)
                .done(rels => {
                    let visibleRels = _.chain(rels)
                        .filter((rel) => {
                            return rel.userVisible;
                        })
                        .map((rel) => {
                            return {
                                label: rel.displayName,
                                value: rel.title
                            }
                        })
                        .value();

                    if(visibleRels.length > 0) {
                        this.setState({
                            currentMapping: mappingId,
                            rels: visibleRels,
                            rel: mapping.rel,
                            relVisibility: mapping.relVisibility
                        });

                    } else {
                        this.setState({
                            error: { statusText: 'No valid relationships between selected entities' },
                            currentMapping: null,
                            rels: [],
                            rel: null,
                            relVisibility: null
                        });
                    }
                });
        },

        recomputePaths() {
            var _this = this;
            //wait for a paint to do scrolly stuff
            window.requestAnimationFrame(function() {
                if(_this.isMounted) {
                    let newPaths = _.map(_this.props.getStore().relMappings, m => {
                        return {
                            id: m.id,
                            path: _this.computePath(m)
                        }
                    });
                    _this.setState({paths: newPaths});
                }
            });
        },

        computePath(m) {
            let padding = 8,
                controlDistance = 25,
                $sourceNode = $('.relList li[data-eid="'+m.sourceId+'"]'),
                $targetNode = $('.relList li[data-eid="'+m.targetId+'"]'),
                toXY = function(el) {
                    var pos = [],
                        position = el.position();

                    pos[0] = position.left + el.outerWidth(true) / 2;
                    pos[1] = position.top + el.outerHeight(true);

                    return pos;
                },
                sourcePosition = toXY($sourceNode),
                targetPosition = toXY($targetNode),
                controlPosition = [];

            targetPosition[1] += padding;
            controlPosition[0] = targetPosition[0] + padding * (sourcePosition[0] < targetPosition[0] ? -1 : 1);
            controlPosition[1] = targetPosition[1] + controlDistance;

            return [
                'M' + sourcePosition.join(','),
                'Q' + controlPosition.join(','),
                targetPosition.join(',')
            ].join(' ');
        },

        applyOnClickEvent(ref) {
            var self = this;
            if(ref) {
                ref.onclick = function(e) {
                    self.pathClicked(e);
                };
            }
        },

        render() {
            if (this.state.entityIds.length < 2)
                return (<div/>)

            return (
                <div className="col-sm-12">

                    <div className="col-sm-12">
                        <h4>Create Relationships</h4>
                        <blockquote>
                            <p>Connect two entities to create a relationship. Click the source entity and drag the arrow over the target entity.</p>
                        </blockquote>
                    </div>

                    <div className="col-sm-12">
                        <Alert error={this.state.error} onDismiss={ this.handleAlertDismiss }/>

                        <div className="relBody">
                            <ul className="relList">
                                {this.state.entityIds.map(entityId => (
                                    <li key={entityId.id}
                                        data-eid={entityId.id}
                                        data-etyp={entityId.type.id}
                                        className="vertex"
                                        onMouseDown={(e) => {this.onEntityMouseDown(e)}}
                                        onMouseUp={(e) => {this.onEntityMouseUp(e)}}
                                    >{entityId.id}</li>
                                ))}
                            </ul>

                            <section className="relationships">
                                <svg>
                                    <defs>
                                        <marker id="triangle" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                                            <path d="M 0 0 L 10 5 L 0 10 z" style={{stroke: 'none', fill: 'rgb(0, 136, 204)'}} />
                                        </marker>
                                        <marker id="triangleFinal" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                                            <path d="M 0 0 L 10 5 L 0 10 z" style={{stroke: 'none', fill: '#cc2e0b'}} />
                                        </marker>
                                    </defs>
                                    {
                                        this.state.paths.map(p => (
                                            <path
                                                key={p.id}
                                                ref={ref => this.applyOnClickEvent(ref)}
                                                data-eid={p.id}
                                                fill="transparent"
                                                className="lineFinal"
                                                markerEnd="url(#triangleFinal)"
                                                pointerEvents="visible"
                                                d={p.path}
                                            />
                                        ))
                                    }
                                </svg>
                                <form onSubmit={this.onSave}  className="form-horizontal rel-mapper" style={{marginTop: '30px', display: this.state.currentMapping ? 'block' : 'none'}}>
                                    <div className="form-group">
                                        <label className="col-sm-3 control-label" htmlFor="inputRel">Relationship:</label>
                                        <div className="col-sm-9 form-inline">
                                            <div className="form-group col-sm-6">
                                                <RelationshipSelector
                                                    value={this.state.rel}
                                                    onSelected={(val) => { this.setState({rel: val}) }}
                                                    placeholder={"Coose relationship"}
                                                    autofocus={false}
                                                    filter={{
                                                        userVisible: true,
                                                        sourceId: this.state.sourceType,
                                                        targetId: this.state.destType
                                                    }}
                                                />
                                            </div>

                                            <div className="form-group col-sm-6 p-x-4">
                                                <VirtualizedSelect
                                                    options={this.state.allRoles}
                                                    value={this.state.relVisibility}
                                                    onChange={(val) => { this.setState({relVisibility: val.value}) }}
                                                    clearable={false}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <div className="col-sm-offset-3 col-sm-9">
                                            <div className="btn-group btn-group-sm">
                                                <button className="btn btn-primary">Save</button>
                                                <button className="btn btn-danger" style={{margin: '0px 10px'}} onClick={(e) => { this.removeMapping(e) }}>Remove</button>
                                                <button className="btn btn-default" onClick={(e) => { this.cancelMapping(e) }}>Cancel</button>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </section>
                        </div>
                    </div>
                </div>
            )
        }
    });

    return RelationshipMapper;
});
