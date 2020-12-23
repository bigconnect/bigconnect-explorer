#!/usr/bin/env bash

BINDIR=$(cd "$(dirname "$0")" && pwd -P)

JAVA_CMD=$(type -p java)
if [ -z $JAVA_CMD ]; then
  if [[ -n "$JAVA_HOME" ]] && [[ -x "$JAVA_HOME/bin/java" ]]; then
    JAVA_CMD="$JAVA_HOME/bin/java"
  else
    echo "no java found"
    exit 1
  fi
else
  JAVA_CMD=java
fi


echo "Starting BigConnect Explorer"
echo "------------------------"
BIGCONNECT_DIR=$(readlink -m "$BINDIR/..")
BC_BACKEND_PORT="8888"

BC_JAVA_OPTS="-Xms4g -Xmx4g -server --add-opens java.base/java.lang=ALL-UNNAMED"
BC_JAVA_OPTS="$BC_JAVA_OPTS -XX:+UseG1GC -XX:+DisableExplicitGC -XX:-OmitStackTraceInFastThrow"
BC_JAVA_OPTS="$BC_JAVA_OPTS -Dfile.encoding=utf8 -Djava.net.preferIPv4Stack=true"
BC_JAVA_OPTS="$BC_JAVA_OPTS -Djava.awt.headless=true -Djava.security.egd=file:/dev/./urandom -Djava.io.tmpdir=/tmp"

export BIGCONNECT_DIR
pushd $BIGCONNECT_DIR

"$JAVA_CMD" \
  $BC_JAVA_OPTS \
  -cp "$BIGCONNECT_DIR/lib/*" \
  -XX:OnOutOfMemoryError="kill -9 %p" \
  com.mware.web.TomcatWebServer \
  --webAppDir $BIGCONNECT_DIR/webapp \
  --port $BC_BACKEND_PORT
