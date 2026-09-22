#!/bin/bash
# Builds the downloadable Seyes: a self-contained Seyes.app (its own Node, a
# pre-built server, the native window) in a .dmg, ready to hand to people
# who have never heard of npm. Output lands in dist/.
#
#   mac/release.sh
#
# Unlike mac/build.sh, which wraps an npm-installed Seyes for development,
# nothing here depends on what is installed on the machine that runs it.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
NODE_VERSION=v22.22.2
CACHE="$HOME/Library/Caches/seyes-build/node-$NODE_VERSION"
DIST=dist
APP="$DIST/Seyes.app"
say() { printf '  %s\n' "$1"; }

say "Seyes $VERSION"

# 1. Node, the official builds for both kinds of Mac, checked against the
#    checksums nodejs.org publishes, then merged into one binary.
if [ ! -x "$CACHE/node-universal" ]; then
  say "fetching Node $NODE_VERSION"
  mkdir -p "$CACHE"
  ( cd "$CACHE"
    curl -fsSLO "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt"
    for arch in arm64 x64; do
      file="node-$NODE_VERSION-darwin-$arch.tar.gz"
      [ -f "$file" ] || curl -fsSLO "https://nodejs.org/dist/$NODE_VERSION/$file"
      grep " $file\$" SHASUMS256.txt | shasum -a 256 -c - >/dev/null
      tar -xzf "$file" "node-$NODE_VERSION-darwin-$arch/bin/node"
    done
    lipo -create "node-$NODE_VERSION-darwin-arm64/bin/node" "node-$NODE_VERSION-darwin-x64/bin/node" -output node-universal
  )
fi

# 2. The server, built once here instead of on the user's first launch.
say "building the server"
rm -rf .next
SEYES_STANDALONE=1 NEXT_TELEMETRY_DISABLED=1 npx next build >/dev/null

# 3. The window, compiled for Apple Silicon and Intel.
say "compiling the window"
BUILD=$(mktemp -d)
trap 'rm -rf "$BUILD"' EXIT
for target in arm64-apple-macos13.0 x86_64-apple-macos13.0; do
  swiftc -O -target "$target" -o "$BUILD/Seyes-$target" mac/main.swift -framework AppKit -framework WebKit 2>/dev/null
done
lipo -create "$BUILD"/Seyes-* -output "$BUILD/Seyes"

# 4. The bundle. Only what the server runs is copied: standalone output also
#    sweeps in source files it can't rule out, which the app never reads.
say "assembling Seyes.app"
rm -rf "$DIST" && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/server/.next"
cp "$BUILD/Seyes" "$APP/Contents/MacOS/Seyes"
cp "$CACHE/node-universal" "$APP/Contents/Resources/node"
cp mac/seyes.icns "$APP/Contents/Resources/seyes.icns"
sed "s/__VERSION__/$VERSION/g" mac/Info.plist.in > "$APP/Contents/Info.plist"
plutil -lint "$APP/Contents/Info.plist" >/dev/null
SERVER="$APP/Contents/Resources/server"
cp .next/standalone/server.js .next/standalone/package.json "$SERVER/"
cp -R .next/standalone/node_modules "$SERVER/node_modules"
rsync -a --exclude cache .next/standalone/.next/ "$SERVER/.next/"
cp -R .next/static "$SERVER/.next/static"

# 5. Signing. Ad hoc for now (no Apple Developer ID yet): every binary inside
#    first, then the app around them. Apple Silicon refuses to run unsigned
#    code at all, so even without an identity this step is required.
say "signing (ad hoc)"
find "$APP/Contents/Resources" -type f -perm +111 -exec sh -c 'file -b "$1" | grep -q Mach-O && codesign --force -s - "$1"' _ {} \;
codesign --force -s - "$APP"
codesign --verify --deep --strict "$APP"

# 6. The disk image: the app and a shortcut to Applications to drag it onto.
say "making the disk image"
STAGE="$BUILD/dmg"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
DMG="$DIST/Seyes-$VERSION.dmg"
hdiutil create -volname "Seyes" -srcfolder "$STAGE" -ov -format ULMO "$DMG" >/dev/null
# A copy with a fixed name, so one link always serves the newest release:
# github.com/oscomarch/seyes/releases/latest/download/Seyes.dmg
cp "$DMG" "$DIST/Seyes.dmg"

say "done"
say "$(du -sh "$APP" | cut -f1)  $APP"
say "$(du -sh "$DMG" | cut -f1)  $DMG"
say "sha256 $(shasum -a 256 "$DMG" | cut -d' ' -f1)"
