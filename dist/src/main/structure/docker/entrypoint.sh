#!/bin/bash

echo "Bootstrapping BigConnect Explorer...."

/opt/bdl/bin/waitforit.sh -t 0 accumulo-master:9999
/opt/bdl/bin/waitforit.sh -t 0 $RABBITMQ_HOST:$RABBITMQ_PORT
/opt/bdl/bin/waitforit.sh -t 0 $ELASTIC_NODE1:9300

/opt/bdl/sbin/start-explorer.sh

tail -f /dev/null

