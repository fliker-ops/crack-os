#!/bin/bash
# Instala la actualizacion de seguridad en un Debian 13 (trixie) limpio con systemd dentro de Docker
# y comprueba servicios, firewall, antivirus en tiempo real y Crack Guard.
# Uso (como root, con Docker): tests/seguridad-debian.sh
set -u
cd "$(dirname "$0")/.."
IMG=crackos-prueba-systemd
docker build -q -t $IMG - <<'DOCKER'
FROM debian:trixie
RUN apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq systemd systemd-sysv dbus \
      curl ca-certificates sudo procps iproute2 iptables kmod >/dev/null && \
    useradd -m -s /bin/bash crack && mkdir -p /home/crack/Descargas /home/crack/.config && \
    cp -r /etc/skel/. /home/crack/ && chown -R crack: /home/crack
CMD ["/sbin/init"]
DOCKER
docker rm -f crackos-prueba >/dev/null 2>&1
docker run -d --name crackos-prueba --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
    -v "$PWD":/repo:ro --tmpfs /run --tmpfs /run/lock $IMG >/dev/null
sleep 6
X() { docker exec crackos-prueba bash -c "$*"; }
# barra de Crack OS para comprobar que se agrega el escudo
docker cp config/includes.chroot/etc/skel/.config/waybar crackos-prueba:/home/crack/.config/waybar
docker cp config/includes.chroot/etc/skel/.config/swaync crackos-prueba:/home/crack/.config/swaync
X "chown -R crack: /home/crack/.config"

echo "==================== INSTALADOR ===================="
X "bash /repo/seguridad/instalar.sh"; rc=$?
echo "instalador termino con codigo $rc"

echo "==================== ESPERANDO AL ANTIVIRUS ===================="
for i in $(seq 1 90); do X "test -S /run/crackos-av/clamd.sock" && break; sleep 4; done
sleep 15
X "systemctl --no-pager --plain list-units 'crackos-*' fail2ban.service ufw.service clamav-freshclam.service"

echo "==================== PRUEBA ===================="
X "SUDO_USER=crack crackguard prueba"; prc=$?

echo "==================== ESTADO ===================="
X "crackguard estado; crackguard cuarentena; crackguard registro 15"
X "ufw status verbose | head -12"
X "grep -c custom/guard /home/crack/.config/waybar/config.jsonc; su crack -c 'crackguard waybar'"
X "sysctl kernel.kptr_restrict kernel.yama.ptrace_scope fs.protected_regular net.ipv4.tcp_syncookies"
X "journalctl -u crackos-guard -u crackos-clamonacc -u crackos-clamd --no-pager | tail -40"

fail=0
for u in crackos-guard crackos-clamd crackos-clamonacc fail2ban; do
    X "systemctl is-active --quiet $u" && echo "OK    $u activo" || { echo "FALLA $u no esta activo"; fail=1; }
done
X "ufw status | grep -q 'Status: active'" && echo "OK    firewall activo" || { echo "FALLA firewall"; fail=1; }
X "grep -q custom/guard /home/crack/.config/waybar/config.jsonc" && echo "OK    escudo en la barra" || { echo "FALLA barra"; fail=1; }
[ $rc = 0 ] && echo "OK    instalador" || { echo "FALLA instalador ($rc)"; fail=1; }
[ $prc = 0 ] && echo "OK    crackguard prueba" || { echo "FALLA crackguard prueba"; fail=1; }

echo "==================== SEGUNDA VEZ (crackos-actualizar debe ser idempotente) ===================="
X "bash /repo/seguridad/instalar.sh >/dev/null" && X "systemctl is-active --quiet crackos-guard" && echo "OK    reinstalar" || { echo "FALLA reinstalar"; fail=1; }
X "grep -c custom/guard /home/crack/.config/waybar/config.jsonc"

echo "==================== CAPTURAS ===================="
X "bash /repo/tests/seguridad-capturas.sh" || echo "AVISO: las capturas fallaron"
rm -rf capturas-seguridad; docker cp crackos-prueba:/capturas capturas-seguridad 2>/dev/null || true

docker rm -f crackos-prueba >/dev/null
[ $fail = 0 ] && echo "TODO BIEN" || echo "HAY FALLAS"
exit $fail
