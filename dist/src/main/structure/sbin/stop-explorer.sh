#!/usr/bin/env bash

SBINDIR=$(cd "$(dirname "$0")" && pwd -P)
BINDIR="$SBINDIR/../bin"

. "$BINDIR/_env.inc.sh"

echo -n "Stopping BDL Explorer... "
BC_PID=$("$JAVA_HOME/bin/jps" -lm | grep "com.mware.web.TomcatWebServer" | grep -E -o '^[0-9]*')

if [ -z "$BC_PID" ]; then
	echo "no BigConnect Explorer to stop (could not find BigConnect Explorer process)"
else
	echo "Stopping BigConnect Explorer with PID $BC_PID"
	kill -15 "$BC_PID"
fi

echo "BDL Explorer stopped"
