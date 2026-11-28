#!/bin/bash
# Crack OS - actualizacion de seguridad (sin reinstalar el sistema)
#
#   curl -fsSL https://raw.githubusercontent.com/fliker-ops/crack-os/main/seguridad/instalar.sh | sudo bash
#
# Despues, para futuras actualizaciones basta con:   sudo crackos-actualizar
#
# Instala: Crack Guard (detector de procesos sospechosos), antivirus ClamAV con bloqueo en tiempo real,
# firewall UFW, AppArmor, Fail2ban, endurecimiento del kernel y actualizaciones de seguridad automaticas.
set -uo pipefail
REPO="fliker-ops/crack-os"
REF="${CRACKOS_REF:-main}"
R=$'\e[38;2;255;40;50m'; W=$'\e[38;2;241;233;234m'; G=$'\e[38;2;150;140;142m'; B=$'\e[1m'; N=$'\e[0m'
LOGF=/var/log/crackos-actualizar.log

paso() { echo; echo "${R}${B}::${N} ${W}${B}$*${N}"; }
ok()   { echo "   ${W}✓${N} ${G}$*${N}"; }
mal()  { echo "   ${R}✗ $*${N}"; }

main() {
if [ "$(id -u)" != 0 ]; then
    if [ -f "$0" ]; then exec sudo bash "$0" "$@"; fi
    echo "Ejecuta con sudo:  curl -fsSL https://raw.githubusercontent.com/$REPO/main/seguridad/instalar.sh | sudo bash"
    exit 1
fi
exec > >(tee -a "$LOGF") 2>&1
echo "${R}${B}"
cat <<'EOF'
    ▄▄▄▄▄▄▄▄▄▄▄
   █  ▄▄▄ ▄▄▄  █     C R A C K   O S
   █  ███ ███  █     actualizacion de seguridad
    ▀▄▄ ▀▄▀ ▄▄▀
      █▀█▀█▀█
EOF
echo "${N}${G}   $(date '+%Y-%m-%d %H:%M')  ·  versión: $REF${N}"

LIVE=no; SAFE=no
grep -qw 'boot=live' /proc/cmdline && LIVE=si
grep -qw 'crack.safe=1' /proc/cmdline && SAFE=si
[ "$LIVE" = si ] && echo "${R}   Aviso: estás en el modo Live; todo esto se borra al apagar. Instala Crack OS para que se quede.${N}"
[ "$SAFE" = si ] && echo "${R}   Aviso: estás en Modo Seguro; los cambios se pierden al reiniciar. Arranca en modo normal para instalarlo.${N}"

# ------------------------------------------------------------------ archivos
paso "Descargando los archivos de seguridad"
SRC=""
HERE=""
[ -f "${BASH_SOURCE[0]:-}" ] && HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -n "$HERE" ] && [ -d "$HERE/raiz/usr/lib/crackos/seguridad" ] && [ -z "${CRACKOS_REF:-}" ]; then
    SRC="$HERE/raiz"; ok "usando la copia local ($HERE)"
else
    TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
    for i in 1 2 3; do
        curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$REF" -o "$TMP/c.tgz" && break
        sleep $((i * 3))
    done
    if ! tar xzf "$TMP/c.tgz" -C "$TMP" 2>/dev/null; then
        mal "no se pudo descargar (¿hay internet?)"; exit 1
    fi
    SRC=$(echo "$TMP"/*/seguridad/raiz)
    [ -d "$SRC" ] || { mal "el paquete descargado no trae seguridad/"; exit 1; }
    ok "descargado de github.com/$REPO ($REF)"
fi

paso "Instalando programas (antivirus, firewall, AppArmor, fail2ban)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq || mal "apt update dio errores (se sigue con lo que haya)"
PKGS="python3 libnotify-bin ufw apparmor apparmor-utils apparmor-profiles apparmor-profiles-extra
      fail2ban python3-systemd clamav clamav-daemon clamav-freshclam clamdscan unattended-upgrades apt-listchanges"
if apt-get install -y -qq -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold $PKGS >/dev/null; then
    ok "paquetes instalados"
else
    mal "algunos paquetes fallaron; reintentando uno por uno"
    for p in $PKGS; do apt-get install -y -qq "$p" >/dev/null 2>&1 && ok "$p" || mal "$p"; done
fi

paso "Copiando la configuración de Crack OS"
# conservar lo que el usuario ya ajusto
for f in /etc/crackos/guard.conf /etc/crackos/guard-permitidos.list; do [ -f "$f" ] && cp -p "$f" "$f.conservar"; done
cp -r --no-preserve=ownership "$SRC"/. /
for f in /etc/crackos/guard.conf /etc/crackos/guard-permitidos.list; do [ -f "$f.conservar" ] && mv -f "$f.conservar" "$f"; done
chmod 755 /usr/local/bin/crackguard /usr/local/bin/crackos-actualizar /usr/lib/crackos/seguridad/*
chmod 644 /etc/systemd/system/crackos-*.service /etc/systemd/system/crackos-*.timer
chown clamav:clamav /var/lib/clamav/crackos.hdb 2>/dev/null || true
mkdir -p /var/lib/crackos/cuarentena /var/lib/crackos/guard /var/cache/crackos-av
chmod 700 /var/lib/crackos/cuarentena
chown clamav:clamav /var/cache/crackos-av 2>/dev/null || true
gtk-update-icon-cache -f -q /usr/share/icons/hicolor 2>/dev/null || true
ok "archivos en su lugar"

# ------------------------------------------------------------------ kernel
paso "Endureciendo el kernel"
sysctl -q --system >/dev/null 2>&1 && ok "parámetros de seguridad del kernel aplicados" || mal "sysctl"
ok "módulos peligrosos o en desuso bloqueados (FireWire, protocolos raros)"
if [ "$LIVE" = no ] && command -v update-grub >/dev/null; then
    update-grub >/dev/null 2>&1 && ok "opciones de arranque seguras (se activan al reiniciar)" || mal "update-grub"
fi

# ------------------------------------------------------------------ firewall
paso "Firewall (UFW)"
if command -v ufw >/dev/null; then
    ufw --force default deny incoming >/dev/null
    ufw --force default allow outgoing >/dev/null
    ufw logging low >/dev/null
    if [ -e /usr/lib/crackos/remote/crackos-remote.py ]; then
        for net in 192.168.0.0/16 10.0.0.0/8 172.16.0.0/12; do
            ufw allow from "$net" to any port 4747 comment 'Crack Remote (solo red local)' >/dev/null
        done
        ok "Crack Remote permitido solo desde tu red local (puerto 4747)"
    fi
    ufw --force enable >/dev/null && ok "activo: se bloquea todo lo que entra sin permiso" || mal "no se pudo activar UFW"
    systemctl enable -q ufw 2>/dev/null
fi

# ------------------------------------------------------------------ apparmor / fail2ban / updates
paso "AppArmor, Fail2ban y actualizaciones automáticas"
systemctl enable -q --now apparmor 2>/dev/null
if [ "$(cat /sys/module/apparmor/parameters/enabled 2>/dev/null)" = Y ]; then
    n=$(aa-status --enforced 2>/dev/null || echo "?")
    ok "AppArmor activo ($n perfiles vigilando programas)"
else
    mal "AppArmor no está activo en el kernel (se activa al reiniciar)"
fi
systemctl enable -q fail2ban 2>/dev/null; systemctl restart fail2ban 2>/dev/null \
    && ok "Fail2ban activo (bloquea ataques de contraseña por fuerza bruta)" || mal "fail2ban no arrancó"
systemctl enable -q --now unattended-upgrades 2>/dev/null
ok "parches de seguridad de Debian se instalan solos cada día"

# ------------------------------------------------------------------ antivirus
paso "Antivirus ClamAV"
# la instancia de Debian se reemplaza por la de Crack OS (crackos-clamd + crackos-clamonacc)
systemctl disable -q --now clamav-daemon.socket clamav-daemon.service clamav-clamonacc.service 2>/dev/null
systemctl mask -q clamav-daemon.service clamav-daemon.socket clamav-clamonacc.service 2>/dev/null
systemctl stop clamav-freshclam 2>/dev/null
echo "   ${G}descargando la base de virus (unos 200 MB, puede tardar unos minutos)…${N}"
if timeout 900 freshclam --quiet >/dev/null 2>&1; then ok "base de virus al día"
else mal "no se pudo descargar ahora; se reintenta sola cada hora"; fi
systemctl enable -q --now clamav-freshclam 2>/dev/null

RAM=$(awk '/MemTotal/ {print int($2/1024/1024 + 0.5)}' /proc/meminfo)
RT=$(awk -F= '/^ *antivirus_tiempo_real/ {gsub(/ /,"",$2); print $2}' /etc/crackos/guard.conf 2>/dev/null)
if [ "${RAM:-0}" -lt 3 ] && [ ! -e /var/lib/crackos/.tiempo-real-elegido ]; then
    RT=no
    sed -i 's/^ *antivirus_tiempo_real.*/antivirus_tiempo_real = no/' /etc/crackos/guard.conf
    echo "   ${G}tu PC tiene ${RAM} GB de RAM: el antivirus residente usa ~1 GB, así que queda en escaneo"
    echo "   semanal + USB. Actívalo igual con: sudo crackguard tiempo-real si${N}"
fi
systemctl daemon-reload
if [ "$RT" != no ]; then
    systemctl enable -q crackos-clamd crackos-clamonacc
    systemctl restart crackos-clamd
    ok "motor antivirus arrancando (carga la base en ~1 min)"
    systemctl restart crackos-clamonacc --no-block
    ok "bloqueo en tiempo real: carpetas personales, /tmp y USB"
else
    systemctl disable -q --now crackos-clamd crackos-clamonacc 2>/dev/null
fi
systemctl enable -q --now crackos-escaneo.timer && ok "escaneo completo cada domingo"

# ------------------------------------------------------------------ crack guard
paso "Crack Guard (detector de procesos sospechosos)"
systemctl enable -q crackos-guard
systemctl restart crackos-guard && ok "vigilando: mineros, puertas traseras, malware en memoria, rootkits, cambios en archivos críticos" \
    || mal "Crack Guard no arrancó: journalctl -u crackos-guard"

# escudo en la barra de cada usuario
for d in /etc/skel/.config/waybar /home/*/.config/waybar /root/.config/waybar; do
    [ -d "$d" ] || continue
    python3 /usr/lib/crackos/seguridad/waybar-guard.py "$d" && \
        { [ "$d" = /etc/skel/.config/waybar ] || chown --reference="$d" "$d"/config* "$d"/style.css 2>/dev/null; }
done
pkill -SIGUSR2 -x waybar 2>/dev/null || true
# avisos: sin el boton automatico "COPY" de SwayNC (confunde el PID con un codigo)
for f in /etc/skel/.config/swaync/config.json /home/*/.config/swaync/config.json; do
    [ -f "$f" ] && python3 - "$f" <<'PY'
import json, sys
f = sys.argv[1]
d = json.load(open(f))
if d.get("notification-2fa-action") is not False:
    d["notification-2fa-action"] = False
    json.dump(d, open(f, "w"), indent=2, ensure_ascii=False)
PY
done
for b in /run/user/*/bus; do
    u=$(stat -c %U "$b" 2>/dev/null) && runuser -u "$u" -- env DBUS_SESSION_BUS_ADDRESS="unix:path=$b" swaync-client -R >/dev/null 2>&1 || true
done
ok "escudo de seguridad agregado a la barra (clic = panel)"

# atajo en el menu de aplicaciones
cat > /usr/share/applications/crackguard.desktop <<'EOF'
[Desktop Entry]
Name=Crack Guard
GenericName=Seguridad
Comment=Antivirus, procesos sospechosos, cuarentena y firewall
Exec=kitty --class crackos-float -e crackguard panel
Icon=crackguard
Terminal=false
Type=Application
Categories=System;Security;
Keywords=antivirus;seguridad;virus;firewall;malware;
EOF

echo "$REF $(date +%s)" > /var/lib/crackos/seguridad.version
sleep 3
paso "Listo"
crackguard estado 2>/dev/null || true
echo
echo "   ${W}Panel:${N} clic en el escudo de la barra, o ${W}crackguard${N} en la terminal"
echo "   ${W}Probar que todo funciona:${N} ${R}sudo crackguard prueba${N}"
echo "   ${W}Actualizar en el futuro:${N} ${R}sudo crackos-actualizar${N}"
[ "$LIVE" = no ] && echo "   ${G}Reinicia cuando puedas para activar las opciones de arranque seguras.${N}"
return 0
}

# todo va dentro de main() para que "curl ... | sudo bash" lea el script completo antes de ejecutarlo
main "$@" < /dev/null
