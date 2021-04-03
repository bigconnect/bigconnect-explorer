package com.mware.web.routes.element;

import com.mware.core.model.clientapi.dto.ClientApiObject;
import com.mware.core.security.AuditService;
import com.mware.core.user.User;
import com.mware.ge.Authorizations;
import com.mware.ge.Graph;
import com.mware.security.ACLProvider;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;
import com.mware.web.parameterProviders.ActiveWorkspaceId;
import com.mware.web.routes.edge.EdgeDelete;
import com.mware.web.routes.vertex.VertexRemove;
import com.mware.workspace.WorkspaceHelper;
import lombok.Data;

import javax.inject.Inject;
import java.util.Arrays;

public class ElementDelete implements ParameterizedHandler {
    private Graph graph;
    private ACLProvider aclProvider;
    private WorkspaceHelper workspaceHelper;
    private AuditService auditService;

    @Inject
    public ElementDelete(
            Graph graph,
            ACLProvider aclProvider,
            WorkspaceHelper workspaceHelper,
            AuditService auditService
    ) {
        this.graph = graph;
        this.aclProvider = aclProvider;
        this.workspaceHelper = workspaceHelper;
        this.auditService = auditService;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "elements") ClientApiElementsItem[] elements,
            @ActiveWorkspaceId String workspaceId,
            User user,
            Authorizations authorizations
    ) {
        VertexRemove vertexRemover = new VertexRemove(graph, workspaceHelper, aclProvider, auditService);
        Arrays.stream(elements)
                .filter(e -> "vertex".equals(e.type))
                .forEach(e -> {
                    try {
                        vertexRemover.handle(e.id, workspaceId, user, authorizations);
                    } catch (Exception exception) {
                        exception.printStackTrace();
                    }
                });

        EdgeDelete edgeRemover = new EdgeDelete(graph, workspaceHelper, aclProvider, auditService);
        Arrays.stream(elements)
                .filter(e -> "edge".equals(e.type))
                .forEach(e -> {
                    try {
                        edgeRemover.handle(e.id, workspaceId, user, authorizations);
                    } catch (Exception exception) {
                        exception.printStackTrace();
                    }
                });
        return BcResponse.SUCCESS;
    }

    @Data
    public static class ClientApiElementsItem implements ClientApiObject {
        public String type;
        public String id;
    }
}
