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
package com.mware.web.routes.dataload;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.user.User;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import com.mware.ingest.database.DataConnection;
import com.mware.ingest.database.DataConnectionRepository;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiDataLoadResponse;

@Singleton
public class DataConnectionAddOrEdit implements ParameterizedHandler {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(DataConnectionAddOrEdit.class);

    private DataConnectionRepository dataConnectionRepository;

    @Inject
    public DataConnectionAddOrEdit(DataConnectionRepository dataConnectionRepository) {
        this.dataConnectionRepository = dataConnectionRepository;
    }

    @Handle
    public ClientApiDataLoadResponse handle(
            User authUser,
            @Optional(name = "id") String id,
            @Required(name = "name") String name,
            @Optional(name = "description") String description,
            @Required(name = "driverClass") String driverClass,
            @Optional(name = "driverProperties") String driverProperties,
            @Required(name = "jdbcUrl") String jdbcUrl,
            @Required(name = "username") String username,
            @Required(name = "password") String password,
            @Required(name = "mode") String mode
    ) throws Exception {
        ClientApiDataLoadResponse clientApiDataLoadResponse = new ClientApiDataLoadResponse();
        clientApiDataLoadResponse.setSuccess(true);
        try {
            if ("create".equals(mode)) {
                if (dataConnectionRepository.findByName(name) != null) {
                    throw new BcException("Data Connection " + name + " already exists");
                }
                createAndTestDataConnection(name, description, driverClass, driverProperties, jdbcUrl, username, password);
            } else if ("edit".equals(mode)) {
                DataConnection dc = dataConnectionRepository.findDcById(id);
                if (dc != null) {
                    DataConnection dcTest = createAndTestDataConnection(name, description, driverClass, driverProperties, jdbcUrl, username, password);
                    if (dcTest != null ) {
                        dataConnectionRepository.deleteDataConnection(dcTest.getId());
                    }

                    dataConnectionRepository.updateDataConnection(
                            id,
                            name,
                            description,
                            driverClass,
                            driverProperties,
                            jdbcUrl,
                            username,
                            password
                    );
                } else {
                    throw new BcException("Data Connection with id=" + id + " was not found");
                }
            } else
                throw new BcException("The provided mode is not valid");
        } catch (BcException e) {
            LOGGER.error("BCException ",e);
            clientApiDataLoadResponse.setSuccess(false);
            clientApiDataLoadResponse.setExceptionMessage(e.getMessage());
        }

        return clientApiDataLoadResponse;
    }

    private DataConnection createAndTestDataConnection(
            String name,
            String description,
            String driverClass,
            String driverProperties,
            String jdbcUrl,
            String username,
            String password) throws BcException {

        DataConnection dc = dataConnectionRepository.createDataConnection(
                name,
                description,
                driverClass,
                driverProperties,
                jdbcUrl,
                username,
                password
        );
        try {
            if (!dataConnectionRepository.checkDataConnection(dc)) {
                throw new BcException("Could not initialize data connection");
            }
        } catch (BcException e) {
            //cleanup
            dataConnectionRepository.deleteDataConnection(dc.getId());
            throw (e);
        }
        return dc;
    }
}
