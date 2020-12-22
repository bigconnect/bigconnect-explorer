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

public class LayoutHints {
    public static final int DEFAULT_SPACING = 200;
    private int xSpacing = DEFAULT_SPACING;
    private int ySpacing = DEFAULT_SPACING;
    private Integer minX;
    private Integer maxX;
    private Integer minY;
    private Integer maxY;
    private Direction direction = Direction.LEFT_TO_RIGHT;
    private Direction overflowDirection = Direction.TOP_TO_BOTTOM;

    public int getXSpacing() {
        return xSpacing;
    }

    public LayoutHints setXSpacing(int xSpacing) {
        this.xSpacing = xSpacing;
        return this;
    }

    public int getYSpacing() {
        return ySpacing;
    }

    public LayoutHints setYSpacing(int ySpacing) {
        this.ySpacing = ySpacing;
        return this;
    }

    public LayoutHints setSpacing(int spacing) {
        setXSpacing(spacing);
        setYSpacing(spacing);
        return this;
    }

    public Integer getMinX() {
        return minX;
    }

    public LayoutHints setMinX(Integer minX) {
        this.minX = minX;
        return this;
    }

    public Integer getMinY() {
        return minY;
    }

    public LayoutHints setMinY(Integer minY) {
        this.minY = minY;
        return this;
    }

    public Integer getMaxX() {
        return maxX;
    }

    public LayoutHints setMaxX(Integer maxX) {
        this.maxX = maxX;
        return this;
    }

    public Integer getMaxY() {
        return maxY;
    }

    public LayoutHints setMaxY(Integer maxY) {
        this.maxY = maxY;
        return this;
    }

    public Direction getDirection() {
        return direction;
    }

    public Direction getOverflowDirection() {
        return overflowDirection;
    }

    public LayoutHints setDirection(Direction direction, Direction overflowDirection) {
        if (direction.isHorizontal() && overflowDirection.isHorizontal()) {
            throw new BcException("Both direction and overflowDirection cannot be horizontal");
        }
        if (direction.isVertical() && overflowDirection.isVertical()) {
            throw new BcException("Both direction and overflowDirection cannot be vertical");
        }
        this.direction = direction;
        this.overflowDirection = overflowDirection;
        return this;
    }

    public enum Direction {
        LEFT_TO_RIGHT,
        RIGHT_TO_LEFT,
        TOP_TO_BOTTOM,
        BOTTOM_TO_TOP;

        public boolean isHorizontal() {
            return this == LEFT_TO_RIGHT || this == RIGHT_TO_LEFT;
        }

        public boolean isVertical() {
            return !isHorizontal();
        }
    }
}
