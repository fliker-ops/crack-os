#!/bin/bash
# Arranca la ISO en QEMU (BIOS y UEFI) y guarda capturas de pantalla en screens/.
# Uso: tests/qemu-screens.sh crack-os-1.0-amd64.iso
set -u
ISO="$1"; OUT=screens; mkdir -p "$OUT"
DISK=""; command -v qemu-img >/dev/null && qemu-img create -q -f qcow2 /tmp/disco.qcow2 30G && DISK="-drive file=/tmp/disco.qcow2,if=virtio"
KVM=""; [ -w /dev/kvm ] && KVM="-enable-kvm -cpu host"

shot() { # $1 socket  $2 nombre
    echo "screendump /tmp/$2.ppm" | socat - "UNIX-CONNECT:$1" >/dev/null 2>&1
    sleep 1; convert "/tmp/$2.ppm" "$OUT/$2.png" 2>/dev/null && echo "captura $2"
}
key() { echo "sendkey $2" | socat - "UNIX-CONNECT:$1" >/dev/null 2>&1; }

run() { # $1 modo (bios|uefi)  $2.. tiempos
    local mode=$1; shift
    local sock=/tmp/mon-$mode.sock; rm -f "$sock" "$sock.rec"
    local fw=""
    [ "$mode" = uefi ] && fw="-drive if=pflash,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd"
    qemu-system-x86_64 $KVM -m 4096 -smp 2 $fw -cdrom "$ISO" -boot d $DISK -vga virtio -usb -device usb-tablet \
        -display none -monitor "unix:$sock,server,nowait" -monitor "unix:$sock.rec,server,nowait" -serial file:"$OUT/serial-$mode.log" &
    local pid=$!
    if [ "$mode" = bios ]; then
        mkdir -p /tmp/rec
        ( n=0; while kill -0 $pid 2>/dev/null; do
              f=/tmp/rec/$(printf %05d $n)
              echo "screendump $f.ppm" | socat - "UNIX-CONNECT:$sock.rec" >/dev/null 2>&1
              sleep 0.3; ( convert "$f.ppm" -resize 1280x "$f.jpg" 2>/dev/null; rm -f "$f.ppm" ) &
              n=$((n+1)); done ) &
        REC=$!
    fi
    sleep 4; shot "$sock" "$mode-00-menu"
    key "$sock" ret
    local last=4
    for t in "$@"; do sleep $((t - last)); last=$t; shot "$sock" "$mode-$(printf %03d "$t")s"; done
    if [ "$mode" = bios ]; then
        type() { local w="$1" i c; for ((i=0; i<${#w}; i++)); do c="${w:i:1}"; case "$c" in " ") c=spc ;; "-") c=slash ;; [A-Z]) c="shift-${c,,}" ;; esac; key "$sock" "$c"; sleep 0.12; done; key "$sock" ret; }
        # si aparece la pantalla de acceso, entra con la clave del Live ("live")
        type live
        sleep 30; shot "$sock" "bios-89-escritorio"
        key "$sock" meta_l-ret; sleep 8; shot "$sock" "bios-90-terminal"
        type crackdiag; sleep 4; shot "$sock" "bios-93-diagnostico"
        type "sudo crackdiag serie"; sleep 12
        type "crackos-usbkey status"; sleep 3
        key "$sock" meta_l-spc; sleep 4; shot "$sock" "bios-91-aplicaciones"
        key "$sock" esc; sleep 2
        key "$sock" meta_l-e; sleep 8; shot "$sock" "bios-92-archivos"
        key "$sock" meta_l-f1; sleep 4; shot "$sock" "bios-94-atajos"
        key "$sock" esc; sleep 2
        key "$sock" meta_l-2; sleep 3
        key "$sock" meta_l-b; sleep 30; shot "$sock" "bios-95-navegador"
        key "$sock" meta_l-q; sleep 3
        key "$sock" meta_l-1; sleep 3
        key "$sock" meta_l-n; sleep 4; shot "$sock" "bios-96-notificaciones"
        key "$sock" meta_l-n; sleep 2
        key "$sock" meta_l-shift-e; sleep 4; shot "$sock" "bios-97-energia"
        key "$sock" esc; sleep 2
        key "$sock" meta_l-ret; sleep 6
        type "sudo -E calamares"; sleep 35; shot "$sock" "bios-98-instalador"
        key "$sock" meta_l-q; sleep 2; key "$sock" alt-s; sleep 3
        # cerrar sesion desde el menu de energia: SDDM muestra la pantalla de acceso de Crack OS
        key "$sock" meta_l-shift-e; sleep 4
        key "$sock" down; sleep 1; key "$sock" down; sleep 1; key "$sock" ret; sleep 20; shot "$sock" "bios-99-acceso"
        type live; sleep 25; shot "$sock" "bios-99-de-vuelta"
        shot "$sock" "bios-99-final"
    fi
    kill $pid 2>/dev/null; wait $pid 2>/dev/null
    if [ "$mode" = bios ] && [ -n "${REC:-}" ]; then
        wait $REC 2>/dev/null; sleep 3; ls /tmp/rec | wc -l
        ffmpeg -v error -y -framerate 3 -pattern_type glob -i '/tmp/rec/*.jpg' \
            -vf "mpdecimate=hi=64*24:lo=64*12:frac=0.5,setpts=N/3/TB,scale=1280:-2" -r 3 -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p "$OUT/recorrido.mp4" \
            && echo "video: $(du -h "$OUT/recorrido.mp4" | cut -f1)"
    fi
}

run uefi 8
run bios 10 20 45 60
ls -la "$OUT"
