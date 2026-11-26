#!/bin/bash
# Crack OS - compila la ISO. Requiere Debian 13 "trixie" (o un contenedor debian:trixie) y root.
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

echo "==> Paquetes opcionales disponibles en Debian"
: > config/package-lists/optional.list.chroot
apt-get update -qq
grep -v '^\s*#' config/optional-packages.list | while read -r p; do
    [ -n "$p" ] || continue
    if apt-cache policy "$p" 2>/dev/null | grep -q 'Candidate: [0-9]'; then
        echo "$p" >> config/package-lists/optional.list.chroot; echo "  + $p"
    else
        echo "  - $p (no disponible)"
    fi
done

echo "==> Configurando live-build"
lb clean --purge >/dev/null 2>&1 || true
lb config

echo "==> Menu de arranque de la USB (GRUB EFI + ISOLINUX) con la estetica Crack OS"
cat /usr/share/live/build/bootloaders/grub-pc/theme.cfg /usr/share/live/build/bootloaders/grub-pc/live-theme/theme.txt 2>/dev/null | head -60 || true
OV=config/bootloaders-overlay
SRC=/usr/share/live/build/bootloaders
mkdir -p config/bootloaders
for bl in grub-pc syslinux_common; do
    rm -rf "config/bootloaders/$bl"
    cp -rL "$SRC/$bl" "config/bootloaders/$bl" || cp -r "$SRC/$bl" "config/bootloaders/$bl"
done
# GRUB (UEFI): fondo + tema propio
G=config/bootloaders/grub-pc
rm -f "$G/splash.png"; cp "$OV/splash-grub.png" "$G/splash.png"
mkdir -p "$G/live-theme"
cat > "$G/live-theme/theme.txt" <<'GRUBTHEME'
desktop-image: "crack-bg.png"
title-text: ""
terminal-font: "Unifont Regular 16"
message-color: "#e6e6e6"
terminal-box: "terminal_box_*.png"
+ boot_menu {
    left = 30%
    width = 40%
    top = 52%
    height = 34%
    item_font = "Unifont Regular 16"
    selected_item_font = "Unifont Regular 16"
    item_color = "#a0a0a0"
    selected_item_color = "#ffffff"
    item_height = 32
    item_padding = 10
    item_spacing = 6
    selected_item_pixmap_style = "select_*.png"
    scrollbar = false
}
+ progress_bar {
    id = "__timeout__"
    left = 30%
    width = 40%
    top = 90%
    height = 4
    show_text = false
    fg_color = "#ff2832"
    bg_color = "#3c080c"
    border_color = "#3c080c"
}
GRUBTHEME
cp "$OV/splash-grub.png" "$G/live-theme/crack-bg.png"
cp config/includes.chroot/boot/grub/themes/crackos/select_*.png "$G/live-theme/" || true
cp config/includes.chroot/boot/grub/themes/crackos/terminal_box_*.png "$G/live-theme/" || true
cat >> "$G/theme.cfg" <<'GRUBCOLORS'

# --- Crack OS ---
set color_normal=light-gray/black
set color_highlight=white/red
set menu_color_normal=light-gray/black
set menu_color_highlight=white/red
GRUBCOLORS
# ISOLINUX/SYSLINUX (BIOS)
S=config/bootloaders/syslinux_common
rm -f "$S/splash.svg.in" "$S/splash.svg" "$S/splash.png"
cp "$OV/splash-isolinux.png" "$S/splash.png"
if [ -f "$S/stdmenu.cfg" ]; then
    sed -i -e 's/^menu color title.*/menu color title\t* #ffffffff #00000000 none/' \
           -e 's/^menu color sel.*/menu color sel\t* #ffffffff #c0ff2832 none/' \
           -e 's/^menu color unsel.*/menu color unsel\t* #ffbdbdbd #00000000 none/' \
           -e 's/^menu color hotsel.*/menu color hotsel\t1;7;37;40 #ffffffff #c0ff2832 none/' \
           -e 's/^menu color tabmsg.*/menu color tabmsg\t* #ff9a9a9a #00000000 none/' "$S/stdmenu.cfg"
fi
find config/bootloaders -maxdepth 2 | sort

echo "==> Compilando (esto tarda)"
lb build 2>&1 | tee build.log
ISO=$(ls -1 crack-os*.iso 2>/dev/null | head -1)
[ -n "$ISO" ] || { echo "ERROR: no se genero la ISO (ver build.log)"; exit 1; }
mv "$ISO" crack-os-1.0-amd64.iso
sha256sum crack-os-1.0-amd64.iso > crack-os-1.0-amd64.iso.sha256
ls -lh crack-os-1.0-amd64.iso
echo "==> Listo: crack-os-1.0-amd64.iso"
