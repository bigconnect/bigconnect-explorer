###################
# STAGE 1: builder
##################
FROM maven:3.6-jdk-11 as builder

# build core
WORKDIR /core
RUN git clone https://github.com/bigconnect/bigconnect.git \
    && cd bigconnect \
    && mvn -DskipTests install

WORKDIR /dw
RUN git clone https://github.com/bigconnect/dataworker-plugins.git \
    && cd dataworker-plugins \
    && mvn -DskipTests install

WORKDIR /explorer
COPY . .
RUN mvn -Pbin-release -Pproduction -DskipTests install

###################
# STAGE 2: runner
##################
FROM adoptopenjdk/openjdk11:alpine-jre as runner

ENV BIGCONNECT_DIR=/bc
ENV JAVA_OPTS="-Xms4g -Xmx4g -server -XX:+UseG1GC -Dfile.encoding=utf8 -Djava.awt.headless=true"
RUN mkdir -p ${BIGCONNECT_DIR}/datastore

COPY --from=builder /dist/release/target/explorer/explorer ${BIGCONNECT_DIR}

VOLUME /bc/datastore

WORKDIR /bc

EXPOSE 10242/tcp
EXPOSE 8888/tcp

CMD java ${JAVA_OPTS} -cp "./lib/*" com.mware.web.TomcatWebServer --webAppDir $BIGCONNECT_DIR/webapp --port 8888
