#! /bin/sh

export NODE_ENV=development
./node_modules/.bin/webpack --progress
cp -r dist/ ../../../../../../../../target/classes/com/mware/web/product/graph/
