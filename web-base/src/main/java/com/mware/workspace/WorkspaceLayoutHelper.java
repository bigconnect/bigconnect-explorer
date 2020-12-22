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
package com.mware.workspace;

import com.mware.core.exception.BcException;
import com.mware.core.model.clientapi.dto.GraphPosition;
import com.mware.core.util.StreamUtil;

import java.util.OptionalInt;

public class WorkspaceLayoutHelper {
    public static GraphPosition findOpening(
            Iterable<GraphPosition> existingPositions,
            GraphPosition graphPosition,
            LayoutHints layoutHints
    ) {
        while (isOccupied(existingPositions, graphPosition, layoutHints)) {
            graphPosition = findNextPosition(graphPosition, layoutHints);
        }
        return graphPosition;
    }

    public static GraphPosition findNextPosition(
            GraphPosition graphPosition,
            LayoutHints layoutHints
    ) {
        int x = graphPosition.getX();
        int y = graphPosition.getY();
        int minX = layoutHints.getMinX() == null ? 0 : layoutHints.getMinX();
        int maxX = layoutHints.getMaxX() == null ? 0 : layoutHints.getMaxX();
        int minY = layoutHints.getMinY() == null ? 0 : layoutHints.getMinY();
        int maxY = layoutHints.getMaxY() == null ? 0 : layoutHints.getMaxY();
        boolean overflow = false;
        switch (layoutHints.getDirection()) {
            case LEFT_TO_RIGHT:
                x += layoutHints.getXSpacing();
                if (layoutHints.getMaxX() != null && x > layoutHints.getMaxX() - layoutHints.getXSpacing()) {
                    x = minX;
                    overflow = true;
                }
                break;

            case RIGHT_TO_LEFT:
                x -= layoutHints.getXSpacing();
                if (layoutHints.getMinX() != null && x < layoutHints.getMinX()) {
                    x = maxX;
                    overflow = true;
                }
                break;

            case TOP_TO_BOTTOM:
                y += layoutHints.getYSpacing();
                if (layoutHints.getMaxY() != null && y > layoutHints.getMaxY() - layoutHints.getYSpacing()) {
                    y = minY;
                    overflow = true;
                }
                break;

            case BOTTOM_TO_TOP:
                y -= layoutHints.getYSpacing();
                if (layoutHints.getMinY() != null && y < layoutHints.getMinY()) {
                    y = maxY;
                    overflow = true;
                }
                break;

            default:
                throw new BcException("unhandled direction: " + layoutHints.getDirection());
        }

        if (overflow) {
            switch (layoutHints.getOverflowDirection()) {
                case LEFT_TO_RIGHT:
                    x += layoutHints.getXSpacing();
                    break;
                case RIGHT_TO_LEFT:
                    x -= layoutHints.getXSpacing();
                    break;
                case TOP_TO_BOTTOM:
                    y += layoutHints.getYSpacing();
                    break;
                case BOTTOM_TO_TOP:
                    y -= layoutHints.getYSpacing();
                    break;
                default:
                    throw new BcException("unhandled direction: " + layoutHints.getDirection());
            }
        }

        return new GraphPosition(x, y);
    }

    public static boolean isOccupied(
            Iterable<GraphPosition> existingPositions,
            GraphPosition graphPosition,
            LayoutHints layoutHints
    ) {
        return StreamUtil.stream(existingPositions)
                .anyMatch(gp -> gp.getX() > graphPosition.getX() - layoutHints.getXSpacing()
                        && gp.getX() < graphPosition.getX() + layoutHints.getXSpacing()
                        && gp.getY() > graphPosition.getY() - layoutHints.getYSpacing()
                        && gp.getY() < graphPosition.getY() + layoutHints.getYSpacing());
    }

    public static GraphPosition findBottomLeftOpening(Iterable<GraphPosition> graphPositions) {
        int minX = findMinX(graphPositions).orElse(0);
        int maxY = findMaxY(graphPositions).orElse(0);
        LayoutHints layoutHints = new LayoutHints()
                .setDirection(LayoutHints.Direction.TOP_TO_BOTTOM, LayoutHints.Direction.LEFT_TO_RIGHT);
        return findOpening(graphPositions, new GraphPosition(minX, maxY), layoutHints);
    }

    public static GraphPosition findTopLeftOpening(Iterable<GraphPosition> graphPositions) {
        int minX = findMinX(graphPositions).orElse(0);
        int maxY = findMinY(graphPositions).orElse(0);
        LayoutHints layoutHints = new LayoutHints()
                .setDirection(LayoutHints.Direction.BOTTOM_TO_TOP, LayoutHints.Direction.LEFT_TO_RIGHT);
        return findOpening(graphPositions, new GraphPosition(minX, maxY), layoutHints);
    }

    public static OptionalInt findMinX(Iterable<GraphPosition> graphPositions) {
        return StreamUtil.stream(graphPositions)
                .mapToInt(GraphPosition::getX)
                .min();
    }

    public static OptionalInt findMaxX(Iterable<GraphPosition> graphPositions) {
        return StreamUtil.stream(graphPositions)
                .mapToInt(GraphPosition::getX)
                .max();
    }

    public static OptionalInt findMinY(Iterable<GraphPosition> graphPositions) {
        return StreamUtil.stream(graphPositions)
                .mapToInt(GraphPosition::getY)
                .min();
    }

    public static OptionalInt findMaxY(Iterable<GraphPosition> graphPositions) {
        return StreamUtil.stream(graphPositions)
                .mapToInt(GraphPosition::getY)
                .max();
    }
}
