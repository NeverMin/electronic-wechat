#!/bin/bash

if ! hash electron-packager 2>/dev/null; then
  RED='\033[0;31m'
  NC='\033[0m'
  echo "${RED}Error${NC}: you need to npm install electron-packager. Aborting."
  exit 1
fi

if [ "$#" -ne 2 ]; then
  echo -e "Usage: ./script/build.sh <platform> <arch>"
  echo -e "	platform:	darwin, linux, win32"
  echo -e "	arch:		ia32, x64"
  exit 1
fi

PLATFORM=$1
ARCH=$2
electronVersion=$(cat package.json | grep "\"electron\"" | awk -F '"' '{print $4}')
echo "Electron Version: " $electronVersion

echo "Start packaging for $PLATFORM $ARCH."

if [ $PLATFORM = "linux" ]; then
    APP_NAME="electronic-wechat"
else
    APP_NAME="Electronic WeChat"
fi

ignore_list="build|scripts|\.idea|.*\.md|.*\.yml"

electron-packager . "${APP_NAME}" --platform=$PLATFORM --arch=$ARCH \
  --electronVersion=$electronVersion \
  --app-version=1.4.0 \
  --overwrite \
  --icon=assets/icon.icns --out=./build --ignore=${ignore_list}

if [ $? -eq 0 ]; then
  echo -e "$(tput setaf 2)Packaging for $PLATFORM $ARCH succeeded.$(tput sgr0)\n"
fi

if [ $PLATFORM = "darwin" ]; then
    ditto -rsrcFork ./dist/Electronic\ WeChat-darwin-x64/Electronic\ WeChat.app /Applications/Electronic\ WeChat.app
    echo "$(tput setaf 3)App copied to /Applications. You can open Electronic WeChat there or from Spotlight.$(tput sgr0)"
fi
