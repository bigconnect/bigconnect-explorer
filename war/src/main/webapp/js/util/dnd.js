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
define(['util/vertex/formatters'], function(F) {

    const FALLBACK_PREFIX = 'BC_ElementIds: ';
    let supportsMultipleTypes;
    // IE doesn't support setData([mimetype], ...), it only supports setData('text', ...)
    const checkIfSupportsMultipleTypes = (dataTransfer) => {
        if (supportsMultipleTypes !== undefined) {
            return supportsMultipleTypes;
        } else {
            try {
                dataTransfer.setData('CHECK_ALLOWS_MANY_TYPES', 'true')
                const data = dataTransfer.getData('CHECK_ALLOWS_MANY_TYPES')

                if (data) {
                    supportsMultipleTypes = true;
                }
                return true;
            } catch(e) {
                //Firefox throws exception on setData() for a read-only dataTransfer (from a drop event)
                if (e.name === 'NoModificationAllowedError') {
                    return true;
                } else {
                    supportsMultipleTypes = false;
                    return false;
                }
            }
        }
    }

    return {
        dataTransferHasValidMimeType(dataTransfer, mimeTypes = []) {
            if (checkIfSupportsMultipleTypes(dataTransfer)) {
                return _.any(dataTransfer.types, type => mimeTypes.includes(type));
            } else {
                const text = dataTransfer.getData('Text');
                return text && text.startsWith(FALLBACK_PREFIX) && mimeTypes.includes(BC_MIMETYPES.ELEMENTS);
            }
        },
        setDataTransferWithElements(dataTransfer, { vertexIds, edgeIds, elements = [] }) {
            const typeToData = segmentToTypes(vertexIds, edgeIds, elements);
            if (checkIfSupportsMultipleTypes(dataTransfer)) {
                _.each(typeToData, (data, type) => {
                    if (data) {
                        dataTransfer.setData(type, data);
                    }
                })
            } else {
                dataTransfer.setData('Text', FALLBACK_PREFIX + typeToData[BC_MIMETYPES.ELEMENTS])
            }
            dataTransfer.effectAllowed = 'all';

            Promise.all([
                Promise.require('data/web-worker/store/element/actions'),
                bcData.storePromise
            ]).spread((actions, store) => store.dispatch(actions.setFocus({ elementIds: [] })));
        },
        getElementsFromDataTransfer(dataTransfer) {
            var dataStr;
            if (checkIfSupportsMultipleTypes(dataTransfer)) {
                dataStr = dataTransfer.getData(BC_MIMETYPES.ELEMENTS);
            } else {
                const text = dataTransfer.getData('Text');
                if (text && text.indexOf(FALLBACK_PREFIX) === 0) {
                    dataStr = text.substring(FALLBACK_PREFIX.length);
                }
            }

            if (dataStr) {
                return JSON.parse(dataStr);
            }
        }
    }

    function segmentToTypes(vertexIds = [], edgeIds = [], elements) {
        const hasFullElements = elements.length > 0;
        if (hasFullElements) {
            vertexIds = [];
            edgeIds = [];
            elements.forEach(({ id, type }) => {
                if (type === 'extendedDataRow') {
                    if (id.elementType === 'VERTEX') {
                        vertexIds.push(id.elementId);
                    } else {
                        edgeIds.push(id.elementId);
                    }
                } else if (type === 'vertex') {
                    vertexIds.push(id);
                } else {
                    edgeIds.push(id);
                }
            })
        }
        const url = F.vertexUrl.url(hasFullElements ? elements : vertexIds.concat(edgeIds), bcData.currentWorkspaceId);
        const plain = hasFullElements ?
            elements.map(item => [
                F.vertex.title(item), F.vertexUrl.url([item], bcData.currentWorkspaceId)
            ].join('\n')).join('\n\n') :
            url;

        return {
            'text/uri-list': url,
            'text/plain': plain,
            'Text': plain,
            [BC_MIMETYPES.ELEMENTS]: JSON.stringify({ vertexIds, edgeIds })
        }
    }
})
