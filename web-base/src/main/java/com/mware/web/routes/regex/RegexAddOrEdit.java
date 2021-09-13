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
package com.mware.web.routes.regex;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.exception.BcException;
import com.mware.core.model.regex.GeRegexRepository;
import com.mware.core.model.regex.Regex;
import com.mware.core.user.User;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Optional;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiSuccess;

@Singleton
public class RegexAddOrEdit implements ParameterizedHandler {
    private final GeRegexRepository regexRepository;

    @Inject
    public RegexAddOrEdit(
            GeRegexRepository regexRepository
    ) {
        this.regexRepository = regexRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            User authUser,
            @Optional(name = "id") String regexId,
            @Required(name = "name") String regexName,
            @Required(name = "pattern") String regexPattern,
            @Required(name = "concept") String regexConcept,
            @Required(name = "mode") String mode
    ) throws Exception {
        try {
            if ("create".equals(mode)) {
                regexRepository.createRegex(regexName, regexPattern, regexConcept);
            } else if ("edit".equals(mode)) {
                Regex regex = regexRepository.findRegexById(regexId);
                if (regex != null) {

                    regexRepository.updateRegex(
                            regexId,
                            regexName,
                            regexPattern,
                            regexConcept
                    );
                } else {
                    throw new BcException("Regex with id=" + regexId + " was not found");
                }

            } else
                throw new BcException("The provided mode is not valid");

        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
        return BcResponse.SUCCESS;
    }
}
