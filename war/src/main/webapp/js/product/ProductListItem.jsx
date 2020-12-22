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
    'components/DroppableHOC',
    'public/v1/api',
    'util/dnd',
    'filesaver'
], function (createReactClass, PropTypes, DroppableHOC, bcApi, dnd) {

    const MaxTitleLength = 128;
    const ProductListItem = createReactClass({
        propTypes: {
            selected: PropTypes.string,
            editable: PropTypes.bool.isRequired,
            previewHash: PropTypes.string,
            product: PropTypes.shape({
                id: PropTypes.string.isRequired,
                title: PropTypes.string.isRequired,
                workspaceId: PropTypes.string.isRequired,
                kind: PropTypes.string.isRequired,
                loading: PropTypes.bool,
                exporting: PropTypes.bool
            }).isRequired
        },
        getInitialState() {
            return {
                confirmDelete: true,
                editing: false,
                invalid: false,
                loading: false,
                active: false
            };
        },
        componentWillReceiveProps(nextProps) {
            const {product} = nextProps;
            if ('loading' in product && !product.loading && this.state.loading && this.state.editing) {
                this.setState({editing: false, loading: false})
            }
        },
        componentDidUpdate(prevProps, prevState) {
            if (!prevState.editing && this.state.editing && this.refs.titleField) {
                this.refs.titleField.focus();
                this.refs.titleField.select();
            }
        },
        render() {
            const {product, previewHash, selected, editable, exporting} = this.props;
            const {confirmDelete, editing, invalid, loading, active} = this.state;
            const {id, kind, title, workspaceId} = product;
            const isSelected = selected === id;
            const previewStyle = previewHash ? {
                  backgroundImage: `url(product/preview?productId=${encodeURIComponent(id)}&workspaceId=${encodeURIComponent(workspaceId)}&md5=${previewHash})`
            } : {};
            const buttons = loading ?
                ([
                    <button key="save" className="loading btn btn-xs btn-primary"
                            disabled>{i18n('product.item.edit.save')}</button>
                ]) :
                editing ?
                    ([
                        <button key="cancel" onClick={this.onCancel}
                                className="cancel btn btn-xs btn-danger">{i18n('product.item.edit.cancel')}</button>,
                        <button key="save" onClick={this.onSave} disabled={invalid}
                                className="btn btn-xs btn-primary">{i18n('product.item.edit.save')}</button>
                    ]) :
                    ([
                        // TODO: disabled for now, export/import product doesn't work
                        //<button key="export" onClick={this.onExport} className="btn btn-xs btn-blue" disabled={exporting}>Export</button>,
                        <button key="edit" onClick={this.onEdit}
                                className="btn btn-xs btn-primary m-x-1">{i18n('product.item.edit')}</button>,
                        (confirmDelete ?
                                (<button key="delete" className="btn btn-xs btn-danger"
                                         onClick={this.onConfirmDelete}>{i18n('product.item.delete')}</button>) :
                                (<button key="confirmDelete" className="btn btn-xs btn-danger"
                                         onClick={this.onDelete}>{i18n('product.item.delete.confirm')}</button>)
                        )
                    ]);
            const cls = ['products-list-item']

            if (isSelected) cls.push('active');
            if (editing) cls.push('editing');
            const inputAttrs = loading ? {disabled: true} : {};

            return (
                <div title={title}
                     className={cls.join(' ')}
                     onClick={this.onSelect}
                     onMouseLeave={this.onLeaveItem}>
                    <div title={i18n(`${kind}.name`)} className={previewHash ? 'preview' : 'no-preview'} style={previewStyle}/>
                    <div className="content">
                        <h1>{editing ? (
                            <input maxLength={MaxTitleLength}
                                   className="form-control"
                                   required
                                   onKeyUp={this.onTitleKeyUp}
                                   onChange={this.onChange}
                                   ref="titleField"
                                   type="text" defaultValue={title} {...inputAttrs} />
                        ) : title}</h1>
                        <h2>{i18n(`${kind}.name`)}</h2>
                    </div>
                    <div className="buttons" onClick={this.addActiveClass}>
                        {editing ? buttons : (
                        <div className={active ? 'buttonsContainer active' : 'buttonsContainer'}>
                            {editable ? buttons : null}
                        </div>)}
                    </div>
                </div>
            );
        },
        addActiveClass(event){
            event.stopPropagation();
            this.setState({active: !this.state.active})

        },
        onSelect(event) {
            if (event.target !== this.refs.titleField) {
                this.props.onSelectProduct(this.props.product.id);
            }
        },
        onConfirmDelete(event) {
            event.stopPropagation();
            this.setState({confirmDelete: false})
        },
        onLeaveItem() {
            if (!this.state.confirmDelete) {
                this.setState({confirmDelete: true});
            }
        },
        onDelete(event) {
            event.stopPropagation();
            this.props.onDeleteProduct(this.props.product.id);
        },
        onEdit(event) {
            event.stopPropagation();
            this.setState({editing: true})
        },
        onSave(event) {
            event.stopPropagation();
            if (!this.checkInvalid()) {
                const title = this.refs.titleField.value.trim();
                this.setState({loading: true})
                this.props.onUpdateTitle(this.props.product.id, title);
            }
        },
        onCancel(event) {
            event.stopPropagation();
            this.setState({editing: false})
        },
        checkInvalid() {
            const {invalid} = this.state;
            const nowInvalid = this.refs.titleField.value.trim().length === 0;
            if (nowInvalid !== invalid) {
                this.setState({invalid: nowInvalid})
            }
            return nowInvalid;
        },
        onChange(event) {
            this.checkInvalid()
        },
        onTitleKeyUp(event) {
            const invalid = this.checkInvalid()
            if (!invalid && event.keyCode === 13) {
                this.onSave(event);
            } else if (event.keyCode === 27) {
                this.setState({editing: false, invalid: false})
            }
        },
        onExport(event) {
            event.stopPropagation();
            this.props.onUpdateExporting(this.props.product.id, true);

            bcApi.connect().then(({ dataRequest }) => {
                dataRequest('product', 'get', this.props.product.id, true, { includeVertices:true, includeEdges:true })
                    .then((product) => {
                        let data = JSON.stringify(product);
                        var buf = new ArrayBuffer(data.length);
                        var view = new Uint8Array(buf);
                        for (var i = 0; i != data.length; ++i) {
                            view[i] = data.charCodeAt(i) & 0xFF;
                        }

                        let blob = new Blob( [ view ], {
                            type: 'application/octet-stream'
                        });

                        window.saveAs(blob, this.props.product.title+'.json', {type: "application/json;charset=utf-8"});
                        this.props.onUpdateExporting(this.props.product.id, false);
                    })
                    .catch((e) => {
                        console.log('Error exporting product: '+e);
                        this.props.onUpdateExporting(this.props.product.id, false);
                    })
            });
        }
    });

    const ProductListItemWithDroppable = DroppableHOC(ProductListItem);
    const ProductListItemDroppable = function (props) {
        return (<ProductListItemWithDroppable {...props}
                                              mimeTypes={[BC_MIMETYPES.ELEMENTS]}
                                              onDrop={e => {
                                                  const elements = dnd.getElementsFromDataTransfer(e.dataTransfer);
                                                  if (elements) {
                                                      props.onDropElements(props.product, elements);
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                  }
                                              }}
        />);
    }

    return ProductListItemDroppable;
});
