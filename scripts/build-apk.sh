#!/usr/bin/env bash
# GoalCreed — build a signed, installable release APK locally (Linux CI / cloud IDE).
# Prereqs handled by scripts/setup-android-toolchain.sh (JDK17 + Android SDK 36 + NDK 27.1).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
TOOLS=${TOOLS:-/home/user/tools}
SDK=${ANDROID_HOME:-$TOOLS/android-sdk}
export JAVA_HOME=${JAVA_HOME:-$TOOLS/jdk-17}
export ANDROID_HOME="$SDK"
export PATH="$JAVA_HOME/bin:$SDK/platform-tools:$SDK/cmdline-tools/latest/bin:$PATH"

echo "==> expo prebuild (android)"
CI=1 npx expo prebuild -p android
echo "sdk.dir=$SDK" > android/local.properties

KEYSTORE=${KEYSTORE:-$TOOLS/goalcreed-release.keystore}
KS_PASS=${KS_PASS:-goalcreed}
if [ ! -f "$KEYSTORE" ]; then
  echo "==> generating release keystore at $KEYSTORE"
  keytool -genkeypair -v -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -alias goalcreed -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=GoalCreed, OU=Apps, O=GoalCreed, L=Dubai, C=AE"
fi

echo "==> inject release signing into generated project (local only; android/ is gitignored)"
python3 - "$KEYSTORE" "$KS_PASS" <<'PYEOF'
import sys, re
store, pw = sys.argv[1], sys.argv[2]
p = 'android/app/build.gradle'
s = open(p).read()
block = f"""    signingConfigs {{
        debug {{
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }}
        release {{
            storeFile file('{store}')
            storePassword '{pw}'
            keyAlias 'goalcreed'
            keyPassword '{pw}'
        }}
    }}"""
s = re.sub(r"    signingConfigs \{\n        debug \{[^}]*\}\n    \}", block, s, count=1)
s = s.replace("""            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug""",
"""            signingConfig signingConfigs.release""")
open(p, 'w').write(s)
print("signing injected:", "release" in s)
PYEOF

echo "==> gradle assembleRelease (arm64, hermes, minify)"
cd android
./gradlew :app:assembleRelease \
  --no-daemon -Dorg.gradle.parallel=false -Dorg.gradle.workers.max=2 \
  -Dorg.gradle.jvmargs="-Xmx1400m -XX:MaxMetaspaceSize=700m -Dfile.encoding=UTF-8" \
  -Dkotlin.compiler.execution.strategy=in-process \
  -PreactNativeArchitectures=arm64-v8a \
  --console=plain "$@"

APK=$(find app/build/outputs/apk/release -name "*.apk" | head -1)
echo "APK_BUILT: $APK"
