FROM ubuntu:jammy-20230916

RUN apt -qq update && \
	apt -qq install -y \
		dumb-init \
		telnet \
		iputils-ping \
		openjdk-11-jdk-headless \
		curl sudo net-tools \
	&& rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME /usr/lib/jvm/java-11-openjdk-amd64

RUN mkdir -p /opt/bdl/etc/hadoop

COPY ./bin /opt/bdl/bin
COPY ./lib /opt/bdl/lib
COPY ./sbin /opt/bdl/sbin

VOLUME /opt/bdl/data

EXPOSE 8888

COPY docker/entrypoint.sh /opt/entrypoint.sh

RUN chmod a+x /opt/entrypoint.sh

ENTRYPOINT ["/opt/entrypoint.sh"]
