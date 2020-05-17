#!/bin/bash

browserify js_source/main.js --s HillNav -o ./js/app.js

cp -r js build/
cp index.html build/
cp cache.manifest build/
cp touch-icon-iphone.png build/
cp -r css build/

TIMESTAMP=`date +%s`

sed -i '.bak' "s/\?123456/\?$TIMESTAMP/g" build/index.html
sed -i '.bak' "s/\?123456/\?$TIMESTAMP/g" build/cache.manifest
