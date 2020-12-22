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

import com.mware.core.model.clientapi.dto.GraphPosition;
import org.junit.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.Assert.assertEquals;

public class WorkspaceLayoutHelperTest {
    @Test
    public void testFindOpening() {
        List<GraphPosition> existingPositions = new ArrayList<>();
        GraphPosition graphPosition = new GraphPosition(0, 0);
        LayoutHints layoutHints = new LayoutHints()
                .setMaxX(LayoutHints.DEFAULT_SPACING * 2);

        GraphPosition opening = WorkspaceLayoutHelper.findOpening(existingPositions, graphPosition, layoutHints);
        assertEquals("no existing so no conflict", new GraphPosition(0, 0), opening);

        existingPositions.add(new GraphPosition(0, 0));
        opening = WorkspaceLayoutHelper.findOpening(existingPositions, graphPosition, layoutHints);
        assertEquals("existing at 0,0 so moved over 1 to right", new GraphPosition(LayoutHints.DEFAULT_SPACING, 0), opening);

        existingPositions.add(new GraphPosition(LayoutHints.DEFAULT_SPACING, 0));
        opening = WorkspaceLayoutHelper.findOpening(existingPositions, graphPosition, layoutHints);
        assertEquals("first row full so next row first column", new GraphPosition(0, LayoutHints.DEFAULT_SPACING), opening);
    }

    @Test
    public void testFindNextPositionNoOverflow() {
        assertEquals(
                "default layout hints",
                new GraphPosition(LayoutHints.DEFAULT_SPACING, 0),
                WorkspaceLayoutHelper.findNextPosition(new GraphPosition(0, 0), new LayoutHints())
        );

        assertEquals(
                "left to right",
                new GraphPosition(LayoutHints.DEFAULT_SPACING, 0),
                WorkspaceLayoutHelper.findNextPosition(
                        new GraphPosition(0, 0),
                        new LayoutHints()
                                .setDirection(LayoutHints.Direction.LEFT_TO_RIGHT, LayoutHints.Direction.TOP_TO_BOTTOM)
                )
        );

        assertEquals(
                "right to left",
                new GraphPosition(-LayoutHints.DEFAULT_SPACING, 0),
                WorkspaceLayoutHelper.findNextPosition(
                        new GraphPosition(0, 0),
                        new LayoutHints()
                                .setDirection(LayoutHints.Direction.RIGHT_TO_LEFT, LayoutHints.Direction.TOP_TO_BOTTOM)
                )
        );

        assertEquals(
                "top to bottom",
                new GraphPosition(0, LayoutHints.DEFAULT_SPACING),
                WorkspaceLayoutHelper.findNextPosition(
                        new GraphPosition(0, 0),
                        new LayoutHints()
                                .setDirection(LayoutHints.Direction.TOP_TO_BOTTOM, LayoutHints.Direction.LEFT_TO_RIGHT)
                )
        );

        assertEquals(
                "bottom to top",
                new GraphPosition(0, -LayoutHints.DEFAULT_SPACING),
                WorkspaceLayoutHelper.findNextPosition(
                        new GraphPosition(0, 0),
                        new LayoutHints()
                                .setDirection(LayoutHints.Direction.BOTTOM_TO_TOP, LayoutHints.Direction.LEFT_TO_RIGHT)
                )
        );
    }

    @Test
    public void testFindNextPositionOverflow() {
        assertEquals(
                "left to right, top to bottom",
                new GraphPosition(100, LayoutHints.DEFAULT_SPACING),
                WorkspaceLayoutHelper.findNextPosition(
                        new GraphPosition(400, 0),
                        new LayoutHints()
                                .setMinX(100)
                                .setMaxX(500)
                                .setDirection(LayoutHints.Direction.LEFT_TO_RIGHT, LayoutHints.Direction.TOP_TO_BOTTOM)
                )
        );

        assertEquals(
                "left to right, bottom to left",
                new GraphPosition(100, -LayoutHints.DEFAULT_SPACING),
                WorkspaceLayoutHelper.findNextPosition(
                        new GraphPosition(400, 0),
                        new LayoutHints()
                                .setMinX(100)
                                .setMaxX(500)
                                .setDirection(LayoutHints.Direction.LEFT_TO_RIGHT, LayoutHints.Direction.BOTTOM_TO_TOP)
                )
        );

        assertEquals(
                "right to left, top to bottom",
                new GraphPosition(1000, LayoutHints.DEFAULT_SPACING),
                WorkspaceLayoutHelper.findNextPosition(
                        new GraphPosition(600, 0),
                        new LayoutHints()
                                .setMinX(500)
                                .setMaxX(1000)
                                .setDirection(LayoutHints.Direction.RIGHT_TO_LEFT, LayoutHints.Direction.TOP_TO_BOTTOM)
                )
        );

        assertEquals(
                "top to bottom, left to right",
                new GraphPosition(LayoutHints.DEFAULT_SPACING, 100),
                WorkspaceLayoutHelper.findNextPosition(
                        new GraphPosition(0, 400),
                        new LayoutHints()
                                .setMinY(100)
                                .setMaxY(500)
                                .setDirection(LayoutHints.Direction.TOP_TO_BOTTOM, LayoutHints.Direction.LEFT_TO_RIGHT)
                )
        );

        assertEquals(
                "top to bottom, right to left",
                new GraphPosition(-LayoutHints.DEFAULT_SPACING, 100),
                WorkspaceLayoutHelper.findNextPosition(
                        new GraphPosition(0, 400),
                        new LayoutHints()
                                .setMinY(100)
                                .setMaxY(500)
                                .setDirection(LayoutHints.Direction.TOP_TO_BOTTOM, LayoutHints.Direction.RIGHT_TO_LEFT)
                )
        );

        assertEquals(
                "bottom to top, left to right",
                new GraphPosition(LayoutHints.DEFAULT_SPACING, 1000),
                WorkspaceLayoutHelper.findNextPosition(
                        new GraphPosition(0, 600),
                        new LayoutHints()
                                .setMinY(500)
                                .setMaxY(1000)
                                .setDirection(LayoutHints.Direction.BOTTOM_TO_TOP, LayoutHints.Direction.LEFT_TO_RIGHT)
                )
        );
    }

    @Test
    public void testFindBottomLeftOpening() {
        List<GraphPosition> graphPositions = new ArrayList<>();

        assertEquals(
                new GraphPosition(0, 0),
                WorkspaceLayoutHelper.findBottomLeftOpening(graphPositions)
        );

        graphPositions.add(new GraphPosition(0, 0));
        assertEquals(
                new GraphPosition(0, LayoutHints.DEFAULT_SPACING),
                WorkspaceLayoutHelper.findBottomLeftOpening(graphPositions)
        );

        graphPositions.add(new GraphPosition(100, 100));
        assertEquals(
                new GraphPosition(0, 100 + LayoutHints.DEFAULT_SPACING),
                WorkspaceLayoutHelper.findBottomLeftOpening(graphPositions)
        );
    }

    @Test
    public void testFindTopLeftOpening() {
        List<GraphPosition> graphPositions = new ArrayList<>();

        assertEquals(
                new GraphPosition(0, 0),
                WorkspaceLayoutHelper.findTopLeftOpening(graphPositions)
        );

        graphPositions.add(new GraphPosition(0, 0));
        assertEquals(
                new GraphPosition(0, -LayoutHints.DEFAULT_SPACING),
                WorkspaceLayoutHelper.findTopLeftOpening(graphPositions)
        );

        graphPositions.add(new GraphPosition(-100, 100));
        assertEquals(
                new GraphPosition(-100, -LayoutHints.DEFAULT_SPACING),
                WorkspaceLayoutHelper.findTopLeftOpening(graphPositions)
        );
    }
}
