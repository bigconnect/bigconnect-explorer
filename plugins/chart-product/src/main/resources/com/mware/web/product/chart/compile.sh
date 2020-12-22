#! /bin/sh

export NODE_ENV=development
yarn webpack --progress --mode development

cp -r dist/ ../../../../../../../../target/classes/com/mware/web/product/chart/
cp *.less ../../../../../../../../target/classes/com/mware/web/product/chart/
cp *.js ../../../../../../../../target/classes/com/mware/web/product/chart/
