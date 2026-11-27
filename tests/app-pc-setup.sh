#!/bin/bash
# Prepara una "PC" de prueba (escritorio sway sin pantalla + agente Crack OS Remote) para probar la app
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq sway swaybg grim wtype foot mousepad thunar wl-clipboard libnotify-bin sway-notification-center \
  papirus-icon-theme python3-pil dbus-x11 dosfstools exfatprogs e2fsprogs ntfs-3g >/dev/null
id onofre >/dev/null 2>&1 || useradd -m -s /bin/bash -c Onofre -G sudo onofre
id invitado >/dev/null 2>&1 || useradd -m -s /bin/bash -c Invitado invitado
echo onofre:crack123 | chpasswd; echo invitado:invitado | chpasswd
U=$(id -u onofre); mkdir -p /run/user/$U; chown onofre: /run/user/$U; chmod 700 /run/user/$U
mkdir -p /usr/share/crackos /usr/share/backgrounds/crackos
cp "$R"/config/includes.chroot/usr/share/crackos/face.png /usr/share/crackos/
cp "$R"/config/includes.chroot/usr/share/backgrounds/crackos/*.png /usr/share/backgrounds/crackos/
install -m755 "$R"/config/includes.chroot/usr/local/bin/crackos-wallpaper /usr/local/bin/
for d in Descargas Documentos Imágenes Escritorio; do mkdir -p /home/onofre/$d; done
echo "Notas de Crack OS" > /home/onofre/Documentos/notas.txt
mkdir -p /home/onofre/.config/sway
cat > /home/onofre/.config/sway/config <<'CFG'
output HEADLESS-1 resolution 1920x1080
default_border pixel 2
client.focused #ff2832 #0a0a0a #ffffff #ff2832 #ff2832
gaps inner 12
exec /usr/local/bin/crackos-wallpaper /usr/share/backgrounds/crackos/crackos-wallpaper.png
exec swaync
CFG
chown -R onofre: /home/onofre
cat > /usr/local/bin/start-test-sway <<CFG
#!/bin/bash
export XDG_RUNTIME_DIR=/run/user/$U WLR_BACKENDS=headless WLR_RENDERER=pixman WLR_LIBINPUT_NO_DEVICES=1 HOME=/home/onofre USER=onofre
export DBUS_SESSION_BUS_ADDRESS=unix:path=\$XDG_RUNTIME_DIR/bus
dbus-daemon --session --address=\$DBUS_SESSION_BUS_ADDRESS --fork
exec sway > /tmp/sway.log 2>&1
CFG
chmod +x /usr/local/bin/start-test-sway
su onofre -c "setsid /usr/local/bin/start-test-sway >/dev/null 2>&1 &"
sleep 4
CRACKOS_REMOTE_STATE=/tmp/crk-state setsid python3 "$R"/config/includes.chroot/usr/lib/crackos/remote/crackos-remote.py > /tmp/agent.log 2>&1 &
sleep 2
curl -sf localhost:4747/api/users
