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
package com.mware.http;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.mware.core.config.Configuration;
import com.mware.core.config.FileConfigurationLoader;
import com.mware.core.exception.BcException;
import com.mware.core.util.BcLogger;
import com.mware.core.util.BcLoggerFactory;
import org.apache.commons.codec.digest.DigestUtils;
import org.apache.commons.io.FileUtils;

import java.io.File;
import java.io.IOException;
import java.util.List;

@Singleton
public class CachingHttpRepository extends HttpRepository {
    private static final BcLogger LOGGER = BcLoggerFactory.getLogger(CachingHttpRepository.class);
    public static final String CONFIG_CACHE_DIR = "cachingHttp.cacheDir";
    private static final String INDEX_FILE_NAME = "index";
    private File cacheDir;

    @Inject
    public CachingHttpRepository(Configuration configuration) {
        super(configuration);
        String cacheDirString = configuration.get(CONFIG_CACHE_DIR, getDefaultHttpCacheDir());
        cacheDir = new File(cacheDirString);
        if (!cacheDir.exists()) {
            if (!cacheDir.mkdirs()) {
                throw new BcException("Could not make directory: " + cacheDir.getAbsolutePath());
            }
        }
        LOGGER.info("Using cache dir: %s", cacheDir.getAbsolutePath());
    }

    private String getDefaultHttpCacheDir() {
        File bcDir = new File(FileConfigurationLoader.getDefaultBcDir());
        return new File(bcDir, "httpCache").getAbsolutePath();
    }

    @Override
    public byte[] get(final String url) {
        String cacheMd5 = DigestUtils.md5Hex(url);
        return withCache(url, cacheMd5, new WithCache() {
            @Override
            public byte[] doIt() {
                return CachingHttpRepository.super.get(url);
            }
        });
    }

    @Override
    public byte[] post(final String url, final List<Parameter> formParameters) {
        String cacheMd5 = DigestUtils.md5Hex(url + createQueryString(formParameters));
        return withCache(url, cacheMd5, new WithCache() {
            @Override
            public byte[] doIt() {
                return CachingHttpRepository.super.post(url, formParameters);
            }
        });
    }

    private byte[] withCache(String url, String cacheMd5, WithCache withCache) {
        File indexFile = new File(cacheDir, INDEX_FILE_NAME);
        File cachedFile = new File(cacheDir, cacheMd5);
        try {
            if (cachedFile.exists()) {
                LOGGER.debug("cache hit: %s: %s", url, cachedFile.getAbsolutePath());
                return FileUtils.readFileToByteArray(cachedFile);
            }
            LOGGER.debug("cache miss: %s: %s", url, cachedFile.getAbsolutePath());
            byte[] data = withCache.doIt();
            FileUtils.writeByteArrayToFile(cachedFile, data);
            FileUtils.writeStringToFile(indexFile, cacheMd5 + " " + url + "\n", true);
            return data;
        } catch (IOException e) {
            throw new BcException("Could not read cache file: " + cachedFile.getAbsolutePath(), e);
        }
    }

    private interface WithCache {
        byte[] doIt();
    }
}
