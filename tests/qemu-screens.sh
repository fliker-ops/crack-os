#!/bin/bash
# Arranca la ISO en QEMU (BIOS y UEFI) y guarda capturas de pantalla en screens/.
# Uso: tests/qemu-screens.sh crack-os-1.0-amd64.iso
set -u
ISO="$1"; OUT=screens; mkdir -p "$OUT"
KVM=""; [ -w /dev/kvm ] && KVM="-enable-kvm -cpu host"

shot() { # $1 socket  $2 nombre
    echo "screendump /tmp/$2.ppm" | socat - "UNIX-CONNECT:$1" >/dev/null 2>&1
    sleep 1; convert "/tmp/$2.ppm" "$OUT/$2.png" 2>/dev/null && echo "captura $2"
}
key() { echo "sendkey $2" | socat - "UNIX-CONNECT:$1" >/dev/null 2>&1; }

run() { # $1 modo (bios|uefi)  $2.. tiempos
    local mode=$1; shift
    local sock=/tmp/mon-$mode.sock; rm -f "$sock"
    local fw=""
    [ "$mode" = uefi ] && fw="-drive if=pflash,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd"
    qemu-system-x86_64 $KVM -m 4096 -smp 2 $fw -cdrom "$ISO" -boot d -vga std -usb -device usb-tablet \
        -display none -monitor "unix:$sock,server,nowait" -serial file:"$OUT/serial-$mode.log" &
    local pid=$!
    sleep 4; shot "$sock" "$mode-00-menu"
    key "$sock" ret
    local last=4
    for t in "$@"; do sleep $((t - last)); last=$t; shot "$sock" "$mode-$(printf %03d "$t")s"; done
    if [ "$mode" = bios ]; then
        key "$sock" ctrl-alt-t; sleep 8; shot "$sock" "bios-90-terminal"
        key "$sock" alt-f4; sleep 2
        echo "mouse_move 22 30" | socat - "UNIX-CONNECT:$sock" >/dev/null 2>&1
        echo "mouse_button 1" | socat - "UNIX-CONNECT:$sock" >/dev/null 2>&1; sleep 0.2
        echo "mouse_button 0" | socat - "UNIX-CONNECT:$sock" >/dev/null 2>&1; sleep 3
        shot "$sock" "bios-91-menu"
    fi
    kill $pid 2>/dev/null; wait $pid 2>/dev/null
}

run uefi 8
run bios 10 20 45 75 110
ls -la "$OUT"
