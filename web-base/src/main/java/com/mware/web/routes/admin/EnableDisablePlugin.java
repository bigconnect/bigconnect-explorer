package com.mware.web.routes.admin;

import com.google.inject.Inject;
import com.mware.core.model.plugin.PluginState;
import com.mware.core.model.plugin.PluginStateRepository;
import com.mware.core.user.User;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;

public class EnableDisablePlugin implements ParameterizedHandler {
    private final PluginStateRepository pluginStateRepository;

    @Inject
    public EnableDisablePlugin(
            PluginStateRepository pluginStateRepository
    ) {
        this.pluginStateRepository = pluginStateRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "clazz") String clazz,
            @Required(name = "enabled") Boolean enabled,
            User user
    ) throws Exception {
        PluginState pluginState = pluginStateRepository.findOne(clazz, user);
        pluginState.setEnabled(enabled);
        pluginStateRepository.save(pluginState, user);
        return BcResponse.SUCCESS;
    }
}
