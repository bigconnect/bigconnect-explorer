###################
# STAGE 1: builder
##################
FROM maven:3.6-jdk-11 as builder

## build core
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
