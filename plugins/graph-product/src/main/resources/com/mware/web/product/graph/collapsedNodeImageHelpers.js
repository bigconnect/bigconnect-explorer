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
    'util/vertex/formatters'
], function(F) {
    const imageSize = 150;
    const circlePaddingTop = 5;
    const circleLineWidth = 5;
    const circleColor = '#a5a5a5';
    const circleRadius = (imageSize / 2) - circlePaddingTop;
    const countTextFont = '50px Arial';
    const countTextBorderRadius = 22;
    const countTextBackgroundStyle = '#a5a5a5';
    const countTextForegroundStyle = '#ffffff';

    const textMeasurements = {};

    const drawCircle = function(canvas, canvasCtx) {
        canvasCtx.beginPath();
        canvasCtx.lineWidth = circleLineWidth;
        canvasCtx.strokeStyle = circleColor;
        canvasCtx.arc(
            canvas.width / 2,
            (canvas.height / 2) + circlePaddingTop,
            circleRadius,
            0, 2 * Math.PI,
            true
        );
        canvasCtx.stroke();
    };

    const drawImages = function(canvasCtx, images) {
        images.forEach((image, index) => {
            const layoutInfo = getCollapsedNodeInnerImageLayoutInfo(index, images.length, circleRadius * 2);
            if (layoutInfo) {
                canvasCtx.drawImage(
                    image,
                    layoutInfo.centerX - (layoutInfo.size / 2) + circleLineWidth,
                    layoutInfo.centerY - (layoutInfo.size / 2) + circleLineWidth + circlePaddingTop,
                    layoutInfo.size,
                    layoutInfo.size
                );
            }
        });
    };

    const measureText = function(canvasCtx, text) {
        if (textMeasurements[text]) {
            return textMeasurements[text];
        }
        return (textMeasurements[text] = canvasCtx.measureText(text));
    };

    const drawCount = function(canvas, canvasCtx, count) {
        canvasCtx.font = countTextFont;
        const countText = count.toString();
        const countTextMeasurements = measureText(canvasCtx, countText);
        const countTextCenterY = countTextBorderRadius;
        const countTextRight = canvas.width;
        const countTextLeft = countTextRight - countTextMeasurements.width - (1.5 * countTextBorderRadius);
        canvasCtx.beginPath();
        canvasCtx.arc(
            countTextLeft + countTextBorderRadius,
            countTextCenterY,
            countTextBorderRadius,
            3 * (Math.PI / 2), 1 * (Math.PI / 2),
            true
        );
        canvasCtx.lineTo(countTextRight - countTextBorderRadius, countTextCenterY + countTextBorderRadius);
        canvasCtx.arc(
            countTextRight - countTextBorderRadius,
            countTextCenterY,
            countTextBorderRadius,
            1 * (Math.PI / 2), 3 * (Math.PI / 2),
            true
        );
        canvasCtx.lineTo(countTextLeft + countTextBorderRadius, countTextCenterY - countTextBorderRadius);
        canvasCtx.fillStyle = countTextBackgroundStyle;
        canvasCtx.fill();

        // draw count
        canvasCtx.fillStyle = countTextForegroundStyle;
        canvasCtx.textAlign = 'center';
        canvasCtx.textBaseline = 'middle';
        canvasCtx.fillText(
            countText,
            countTextLeft + ((countTextRight - countTextLeft) / 2),
            countTextCenterY
        );
    };

    const generateImageDataUriForCollapsedNode = function(vertices, collapsedNodeId, collapsedNode, childCount) {
        return Promise.all(collapsedNode.children.map(vertexId => loadVertexImage(vertices, vertexId)))
            .then(images => {
                images = _.compact(images);
                const canvas = document.createElement('canvas');
                canvas.height = canvas.width = imageSize;
                const canvasCtx = canvas.getContext('2d');

                drawCircle(canvas, canvasCtx);
                drawImages(canvasCtx, images);
                drawCount(canvas, canvasCtx, childCount);

                return canvas.toDataURL('image/png');
            })
            .catch(err => {
                console.error('could not load vertex images', err);
            });
    };

    const loadVertexImage = function(vertices, vertexId) {
        return new Promise((resolve, reject) => {
            const vertex = vertices[vertexId];
            if (!vertex) {
                resolve(null);
            }
            const vertexImageUrl = F.vertex.image(vertex, null, 150);
            const image = document.createElement('img');
            image.onload = () => {
                if (image.naturalHeight === 0 || image.naturalWidth === 0) {
                    reject(new Error(`Invalid image: ${vertexImageUrl}`));
                }
                resolve(image);
            };
            image.src = vertexImageUrl;
        });
    };

    const getCollapsedNodeInnerImageLayoutInfo = function(index, number, size) {
        if (number === 1) {
            return {
                centerX: size / 2,
                centerY: size / 2,
                size: size * 0.7
            };
        } else if (number === 2) {
            return {
                centerX: (size / 3) * (index + 1),
                centerY: size / 2,
                size: size / 3.5
            };
        } else if (number === 3) {
            if (index === 0) {
                return {
                    centerX: size / 2,
                    centerY: size / 3,
                    size: size / 3.5
                };
            } else {
                return {
                    centerX: (size / 3) * index,
                    centerY: 2 * (size / 3),
                    size: size / 3.5
                };
            }
        } else {
            if (index < 4) {
                return {
                    centerX: (size / 3) * ((index % 2) + 1),
                    centerY: (size / 3) * (index < 2 ? 1 : 2),
                    size: size / 4
                };
            }
            return null;
        }
    };

    return {
        updateImageDataUrisForCollapsedNodes(collapsedNodes, vertices, rootNode, collapsedImageDataUris, onCollapsedImageDataUrisChange) {
            if (!vertices || Object.keys(vertices).length === 0) {
                return;
            }
            const renderedNodes = _.pick(collapsedNodes, ({ id }) => rootNode.children.includes(id));

            Promise.map(Object.keys(renderedNodes), collapsedNodeId => {
                const collapsedNode = renderedNodes[collapsedNodeId];
                const childIds = collapsedNode.children.filter(id => {
                    return vertices[id] || collapsedNodes[id] && collapsedNodes[id].visible
                });
                const childIdsString = childIds.join(';');
                const existingCollapsedNodeImageUriInfo = collapsedImageDataUris[collapsedNodeId];
                if (existingCollapsedNodeImageUriInfo && existingCollapsedNodeImageUriInfo.childIdsString === childIdsString) {
                    return;
                }

                return generateImageDataUriForCollapsedNode(vertices, collapsedNodeId, collapsedNode, childIds.length)
                    .then(imageDataUri => [
                        collapsedNodeId, {
                            childIdsString,
                            imageDataUri
                        }
                    ]);
            }).then(newImageDataUris => {
                const updates = _.object(_.compact(newImageDataUris));

                if (!_.isEmpty(updates)) {
                    onCollapsedImageDataUrisChange(updates)
                }
            });
        }
    };
});
