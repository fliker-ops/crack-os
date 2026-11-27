#!/bin/bash
# Prueba de Crack Guard: simula ataques reales y comprueba que se detectan y se congelan.
# Uso (como root): tests/seguridad-guard.sh [ruta/crackos-guard.py]
# No toca el sistema: los archivos de configuracion y registro van a una carpeta temporal.
set -u
GUARD=${1:-$(dirname "$0")/../seguridad/raiz/usr/lib/crackos/seguridad/crackos-guard.py}
export CRACKGUARD_PREFIX=$(mktemp -d)
P=$CRACKGUARD_PREFIX
mkdir -p "$P/etc/crackos"
printf 'modo = bloquear\nintervalo = 1\ncpu_umbral = 80\ncpu_segundos = 4\nsuid_cada = 3\n' > "$P/etc/crackos/guard.conf"
printf 'root:x:0:0:root:/root:/bin/bash\ncrack:x:1000:1000::/home/crack:/bin/bash\n' > "$P/etc/passwd"
LOGF="$P/var/lib/crackos/guard/eventos.jsonl"
PIDS=()
cleanup() { kill -9 "${PIDS[@]}" "$GPID" 2>/dev/null; rm -rf /tmp/xmrig /dev/shm/actualizador /tmp/.oculto /tmp/suid-prueba /tmp/escucha "$P"; }
trap cleanup EXIT

python3 "$GUARD" > "$P/guard.out" 2>&1 &
GPID=$!
sleep 3

bg() { "$@" >/dev/null 2>&1 & PIDS+=($!); }
echo "== Simulando ataques"
cp /bin/sleep /tmp/xmrig;               bg /tmp/xmrig 120                                     # minero
cp /bin/sleep /dev/shm/actualizador;    bg /dev/shm/actualizador 120                          # /dev/shm
bg bash -c 'exec -a "[kworker/0:2]" sleep 120'                                                # disfraz
bg python3 -c 'import os;fd=os.memfd_create("x");os.write(fd,open("/bin/sleep","rb").read());os.execv(f"/proc/self/fd/{fd}",["x","120"])'  # sin archivo
bg bash -c ': /dev/tcp/203.0.113.9/4444; sleep 120; true'                                     # reverse shell (comando)
bg python3 -c 'import socket,subprocess;a,b=socket.socketpair();subprocess.Popen(["bash","-c","sleep 120; true"],stdin=a,stdout=a).wait()'  # shell en socket
bg sh -c 'sleep 120; : --donate-level=1 stratum+tcp://pool.example:3333'           # minero por argumentos
mkdir -p /tmp/.oculto && cp /bin/sleep /tmp/.oculto/xx && bg /tmp/.oculto/xx 120; sleep 2; rm -f /tmp/.oculto/xx  # se borra a si mismo
cp /usr/bin/python3 /tmp/escucha && bg /tmp/escucha -c 'import socket,time;s=socket.socket();s.bind(("0.0.0.0",47999));s.listen();time.sleep(120)'
cp /bin/true /tmp/suid-prueba && chmod 4755 /tmp/suid-prueba                                  # SUID en /tmp
echo /tmp/rootkit.so > "$P/etc/ld.so.preload"                                                  # rootkit
echo 'toor:x:0:0::/root:/bin/bash' >> "$P/etc/passwd"                                          # cuenta uid 0
bg bash -c 'cp /bin/yes /tmp/xmrig-cpu 2>/dev/null; exec /usr/bin/yes > /dev/null'             # CPU alta normal (no debe alertar)
sleep 14

echo "== Eventos registrados"
python3 - "$LOGF" <<'EOF'
import json, sys
for l in open(sys.argv[1]):
    e = json.loads(l)
    print(f"  [{e['nivel']:7}] {e.get('regla',''):15} congelado={str(e.get('congelado','')):5} {e['titulo']} :: {e.get('detalle','')[:90]}")
EOF

echo "== Comprobaciones"
fail=0
for r in minero shm disfraz-kernel sin-archivo puerta-trasera temporal ld-so-preload uid0 suid puerto; do
    if grep -q "\"regla\": \"$r\"" "$LOGF"; then echo "  OK   $r"; else echo "  FALLA $r"; fail=1; fi
done
st=$(awk '/^State:/{print $2}' /proc/"${PIDS[0]}"/status 2>/dev/null)
[ "$st" = T ] && echo "  OK   el minero quedo congelado (estado T)" || { echo "  FALLA el minero no esta congelado ($st)"; fail=1; }
[ -u /tmp/suid-prueba ] && { echo "  FALLA el SUID sigue activo"; fail=1; } || echo "  OK   se quito el SUID de /tmp/suid-prueba"
grep -q '"regla": "cpu-oculta"' "$LOGF" && grep -q '/usr/bin/yes' <(grep cpu-oculta "$LOGF") && { echo "  FALLA falso positivo con yes"; fail=1; }
grep -qi "error analizando\|Traceback" "$P/guard.out" && { echo "  FALLA errores del vigilante:"; grep -i "error\|Traceback" -A3 "$P/guard.out" | head; fail=1; }
[ $fail = 0 ] && echo "TODO BIEN" || echo "HAY FALLAS"
exit $fail
