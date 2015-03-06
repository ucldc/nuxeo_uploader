#!/bin/sh

set -ie

for mac in MacOS64 MacOS32; do
  if [[ ! -d "dist/$mac" ]]; then
    continue
  fi
  if [[ -f "dist/$mac/$1.tmp.dmg" ]]; then
    rm "dist/$mac/$1.tmp.dmg"
  fi
  if [[ -f "dist/$mac/$1.dmg" ]]; then
    rm "dist/$mac/$1.dmg"
  fi
  hdiutil create -srcfolder "dist/$mac/$1.app" -volname "$1" -fs HFS+ -fsargs "-c c=64,a=16,e=16" -format UDRW "dist/$mac/$1.tmp.dmg"
  hdiutil attach -readwrite -noverify -noautoopen "dist/$mac/$1.tmp.dmg"
  mkdir "/Volumes/$1/.background"
  cp resources/mac/background.png "/Volumes/$1/.background"
  chmod u+r "/Volumes/$1/.Trashes/"
  chmod -Rf go-w "/Volumes/$1"
  ln -sfn /Applications/ "/Volumes/$1/Applications"
  export APP_NAME="$1"
  osascript resources/mac/dmgStyler.applescript
  hdiutil detach "/Volumes/$1"
  hdiutil convert "dist/$mac/$1.tmp.dmg" -format UDZO -imagekey zlib-level=9 -o "dist/$mac/$1.dmg" -puppetstrings
  rm "dist/$mac/$1.tmp.dmg"
done
