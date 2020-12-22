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
    'prop-types'
], function(createReactClass, PropTypes) {

    const ExportGraph = createReactClass({
        propTypes: {
            workspaceId: PropTypes.string,
            productId: PropTypes.string,
            exporter: PropTypes.object,
            cy: PropTypes.object,
            success: PropTypes.func.isRequired
        },

        getInitialState() {
            return {
                format: 'png'
            }
        },

        exportGraph() {
            let exportData = null;
            const format = this.state.format,
                fileName = 'export.'+format,
                cyContainer = this.props.cy.container(),
                graphWidth = cyContainer.clientWidth,
                graphHeight = cyContainer.clientHeight;

            switch (format) {
                case 'png':
                    exportData = this.props.cy.png();
                    window.saveAs(exportData, fileName);
                    break;
                case 'jpg':
                    exportData = this.props.cy.jpg();
                    window.saveAs(exportData, fileName);
                    break;
                case 'pdf':
                        let pdf = new jsPDF({orientation: 'l', unit: 'px', format: [graphWidth, graphHeight]}),
                        imgData = this.props.cy.png({bg: '#ffffff'});

                    pdf.addImage(imgData, 'PNG', 0, 0);
                    pdf.save(fileName);
                    break;
                case 'html':
                    let htmlImgData = this.props.cy.png({bg: '#ffffff'}),
                        html = `<!doctype html>
<html lang="en">
<body>
<img src="${htmlImgData}" />
</body>
</html>`;

                    window.saveAs(new Blob([html]), fileName);
                    break;
            }


            this.props.success();
        },

        render() {
            return (
                <div className="graph_export m-b-1">
                    <select className="custom-select form-control" value={this.state.format}
                            onChange={(event) => this.setState({format: event.target.value})}
                    >
                        <option value="png">{i18n('graph.export.png')}</option>
                        <option value="jpg">{i18n('graph.export.jpg')}</option>
                        <option value="pdf">{i18n('graph.export.pdf')}</option>
                        <option value="html">{i18n('graph.export.html')}</option>
                    </select>
                    <button
                        onClick={() => this.exportGraph()}
                        className="btn btn-sm btn-primary m-t-1">{i18n('graph.export.button')}</button>
                </div>
            )
        }
    });

    return ExportGraph;
});
