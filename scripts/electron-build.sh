#!/usr/bin/env bash
BASEDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../" && pwd )"
VERSION=${1-"$(date +"%y%m%d")"}

cd $BASEDIR

# Generate package.json

cat $BASEDIR/electron/package.json | sed s/dist.main.js/main.js/ > $BASEDIR/dist/package.json
cp $BASEDIR/electron/dist/main.prod.js $BASEDIR/dist/main.js
cp -r $BASEDIR/electron/dist/src $BASEDIR/dist/
cp -r $BASEDIR/electron/node_modules $BASEDIR/dist/

$BASEDIR/node_modules/.bin/electron-packager $BASEDIR/dist "rabix-composer" --overwrite --out build --icon $BASEDIR/electron/rabix-icon.icns --build-version $VERSION
