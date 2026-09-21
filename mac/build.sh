#!/bin/bash
# Builds Seyes.app, the Mac wrapper around the local server, and installs it
# into /Applications. The app does not contain Seyes: it finds the `seyes`
# command on disk and runs it, so `npm i -g seyes-app` has to have happened
# first and an upgrade needs no rebuild of the app.
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(node -p "require('../package.json').version")
BUILD=$(mktemp -d)
trap 'rm -rf "$BUILD"' EXIT

# The rendered icon ships with the source, so building needs nothing but the
# Xcode command line tools. Redrawing it from make_icon.py is only for changing
# the design, and that is the one step that wants Pillow.
if [ -f seyes.icns ] && [ "${REDRAW_ICON:-}" != "1" ]; then
  cp seyes.icns "$BUILD/seyes.icns"
else
  echo "  drawing the icon"
  python3 make_icon.py >/dev/null
  mkdir -p "$BUILD/seyes.iconset"
  for s in 16 32 128 256 512; do
    sips -z $s $s icon_1024.png --out "$BUILD/seyes.iconset/icon_${s}x${s}.png" >/dev/null
    sips -z $((s*2)) $((s*2)) icon_1024.png --out "$BUILD/seyes.iconset/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$BUILD/seyes.iconset" -o "$BUILD/seyes.icns"
  cp "$BUILD/seyes.icns" seyes.icns
fi

echo "  compiling"
swiftc -O -o "$BUILD/Seyes" main.swift -framework AppKit -framework WebKit

echo "  assembling the bundle"
APP="$BUILD/Seyes.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
mv "$BUILD/Seyes" "$APP/Contents/MacOS/Seyes"
mv "$BUILD/seyes.icns" "$APP/Contents/Resources/seyes.icns"
sed "s/__VERSION__/$VERSION/g" Info.plist.in > "$APP/Contents/Info.plist"
plutil -lint "$APP/Contents/Info.plist" >/dev/null
codesign --force --deep -s - "$APP" 2>/dev/null

rm -rf /Applications/Seyes.app
cp -R "$APP" /Applications/Seyes.app
echo "  installed /Applications/Seyes.app ($VERSION)"
