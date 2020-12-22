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
define([], function() {
    'use strict';

    const initialState = {
        global: {
            undos: [],
            redos: []
        }
    };

    return function undoActionHistory(state = initialState, { type, payload }) {
        switch (type) {
            case 'UNDO': {
                const scope = payload && payload.undoScope || 'global';
                if (!state[scope]) {
                    return state;
                }
                const { undos, redos } = state[scope];
                if (!undos.length) {
                    return state;
                }
                const currentUndo = undos[undos.length - 1];

                return {
                    ...state,
                    [scope]: {
                        undos: undos.slice(0, undos.length - 1),
                        redos: [ ...redos, currentUndo ]
                    }
                };
            }
            case 'REDO': {
                const scope = payload && payload.undoScope || 'global';
                if (!state[scope]) {
                    return state;
                }
                const { undos, redos } = state[scope];
                if (!redos.length) {
                    return state;
                }
                const currentRedo = redos[redos.length - 1];

                return {
                    ...state,
                    [scope]: {
                        undos: [ ...undos, currentRedo ],
                        redos: redos.slice(0, redos.length - 1)
                    }
                };
            }
            case 'PUSH_UNDO':
            default: {
                if (!payload) {
                    return state;
                }

                const { undoScope: scope = 'global', undo, redo, undoActionType } = payload;
                if (!undo || !redo) {
                    return state;
                }

                const newUndo = {
                    undo,
                    redo,
                    type: undoActionType || type
                };

                const scopedState = state[scope] || { undos: [], redos: [] };
                const { undos, redos } = scopedState;

                return {
                    ...state,
                    [scope]: {
                        undos: [ ...undos, newUndo ],
                        redos: []
                    }
                };
            }
        }
    }
});
