#!/bin/bash
# Crack OS - compila la ISO. Requiere Debian 12 (o un contenedor debian:bookworm) y root.
#   sudo ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
[ "$EUID" -eq 0 ] || { echo "Ejecuta como root: sudo ./build.sh"; exit 1; }

echo "==> Dependencias de compilacion"
apt-get update -qq
apt-get install -y -qq live-build debootstrap squashfs-tools xorriso isolinux syslinux-common \
    grub-efi-amd64-bin grub-pc-bin mtools dosfstools git curl ca-certificates sassc \
    libglib2.0-dev-bin >/dev/null

INC=config/includes.chroot

echo "==> Tema GTK Matcha (variante oscura roja 'aliz')"
if [ ! -d "$INC/usr/share/themes/Matcha-dark-aliz" ]; then
    tmp=$(mktemp -d)
    git clone --depth 1 https://github.com/vinceliuice/Matcha-gtk-theme.git "$tmp/matcha"
    mkdir -p "$INC/usr/share/themes"
    ( cd "$tmp/matcha" && ./install.sh -d "$OLDPWD/$INC/usr/share/themes" -c dark -t aliz ) || \
    ( cd "$tmp/matcha" && ./install.sh -d "$OLDPWD/$INC/usr/share/themes" )
    find "$INC/usr/share/themes" -maxdepth 1 -name 'Matcha-*' ! -name 'Matcha-dark-aliz*' -exec rm -rf {} + || true
    rm -rf "$tmp"
fi
ls "$INC/usr/share/themes" || true

echo "==> papirus-folders (carpetas rojas)"
if [ ! -x "$INC/usr/local/bin/papirus-folders" ]; then
    tmp=$(mktemp -d)
    if git clone --depth 1 https://github.com/PapirusDevelopmentTeam/papirus-folders.git "$tmp/pf"; then
        install -Dm755 "$tmp/pf/papirus-folders" "$INC/usr/local/bin/papirus-folders"
    else
        echo "AVISO: no se pudo descargar papirus-folders"
    fi
    rm -rf "$tmp"
fi

echo "==> Configurando live-build"
lb clean --purge >/dev/null 2>&1 || true
lb config

echo "==> Menu de arranque de la USB (GRUB EFI + ISOLINUX) con la estetica Crack OS"
ls -la /usr/share/live/build/bootloaders/ /usr/share/live/build/bootloaders/grub-pc /usr/share/live/build/bootloaders/isolinux || true
OV=config/bootloaders-overlay
for bl in grub-pc isolinux; do
    rm -rf "config/bootloaders/$bl"
    mkdir -p config/bootloaders
    cp -rL "/usr/share/live/build/bootloaders/$bl" "config/bootloaders/$bl"
done
# GRUB (UEFI)
G=config/bootloaders/grub-pc
rm -f "$G/splash.png"; cp "$OV/splash-grub.png" "$G/splash.png"
cat >> "$G/theme.cfg" <<'GRUBTHEME'

# --- Crack OS ---
set color_normal=light-gray/black
set color_highlight=white/red
set menu_color_normal=light-gray/black
set menu_color_highlight=white/red
GRUBTHEME
# ISOLINUX (BIOS)
I=config/bootloaders/isolinux
rm -f "$I/splash.svg.in" "$I/splash.svg" "$I/splash.png"
cp "$OV/splash-isolinux.png" "$I/splash.png"
if [ -f "$I/stdmenu.cfg" ]; then
    sed -i -e 's/^menu color title.*/menu color title\t* #ffffffff #00000000 none/' \
           -e 's/^menu color sel.*/menu color sel\t* #ffffffff #c0ff2832 none/' \
           -e 's/^menu color unsel.*/menu color unsel\t* #ffbdbdbd #00000000 none/' \
           -e 's/^menu color hotsel.*/menu color hotsel\t1;7;37;40 #ffffffff #c0ff2832 none/' \
           -e 's/^menu color tabmsg.*/menu color tabmsg\t* #ff9a9a9a #00000000 none/' "$I/stdmenu.cfg"
fi
# Nombres de las entradas
grep -rl "Live system" config/bootloaders 2>/dev/null | xargs -r sed -i \
    -e 's/Live system (fail-safe mode)/Crack OS Live (modo compatibilidad)/g' \
    -e 's/Live system/Crack OS Live (nada se guarda)/g'

echo "==> Compilando (esto tarda)"
lb build 2>&1 | tee build.log
ISO=$(ls -1 crack-os*.iso 2>/dev/null | head -1)
[ -n "$ISO" ] || { echo "ERROR: no se genero la ISO (ver build.log)"; exit 1; }
mv "$ISO" crack-os-1.0-amd64.iso
sha256sum crack-os-1.0-amd64.iso > crack-os-1.0-amd64.iso.sha256
ls -lh crack-os-1.0-amd64.iso
echo "==> Listo: crack-os-1.0-amd64.iso"
