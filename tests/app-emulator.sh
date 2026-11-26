#!/bin/bash
# Instala el APK en el emulador, abre la app conectada a la PC de prueba (10.0.2.2) y toma capturas
set -x
OUT=/tmp/app-shots; mkdir -p $OUT
R=$(cd "$(dirname "$0")/.." && pwd)
adb install -r CrackRemote.apk
adb shell pm grant os.crackos.remote android.permission.ACCESS_FINE_LOCATION
adb emu geo fix -90.5069 14.6349
adb shell settings put system screen_off_timeout 1800000
adb shell screenrecord --bit-rate 6000000 --time-limit 175 /sdcard/recorrido.mp4 &
REC=$!
adb shell am start -n os.crackos.remote/.MainActivity --es demo 10.0.2.2
sleep 3; adb exec-out screencap -p > $OUT/01-arranque.png
sleep 8; adb exec-out screencap -p > $OUT/02-login.png
PID=$(adb shell pidof os.crackos.remote | tr -d '\r')
adb forward tcp:9222 localabstract:webview_devtools_remote_$PID
(cd /tmp && npm i -s playwright-core@1 >/dev/null 2>&1)
NODE_PATH=/tmp/node_modules node "$R"/tests/app-emulator-tour.js || echo "tour fallo"
sleep 2
kill $REC 2>/dev/null; sleep 3
adb pull /sdcard/recorrido.mp4 $OUT/recorrido-emulador.mp4 || true
cp /tmp/agent.log $OUT/agente.log 2>/dev/null || true
adb logcat -d -s chromium:V > $OUT/webview.log 2>/dev/null || true
ls -la $OUT
