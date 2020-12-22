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
package com.mware.web.routes.map;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.geocoder.GeocodeResult;
import com.mware.geocoder.GeocoderRepository;
import com.mware.web.BcResponse;
import com.mware.web.framework.ParameterizedHandler;
import com.mware.web.framework.annotations.Handle;
import com.mware.web.framework.annotations.Required;
import com.mware.web.model.ClientApiMapGeocodeResponse;

import java.util.List;

@Singleton
public class GetGeocoder implements ParameterizedHandler {
    private final GeocoderRepository geocoderRepository;

    @Inject
    public GetGeocoder(GeocoderRepository geocoderRepository) {
        this.geocoderRepository = geocoderRepository;
    }

    @Handle
    public void handle(
            @Required(name = "q") String query,
            BcResponse response
    ) throws Exception {
        List<GeocodeResult> geocoderResults = this.geocoderRepository.find(query);
        ClientApiMapGeocodeResponse result = toClientApi(geocoderResults);
        response.respondWithClientApiObject(result);
    }

    private ClientApiMapGeocodeResponse toClientApi(List<GeocodeResult> geocoderResults) {
        ClientApiMapGeocodeResponse result = new ClientApiMapGeocodeResponse();

        for (GeocodeResult geocodeResult : geocoderResults) {
            result.results.add(toClientApi(geocodeResult));
        }

        return result;
    }

    private ClientApiMapGeocodeResponse.Result toClientApi(GeocodeResult geocodeResult) {
        String name = geocodeResult.getName();
        double latitude = geocodeResult.getLatitude();
        double longitude = geocodeResult.getLongitude();
        return new ClientApiMapGeocodeResponse.Result(name, latitude, longitude);
    }
}
