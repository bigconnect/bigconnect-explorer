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
package com.mware.formula;

import com.mware.core.config.Configuration;
import com.mware.core.config.ConfigurationLoader;
import com.mware.core.config.HashMapConfigurationLoader;
import com.mware.core.model.schema.SchemaConstants;
import com.mware.core.model.schema.SchemaRepository;
import com.mware.ge.*;
import com.mware.ge.inmemory.InMemoryGraph;
import org.apache.commons.io.IOUtils;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.runners.MockitoJUnitRunner;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicInteger;

import static com.mware.ge.values.storable.Values.intValue;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

@RunWith(MockitoJUnitRunner.class)
public class FormulaEvaluatorTest {
    private FormulaEvaluator evaluator;
    private FormulaEvaluator.UserContext userContext;
    private Graph graph;
    private Authorizations authorizations;

    @Mock
    private SchemaRepository schemaRepository;

    @Before
    public void before() throws Exception {
        graph = InMemoryGraph.create();
        authorizations = graph.createAuthorizations();

        Map<String, String> map = new HashMap<>();
        ConfigurationLoader configurationLoader = new HashMapConfigurationLoader(map);
        Configuration configuration = configurationLoader.createConfiguration();

        Locale locale = Locale.getDefault();
        String timeZone = "America/New_York";
        userContext = new FormulaEvaluator.UserContext(locale, null, timeZone, null);

        final String ontologyJson = IOUtils.toString(FormulaEvaluatorTest.class.getResourceAsStream("ontology.json"), StandardCharsets.UTF_8);
        final String configurationJson = IOUtils.toString(FormulaEvaluatorTest.class.getResourceAsStream("configuration.json"), StandardCharsets.UTF_8);
        final String vertexJson = IOUtils.toString(FormulaEvaluatorTest.class.getResourceAsStream("vertex.json"), StandardCharsets.UTF_8);

        evaluator = new FormulaEvaluator(configuration, schemaRepository) {
            @Override
            protected String getOntologyJson(String workspaceId) {
                return ontologyJson;
            }

            @Override
            protected String getConfigurationJson(Locale locale, String workspaceId) {
                return configurationJson;
            }

            @Override
            protected String toJson(GeObject geObject, String workspaceId, Authorizations authorizations) {
                if (geObject != null) {
                    return super.toJson(geObject, workspaceId, authorizations);
                }
                return vertexJson;
            }
        };
    }

    @After
    public void teardown() {
        evaluator.close();
    }

    @Test
    public void testEvaluatorJson() throws Exception {
        assertTrue(evaluator.getOntologyJson(null).length() > 0);
        assertTrue(evaluator.getConfigurationJson(Locale.getDefault(), null).length() > 0);
    }

    @Test
    public void testEvaluateTitleFormula() {
        assertEquals("Prop A Value, Prop B Value", evaluator.evaluateTitleFormula(null, userContext, authorizations));
    }

    @Test
    public void testEvaluateSubtitleFormula() {
        assertEquals("Prop C Value", evaluator.evaluateSubtitleFormula(null, userContext, authorizations));
    }

    @Test
    public void testEvaluateTimeFormula() {
        assertEquals("2014-11-20", evaluator.evaluateTimeFormula(null, userContext, authorizations));
    }

    @Test
    public void testDuration() {
        String propertyKey = "pkey";
        String propertyName = "dev#duration";

        Element element = graph.prepareVertex("v1", new Visibility(""), SchemaConstants.CONCEPT_TYPE_THING)
                .addPropertyValue(propertyKey, propertyName, intValue(1234), new Visibility(""))
                .save(authorizations);
        graph.flush();

        assertEquals("20m 34s", evaluator.evaluatePropertyDisplayFormula(element, propertyKey, propertyName, userContext, authorizations));
    }

    @Test
    public void testThreading() throws InterruptedException {
        Thread[] threads = new Thread[4];
        final AtomicInteger threadsReadyCount = new AtomicInteger();
        final Semaphore block = new Semaphore(threads.length);
        block.acquire(threads.length);

        // prime the main thread for evaluation
        assertEquals("Prop A Value, Prop B Value", evaluator.evaluateTitleFormula(null, userContext, authorizations));

        for (int i = 0; i < threads.length; i++) {
            threads[i] = new Thread(() -> {
                try {
                    // prime this thread for evaluation
                    evaluator.evaluateTitleFormula(null, userContext, null);
                    threadsReadyCount.incrementAndGet();
                    block.acquire(); // wait to run the look
                    for (int i1 = 0; i1 < 20; i1++) {
                        System.out.println(Thread.currentThread().getName() + " - " + i1);
                        assertEquals("Prop A Value, Prop B Value", evaluator.evaluateTitleFormula(null, userContext, authorizations));
                    }
                } catch (Exception ex) {
                    throw new RuntimeException("Could not run", ex);
                }
            });
            threads[i].setName(FormulaEvaluatorTest.class.getSimpleName() + "-testThreading-" + i);
        }

        for (Thread thread : threads) {
            thread.start();
        }

        // wait for all threads to be primed
        while (threadsReadyCount.get() < threads.length) {
            Thread.sleep(100);
        }
        block.release(threads.length);

        // wait for threads to finish
        for (Thread thread : threads) {
            synchronized (thread) {
                thread.join();
            }
        }

        // make sure the main threads evaluator isn't broken.
        assertEquals("Prop A Value, Prop B Value", evaluator.evaluateTitleFormula(null, userContext, authorizations));
        evaluator.close();
    }
}
