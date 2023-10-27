#!/usr/bin/env bash

SBINDIR=$(cd "$(dirname "$0")" && pwd -P)
BINDIR="$SBINDIR/../bin"

. "$BINDIR/_env.inc.sh"

echo "Starting BigConnect Explorer"

export BIGCONNECT_DIR=$EXPLORER_DIR

BC_JAVA_OPTS="-Xms4g -Xmx4g -server --add-opens java.base/java.lang=com.google.guice,javassist"
BC_JAVA_OPTS="$BC_JAVA_OPTS -XX:+UseG1GC -XX:-OmitStackTraceInFastThrow -XX:+AlwaysPreTouch -XX:+UnlockExperimentalVMOptions"
BC_JAVA_OPTS="$BC_JAVA_OPTS -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5006 -XX:+TrustFinalNonStaticFields -XX:+DisableExplicitGC"
BC_JAVA_OPTS="$BC_JAVA_OPTS -Dfile.encoding=UTF-8 -Dfile.encoding=utf8 -Djava.net.preferIPv4Stack=true"
BC_JAVA_OPTS="$BC_JAVA_OPTS -Djava.awt.headless=true -Djava.security.egd=file:/dev/./urandom -Djava.io.tmpdir=$EXPLORER_DATA_DIR/tmp"

"$JAVA_HOME/bin/java" \
  $BC_JAVA_OPTS \
  -cp "$EXPLORER_DIR/lib/*" \
  -Dcatalina.base="$EXPLORER_DATA_DIR" -Dcatalina.home="$EXPLORER_DATA_DIR" \
  -XX:OnOutOfMemoryError="kill -9 %p" \
  com.mware.web.TomcatWebServer \
  --webAppDir "$EXPLORER_DIR/webapp" \
  --port 8888
