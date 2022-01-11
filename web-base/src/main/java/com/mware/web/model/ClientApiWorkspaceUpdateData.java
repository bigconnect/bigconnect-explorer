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
package com.mware.web.model;

import com.mware.core.model.clientapi.dto.ClientApiObject;
import com.mware.core.model.clientapi.dto.GraphPosition;
import com.mware.core.model.clientapi.dto.WorkspaceAccess;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
public class ClientApiWorkspaceUpdateData implements ClientApiObject {
    private Boolean staging;
    private String title;
    private List<EntityUpdate> entityUpdates = new ArrayList<EntityUpdate>();
    private List<String> entityDeletes = new ArrayList<String>();
    private List<UserUpdate> userUpdates = new ArrayList<UserUpdate>();
    private List<String> userDeletes = new ArrayList<String>();

    public void setTitle(String title) {
        this.title = title;
    }

    public void setStaging(Boolean staging) {
        this.staging = staging;
    }

    public static class EntityUpdate {
        private String vertexId;
        private GraphPosition graphPosition;
        private String graphLayoutJson;

        public EntityUpdate() {

        }

        public EntityUpdate(String vertexId, GraphPosition graphPosition) {
            this.vertexId = vertexId;
            this.graphPosition = graphPosition;
        }

        public String getVertexId() {
            return vertexId;
        }

        public EntityUpdate setVertexId(String vertexId) {
            this.vertexId = vertexId;
            return this;
        }

        public GraphPosition getGraphPosition() {
            return graphPosition;
        }

        public EntityUpdate setGraphPosition(GraphPosition graphPosition) {
            this.graphPosition = graphPosition;
            return this;
        }

        public String getGraphLayoutJson() {
            return graphLayoutJson;
        }

        public EntityUpdate setGraphLayoutJson(String graphLayoutJson) {
            this.graphLayoutJson = graphLayoutJson;
            return this;
        }
    }

    @Getter
    @Setter
    public static class UserUpdate {
        private String userId;
        private WorkspaceAccess access;
    }
}
