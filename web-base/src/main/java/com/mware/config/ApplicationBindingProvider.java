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
package com.mware.config;

import com.google.inject.Binder;
import com.google.inject.Scopes;
import com.mware.core.bootstrap.BcBootstrap;
import com.mware.core.bootstrap.BcBootstrap.StaticProvider;
import com.mware.core.bootstrap.BootstrapBindingProvider;
import com.mware.core.config.Configuration;
import com.mware.ge.cypher.connection.DefaultNetworkConnectionTracker;
import com.mware.ge.cypher.connection.NetworkConnectionTracker;
import com.mware.geocoder.DefaultGeocoderRepository;
import com.mware.geocoder.GeocoderRepository;
import com.mware.http.CachingHttpRepository;
import com.mware.http.HttpRepository;
import com.mware.ingest.database.DataConnectionRepository;
import com.mware.ingest.database.GeDataConnectionRepository;
import com.mware.search.behaviour.BehaviourRepository;
import com.mware.search.behaviour.GeBehaviourRepository;
import com.mware.security.ACLProvider;

public class ApplicationBindingProvider implements BootstrapBindingProvider {
    @Override
    public void addBindings(Binder binder, Configuration configuration) {
        binder.bind(ACLProvider.class)
                .toProvider(BcBootstrap.getConfigurableProvider(configuration, WebOptions.ACL_PROVIDER_REPOSITORY))
                .in(Scopes.SINGLETON);

        binder.bind(DataConnectionRepository.class)
                .toProvider(new StaticProvider<>(GeDataConnectionRepository.class))
                .in(Scopes.SINGLETON);
        binder.bind(HttpRepository.class)
                .toProvider(new StaticProvider<>(CachingHttpRepository.class))
                .in(Scopes.SINGLETON);
        binder.bind(BehaviourRepository.class)
                .toProvider(new StaticProvider<>(GeBehaviourRepository.class))
                .in(Scopes.SINGLETON);
        binder.bind(GeocoderRepository.class)
                .toProvider(new StaticProvider<>(DefaultGeocoderRepository.class))
                .in(Scopes.SINGLETON);
        binder.bind(NetworkConnectionTracker.class)
                .toProvider(new StaticProvider<>(DefaultNetworkConnectionTracker.class))
                .in(Scopes.SINGLETON);
    }
}
