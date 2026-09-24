#!/usr/bin/env bash
# GoalCreed: install JDK 17 + Android SDK (sdkmanager, platform 36, build-tools,
# NDK 27.1.12297006, cmake) into the user home — no root needed. Idempotent.
set -euo pipefail
TOOLS=/home/user/tools
SDK=$TOOLS/android-sdk
mkdir -p "$TOOLS" "$SDK"

echo "== [1/5] JDK 17 (Temurin) =="
if [ ! -d "$TOOLS/jdk-17" ]; then
  url="https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
  curl -fL --retry 3 -o "$TOOLS/jdk17.tar.gz" "$url"
  mkdir -p "$TOOLS/jdk-17-tmp"
  tar -xzf "$TOOLS/jdk17.tar.gz" -C "$TOOLS/jdk-17-tmp" --strip-components=1
  mv "$TOOLS/jdk-17-tmp" "$TOOLS/jdk-17"
  rm -f "$TOOLS/jdk17.tar.gz"
fi
export JAVA_HOME="$TOOLS/jdk-17"
export PATH="$JAVA_HOME/bin:$PATH"
java -version 2>&1 | head -1

echo "== [2/5] Android cmdline-tools =="
if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
  curl -fL --retry 3 -o "$TOOLS/cmdtools.zip" \
    https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip
  mkdir -p "$SDK/cmdline-tools"
  unzip -q -o "$TOOLS/cmdtools.zip" -d "$TOOLS/cmdtools-extract"
  rm -rf "$SDK/cmdline-tools/latest"
  mv "$TOOLS/cmdtools-extract/cmdline-tools" "$SDK/cmdline-tools/latest"
  rm -rf "$TOOLS/cmdtools.zip" "$TOOLS/cmdtools-extract"
fi

echo "== [3/5] licenses =="
yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" --licenses >/dev/null 2>&1 || true

echo "== [4/5] packages (platform 36 · build-tools · NDK) =="
"$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" \
  "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1" "platform-tools"

echo "== [5/5] project local.properties =="
echo "sdk.dir=$SDK" > /home/user/goalcreed/android/local.properties

echo "TOOLCHAIN_OK"
