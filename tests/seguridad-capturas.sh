#!/bin/bash
# Se ejecuta DENTRO del contenedor Debian 13 de tests/seguridad-debian.sh, con la seguridad ya instalada.
# Abre un escritorio sin pantalla (sway headless, con la barra, avisos y terminal de Crack OS) y saca capturas
# de Crack Guard funcionando de verdad. Las capturas quedan en /capturas.
set -u
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq sway waybar sway-notification-center kitty grim dbus-user-session fonts-noto-color-emoji >/dev/null
OUT=/capturas; mkdir -p $OUT; U=/home/crack; UID_=$(id -u crack)
mkdir -p $U/.config $U/.local/share/fonts /run/user/$UID_
cp -r /repo/config/includes.chroot/etc/skel/.config/{swaync,kitty} $U/.config/
cp /repo/config/includes.chroot/usr/share/fonts/truetype/crackos/*.ttf $U/.local/share/fonts/
cp /repo/config/includes.chroot/etc/skel/.bashrc $U/.bashrc 2>/dev/null
# la barra ya trae el escudo (lo agrego el instalador); en sway se cambian los modulos propios de Hyprland
sed -i 's#"hyprland/workspaces"#"sway/workspaces"#; s#"hyprland/window"#"sway/window"#; s/"bluetooth", //; s/"tray", //' $U/.config/waybar/config.jsonc
mkdir -p $U/.config/sway
cat > $U/.config/sway/config <<SW
output HEADLESS-1 resolution 1600x900 bg /repo/config/includes.chroot/usr/share/backgrounds/crackos/crackos-wallpaper.png fill
default_border pixel 2
client.focused #ff2832 #1a0b0d #ffffff #ff2832 #ff2832
client.unfocused #3a1a1d #120809 #8c7a7c #3a1a1d #3a1a1d
gaps inner 10
gaps outer 6
for_window [app_id="crackos-float"] floating enable, resize set 1000 640, move position center
exec swaync
exec waybar
SW
chown -R crack: $U /run/user/$UID_; chmod 700 /run/user/$UID_
runuser -u crack -- fc-cache -f >/dev/null 2>&1
ENVS="XDG_RUNTIME_DIR=/run/user/$UID_ DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$UID_/bus LANG=C.UTF-8"
runuser -u crack -- env $ENVS dbus-daemon --session --address=unix:path=/run/user/$UID_/bus --fork >/dev/null
runuser -u crack -- env $ENVS WLR_BACKENDS=headless WLR_LIBINPUT_NO_DEVICES=1 WLR_RENDERER=pixman setsid sway >/tmp/sway.log 2>&1 &
sleep 8
SOCK=$(ls /run/user/$UID_/sway-ipc.*.sock | head -1)
A() { runuser -u crack -- env $ENVS WAYLAND_DISPLAY=wayland-1 SWAYSOCK=$SOCK "$@"; }
shot() { A grim "$OUT/$1.png" && echo "captura $1"; }
sleep 4; shot 01-escritorio-protegido

# 1) virus de prueba EICAR: se guarda y se intenta abrir como usuario normal
EICAR='X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
runuser -u crack -- sh -c "printf '%s' '$EICAR' > $U/Descargas/factura-pendiente.pdf.exe"
sleep 1; runuser -u crack -- cat $U/Descargas/factura-pendiente.pdf.exe >/dev/null 2>&1
sleep 5; shot 02-virus-bloqueado

# 2) proceso sospechoso: un "minero" que se ejecuta desde /tmp
cp /bin/sleep /tmp/xmrig; chmod 755 /tmp/xmrig
setpriv --reuid=crack --regid=crack --clear-groups /tmp/xmrig 600 &
sleep 6; shot 03-minero-congelado
A swaync-client -C >/dev/null 2>&1

# 3) reverse shell (comando tipico de puerta trasera)
setpriv --reuid=crack --regid=crack --clear-groups bash -c ': /dev/tcp/203.0.113.9/4444; sleep 600; true' &
sleep 6; shot 04-puerta-trasera
A swaync-client -C >/dev/null 2>&1; sleep 1

# 4) panel de Crack Guard
A swaymsg exec "kitty --class crackos-float -e crackguard panel" >/dev/null
sleep 6; shot 05-panel-crackguard
A swaymsg '[app_id="crackos-float"] kill' >/dev/null; sleep 1
A swaymsg exec "kitty --class crackos-float -e sh -c 'crackguard registro 14; crackguard cuarentena; sleep 600'" >/dev/null
sleep 6; shot 06-registro-y-cuarentena
A swaymsg '[app_id="crackos-float"] kill' >/dev/null; sleep 1
A swaymsg exec "kitty --class crackos-float -e sh -c 'crackguard congelados; echo; sudo ufw status verbose | head -9; sleep 600'" >/dev/null
sleep 6; shot 07-congelados-y-firewall
pkill -9 -f '/tmp/xmrig 600'; pkill -9 -f '203.0.113.9'
ls -la $OUT
