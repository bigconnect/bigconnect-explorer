#!/bin/bash

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
LAST_RELEASE=$(cat $SCRIPT_DIR/last.release)
CURRENT_RELEASE=${LAST_RELEASE%.*}.$((${LAST_RELEASE##*.}+1))

echo "##############################################"
echo "Previous release: $LAST_RELEASE"
echo "Current release: $CURRENT_RELEASE"
echo "##############################################"

mvn -o clean package || exit
cd target/explorer-4.2.2-SNAPSHOT/explorer-4.2.2-SNAPSHOT || exit
docker build -t registry.escor.local/explorer:$CURRENT_RELEASE -f Dockerfile .
docker push registry.escor.local/explorer:$CURRENT_RELEASE

echo "##############################################"
echo "Marking release $CURRENT_RELEASE as successful"
echo "##############################################"
#echo $CURRENT_RELEASE > $SCRIPT_DIR/last.release
