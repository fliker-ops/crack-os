#!/usr/bin/env python3
# Crack Guard - vigilante de procesos sospechosos de Crack OS (servicio de root, solo biblioteca estandar).
#
# Revisa /proc cada pocos segundos y detecta tecnicas tipicas de malware:
#   - programas sin archivo (ejecutados desde memoria, /memfd:)
#   - procesos que se disfrazan de hilos del kernel ([kworker] con ejecutable propio)
#   - shells conectadas a la red (reverse shell) y comandos tipicos de puerta trasera
#   - mineros de criptomonedas (nombres conocidos, stratum+tcp://, CPU alta desde /tmp)
#   - ejecutables lanzados desde /tmp, /var/tmp o /dev/shm, o ya borrados del disco
#   - programas del usuario corriendo como administrador
#   - puertos abiertos por programas sospechosos
#   - cambios en archivos criticos (/etc/passwd, sudoers, ld.so.preload, cron, claves SSH de root)
#   - archivos SUID nuevos en carpetas temporales
# Tambien recibe los avisos del antivirus (ClamAV) y los muestra como notificaciones.
#
# Niveles: critico -> se CONGELA el proceso (SIGSTOP) y se pregunta que hacer
#          alto    -> aviso con botones (Terminar / Permitir)
#          medio   -> aviso informativo
import hashlib
import json
import os
import pwd
import re
import shutil
import signal
import subprocess
import sys
import threading
import time

P = os.environ.get("CRACKGUARD_PREFIX", "")          # solo para pruebas
CONF = P + "/etc/crackos/guard.conf"
ALLOW = P + "/etc/crackos/guard-permitidos.list"
RUN = P + "/run/crackos-guard"
INBOX = RUN + "/inbox"
STATE = RUN + "/estado.json"
LIB = P + "/var/lib/crackos"
LOG = LIB + "/guard/eventos.jsonl"
QUAR = LIB + "/cuarentena"
ICON = "/usr/share/icons/hicolor/scalable/apps/crackguard.svg"

HZ = os.sysconf("SC_CLK_TCK")
MYPID = os.getpid()
PF_KTHREAD = 0x00200000

WRITABLE = ("/tmp/", "/var/tmp/", "/dev/shm/", "/run/user/", "/home/", "/root/")
TEMP_DIRS = ("/tmp/", "/var/tmp/", "/dev/shm/")
SHELLS = {"bash", "sh", "dash", "zsh", "ksh", "mksh", "fish", "csh", "tcsh", "busybox", "ash"}
NETTOOLS = {"nc", "ncat", "netcat", "nc.openbsd", "nc.traditional", "socat", "telnet"}
INTERP = {"python", "python2", "python3", "perl", "ruby", "php", "lua", "node"}
MINERS = {"xmrig", "xmr-stak", "xmr-stak-cpu", "minerd", "cpuminer", "cpuminer-multi", "cgminer",
          "bfgminer", "ethminer", "nbminer", "t-rex", "phoenixminer", "lolminer", "gminer", "nanominer",
          "kdevtmpfsi", "kinsing", "kworkerds", "xmrigdaemon", "xmrigminer", "srbminer", "teamredminer",
          "nicehash", "trex", "ccminer", "claymore"}
MINER_ARGS = re.compile(r"stratum\+(tcp|ssl|tls)://|--donate-level|--coin[= ](monero|xmr)|cryptonight|"
                        r"randomx|nicehash\.com|minexmr|supportxmr|moneroocean|nanopool\.org|2miners", re.I)
REVSHELL = re.compile(r"/dev/(tcp|udp)/[^/\s]+/\d+|\b(nc|ncat|netcat)\b[^|;]*\s-[a-z]*e\s|"
                      r"\bsocat\b[^|;]*\b(exec|system):|\bmkfifo\b.*\b(nc|ncat|netcat|telnet)\b|"
                      r"pty\.spawn\(|socket\.socket\(.*(subprocess|os\.dup2)|"
                      r"\bfsockopen\(|TCPSocket\.(new|open)\(.*(exec|spawn|sh)|"
                      r"(IO::Socket|use Socket).*exec", re.I)
# memfd legitimos (contenedores)
MEMFD_OK = ("/memfd:runc_cloned", "/memfd:crun", "/memfd:youki")
# carpetas ocultas del usuario donde es normal tener programas
HOME_OK = ("/.local/", "/.cargo/", "/.rustup/", "/.nvm/", "/.npm/", "/.cache/ms-playwright/",
           "/.vscode", "/.var/app/", "/.steam", "/.local/share/Steam/", "/.mozilla/", "/.pyenv/",
           "/.sdkman/", "/.deno/", "/.bun/", "/.claude/", "/.wine/", "/.config/Code/", "/go/", "/.go/")

WATCH_FILES = ["/etc/passwd", "/etc/shadow", "/etc/group", "/etc/sudoers", "/etc/ld.so.preload",
               "/etc/crontab", "/root/.ssh/authorized_keys", "/etc/pam.d/common-auth", "/etc/pam.d/sudo"]
WATCH_DIRS = ["/etc/sudoers.d", "/etc/cron.d", "/var/spool/cron/crontabs", "/etc/systemd/system",
              "/etc/profile.d", "/etc/update-motd.d"]

DEFAULTS = {"modo": "bloquear", "intervalo": "2", "cpu_umbral": "85", "cpu_segundos": "90",
            "avisos_escritorio": "si", "vigilar_archivos": "si", "vigilar_puertos": "si", "suid_cada": "120"}


def log(msg):
    print(msg, flush=True)


def read(path, mode="r"):
    try:
        with open(path, mode) as f:
            return f.read()
    except OSError:
        return None


def load_conf():
    c = dict(DEFAULTS)
    for line in (read(CONF) or "").splitlines():
        line = line.split("#", 1)[0].strip()
        if "=" in line:
            k, v = line.split("=", 1)
            c[k.strip()] = v.strip()
    return c


def load_allow():
    paths, hashes = set(), set()
    for line in (read(ALLOW) or "").splitlines():
        line = line.split("#", 1)[0].strip()
        if line.startswith("sha256:"):
            hashes.add(line[7:].lower())
        elif line.startswith("/"):
            paths.add(line)
    return paths, hashes


def sha256(path):
    try:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for b in iter(lambda: f.read(1 << 20), b""):
                h.update(b)
        return h.hexdigest()
    except OSError:
        return ""


def uname(uid):
    try:
        return pwd.getpwuid(uid).pw_name
    except KeyError:
        return str(uid)


# ---------------------------------------------------------------- avisos de escritorio
def gui_sessions():
    """[(usuario, uid)] con sesion grafica activa."""
    out = []
    try:
        r = subprocess.run(["loginctl", "list-sessions", "--no-legend"], capture_output=True, text=True, timeout=5)
        for line in r.stdout.splitlines():
            sid = line.split()[0] if line.split() else ""
            if not sid:
                continue
            s = subprocess.run(["loginctl", "show-session", sid, "-p", "Name", "-p", "User", "-p", "Type",
                                "-p", "Active", "-p", "Remote"], capture_output=True, text=True, timeout=5).stdout
            d = dict(l.split("=", 1) for l in s.splitlines() if "=" in l)
            if d.get("Type") in ("wayland", "x11") and d.get("Remote") != "yes":
                u = (d.get("Name"), int(d.get("User", "0")))
                if u not in out:
                    out.append(u)
    except (OSError, subprocess.SubprocessError, ValueError):
        pass
    if not out and os.path.isdir("/run/user"):
        for d in os.listdir("/run/user"):
            if d.isdigit() and int(d) >= 1000 and os.path.exists(f"/run/user/{d}/bus"):
                out.append((uname(int(d)), int(d)))
    return out


def notify(level, title, body, actions=None, on_action=None, timeout=600):
    """Muestra un aviso en cada sesion grafica. on_action(nombre) recibe el primer boton pulsado."""
    if load_conf().get("avisos_escritorio") != "si" or P:
        log(f"[aviso:{level}] {title} | {body} | {list((actions or {}).keys())}")
        return
    urg = {"critico": "critical", "alto": "critical", "medio": "normal"}.get(level, "normal")
    done = threading.Event()

    def one(user, uid):
        cmd = ["runuser", "-u", user, "--", "env", f"DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/{uid}/bus",
               f"XDG_RUNTIME_DIR=/run/user/{uid}", "notify-send", "-a", "Crack Guard", "-u", urg,
               "-i", ICON, "-h", "string:x-crackos-guard:" + level]
        if level in ("critico", "alto"):
            cmd += ["-t", "0"]
        for k, v in (actions or {}).items():
            cmd += ["-A", f"{k}={v}"]
        cmd += [title, body]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout if actions else 15)
            act = r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ""
            if act and on_action and not done.is_set() and act in (actions or {}):
                done.set()
                on_action(act)
        except (OSError, subprocess.SubprocessError):
            pass

    for user, uid in gui_sessions():
        threading.Thread(target=one, args=(user, uid), daemon=True).start()


# ---------------------------------------------------------------- registro / cuarentena
def record(ev):
    ev.setdefault("hora", time.strftime("%Y-%m-%d %H:%M:%S"))
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "a") as f:
        f.write(json.dumps(ev, ensure_ascii=False) + "\n")
    log(f"[{ev.get('nivel')}] {ev.get('titulo')} :: {ev.get('detalle', '')}")


def quarantine(path, reason):
    """Mueve un archivo a la cuarentena (sin permisos). Devuelve el id o ''."""
    system = ("/usr/", "/bin/", "/sbin/", "/lib", "/etc/", "/boot/", "/proc/", "/sys/", "/dev/", "/var/lib/dpkg/")
    if not path or not os.path.isfile(path) or (path.startswith(system) and not path.startswith("/dev/shm/")):
        return ""
    os.makedirs(QUAR, mode=0o700, exist_ok=True)
    qid = time.strftime("%Y%m%d-%H%M%S-") + re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(path))[:60]
    dst = os.path.join(QUAR, qid + ".cuarentena")
    try:
        st = os.stat(path)
        digest = sha256(path)
        shutil.move(path, dst)
        os.chmod(dst, 0)
        with open(os.path.join(QUAR, qid + ".json"), "w") as f:
            json.dump({"id": qid, "original": path, "sha256": digest, "motivo": reason, "uid": st.st_uid,
                       "modo": st.st_mode & 0o7777, "hora": time.strftime("%Y-%m-%d %H:%M:%S")}, f,
                      ensure_ascii=False)
        return qid
    except OSError as e:
        log(f"no se pudo poner en cuarentena {path}: {e}")
        return ""


# ---------------------------------------------------------------- informacion de procesos
class Proc:
    __slots__ = ("pid", "comm", "ppid", "flags", "cpu", "start", "uid", "euid", "exe", "cmd", "argv0")

    @staticmethod
    def load(pid):
        st = read(f"/proc/{pid}/stat")
        if not st:
            return None
        p = Proc()
        p.pid = pid
        try:
            l, r = st.index("("), st.rindex(")")
            p.comm = st[l + 1:r]
            f = st[r + 2:].split()
            p.ppid, p.flags = int(f[1]), int(f[6])
            p.cpu = int(f[11]) + int(f[12])
            p.start = int(f[19])
        except (ValueError, IndexError):
            return None
        status = read(f"/proc/{pid}/status") or ""
        m = re.search(r"^Uid:\s+(\d+)\s+(\d+)", status, re.M)
        p.uid, p.euid = (int(m.group(1)), int(m.group(2))) if m else (-1, -1)
        try:
            p.exe = os.readlink(f"/proc/{pid}/exe")
        except OSError:
            p.exe = ""
        raw = read(f"/proc/{pid}/cmdline", "rb") or b""
        args = raw.rstrip(b"\0").split(b"\0") if raw else []
        p.argv0 = args[0].decode(errors="replace") if args else ""
        p.cmd = " ".join(a.decode(errors="replace") for a in args)[:600]
        return p

    @property
    def kthread(self):
        return bool(self.flags & PF_KTHREAD)

    @property
    def key(self):
        return (self.pid, self.start)

    @property
    def path(self):
        return self.exe[:-10] if self.exe.endswith(" (deleted)") else self.exe

    @property
    def base(self):
        return os.path.basename(self.path) or self.comm


def fd_targets(pid, fds=("0", "1", "2")):
    out = []
    for fd in fds:
        try:
            out.append(os.readlink(f"/proc/{pid}/fd/{fd}"))
        except OSError:
            out.append("")
    return out


def socket_owners():
    """inode de socket en escucha -> (puerto, proto, direccion)."""
    res = {}
    for proto in ("tcp", "tcp6", "udp", "udp6"):
        for line in (read(f"/proc/net/{proto}") or "").splitlines()[1:]:
            f = line.split()
            if len(f) < 10:
                continue
            listening = f[3] == "0A" if proto.startswith("tcp") else f[3] == "07" and f[2].endswith(":0000")
            if not listening:
                continue
            addr, port = f[1].rsplit(":", 1)
            local = set(addr) <= {"0"} or addr in ("00000000000000000000000000000000",)
            loop = (len(addr) == 8 and addr.endswith("7F")) or addr == "00000000000000000000000001000000" \
                or addr.startswith("0000000000000000FFFF0000") and addr.endswith("7F")
            if loop:
                continue
            res[f[9]] = (int(port, 16), proto, "todas" if local else addr)
    return res


# ---------------------------------------------------------------- vigilante
class Guard:
    def __init__(self):
        self.conf = load_conf()
        self.allow_paths, self.allow_hashes = load_allow()
        self.seen = {}           # key -> True (ya analizado)
        self.alerted = {}        # (regla, exe) -> hora
        self.cpu = {}            # key -> (cpu, t, segundos_altos)
        self.frozen = {}         # pid -> evento
        self.ports_seen = set()
        self.files = {}
        self.events = 0
        self.last = None
        self.av_events = 0
        self.lock = threading.Lock()
        self.status_cache = {}
        self.status_t = 0
        self.passwd_users = self.users()
        self.boot_done = False
        self.mounts, self.first_mounts = set(), True
        signal.signal(signal.SIGHUP, self.reload)
        signal.signal(signal.SIGTERM, lambda *a: sys.exit(0))

    def reload(self, *a):
        self.conf = load_conf()
        self.allow_paths, self.allow_hashes = load_allow()
        # reanudar procesos congelados que ahora estan permitidos
        for pid, ev in list(self.frozen.items()):
            if ev.get("exe") in self.allow_paths:
                self.resume(pid)
        log("configuracion recargada")

    # ---------------------------------------------------------- utilidades
    def allowed(self, p):
        if p.path in self.allow_paths or p.exe in self.allow_paths:
            return True
        if self.allow_hashes and p.path and os.path.isfile(p.path):
            return sha256(p.path) in self.allow_hashes
        return False

    def users(self):
        out = {}
        for line in (read(P + "/etc/passwd") or "").splitlines():
            f = line.split(":")
            if len(f) >= 4:
                out[f[0]] = f[2]
        return out

    def resume(self, pid):
        try:
            os.kill(pid, signal.SIGCONT)
        except OSError:
            pass
        self.frozen.pop(pid, None)

    def kill_quarantine(self, pid, ev):
        try:
            os.kill(pid, signal.SIGKILL)
        except OSError:
            pass
        self.frozen.pop(pid, None)
        qid = quarantine(ev.get("exe", ""), ev.get("titulo", ""))
        record({"nivel": "info", "titulo": "Proceso terminado", "detalle": f"{ev.get('exe')} (PID {pid})"
                + (f", archivo en cuarentena: {qid}" if qid else ""), "pid": pid, "cuarentena": qid})

    def allow_forever(self, pid, ev):
        exe = ev.get("exe", "")
        if exe:
            with open(ALLOW, "a") as f:
                f.write(f"{exe}    # permitido {time.strftime('%Y-%m-%d %H:%M')}: {ev.get('regla')}\n")
            self.allow_paths.add(exe)
        self.resume(pid)
        record({"nivel": "info", "titulo": "Programa permitido", "detalle": exe, "pid": pid})

    # ---------------------------------------------------------- alertas
    def alert(self, p, level, rule, title, detail):
        # los criticos se avisan por cada proceso; el resto, una vez cada 10 min por programa
        k = (rule, p.path or p.comm, p.pid if level == "critico" else 0)
        now = time.time()
        if now - self.alerted.get(k, 0) < 600:
            return
        self.alerted[k] = now
        ev = {"nivel": level, "regla": rule, "titulo": title, "detalle": detail, "pid": p.pid,
              "exe": p.path, "usuario": uname(p.uid), "comando": p.cmd[:300]}
        frozen = False
        if level == "critico" and self.conf.get("modo") == "bloquear" and p.pid > 1 and p.pid != MYPID:
            try:
                os.kill(p.pid, signal.SIGSTOP)
                frozen = True
                self.frozen[p.pid] = ev
            except OSError:
                pass
        ev["congelado"] = frozen
        record(ev)
        self.events += 1
        self.last = ev
        who = f"{p.base} (PID {p.pid}, usuario {uname(p.uid)})"
        if p.pid <= 1:      # alerta de archivo, no de proceso
            notify(level, ("☠ " if level == "critico" else "⚠ ") + title, detail)
        elif frozen:
            body = f"{detail}\n\n{who}\nEl proceso está CONGELADO hasta que decidas."
            notify("critico", "☠ " + title, body,
                   {"matar": "Terminar y aislar", "reanudar": "Dejar correr", "permitir": "Permitir siempre"},
                   lambda a, pid=p.pid, ev=ev: self.on_action(a, pid, ev))
        elif level in ("critico", "alto"):
            notify(level, "⚠ " + title, f"{detail}\n\n{who}",
                   {"matar": "Terminar", "permitir": "Permitir siempre", "ignorar": "Ignorar"},
                   lambda a, pid=p.pid, ev=ev: self.on_action(a, pid, ev))
        else:
            notify("medio", title, f"{detail}\n{who}")
        self.write_state(force=True)

    def on_action(self, act, pid, ev):
        with self.lock:
            if act == "matar":
                self.kill_quarantine(pid, ev)
            elif act == "reanudar":
                self.resume(pid)
                record({"nivel": "info", "titulo": "Proceso reanudado por el usuario", "detalle": ev.get("exe"),
                        "pid": pid})
            elif act == "permitir":
                self.allow_forever(pid, ev)
            self.write_state(force=True)

    # ---------------------------------------------------------- reglas por proceso
    def check_new(self, p):
        if p.kthread or p.pid in (1, MYPID) or self.allowed(p):
            return
        exe, path, base, cmd = p.exe, p.path, p.base.lower(), p.cmd
        home_hidden = path.startswith("/home/") and "/." in path[6:] and not any(h in path for h in HOME_OK)

        # 1. disfrazado de hilo del kernel
        if re.fullmatch(r"\[[\w/:.\-+ ]+\]", p.argv0.strip()) and exe:
            return self.alert(p, "critico", "disfraz-kernel", "Proceso disfrazado de kernel",
                              f"Se hace llamar {p.argv0} pero es el programa {exe}.")
        # 2. ejecutado desde memoria
        if exe.startswith("/memfd:") and not exe.startswith(MEMFD_OK):
            return self.alert(p, "critico", "sin-archivo", "Programa ejecutado desde memoria",
                              "Técnica típica de malware sin archivo (fileless): no existe en el disco.")
        # 3. minero conocido
        if base in MINERS or p.comm.lower() in MINERS or MINER_ARGS.search(cmd):
            return self.alert(p, "critico", "minero", "Minero de criptomonedas detectado",
                              f"El programa usa tu procesador para minar: {cmd[:140]}")
        # 4. reverse shell / puerta trasera
        if REVSHELL.search(cmd):
            return self.alert(p, "critico", "puerta-trasera", "Posible puerta trasera (reverse shell)",
                              f"Comando que conecta una terminal a otro equipo: {cmd[:160]}")
        norm = re.sub(r"[\d.]+$", "", base)
        if base in SHELLS or norm in INTERP:
            t = fd_targets(p.pid)
            if t[0].startswith("socket:") and t[1].startswith("socket:"):
                return self.alert(p, "critico", "puerta-trasera", "Terminal controlada por la red",
                                  "Una terminal tiene su entrada y salida conectadas a un socket de red (reverse shell).")
        # 5. ejecutable borrado del disco desde carpeta temporal / usuario
        if exe.endswith(" (deleted)") and path.startswith(WRITABLE):
            return self.alert(p, "critico", "borrado", "Programa que se borró a sí mismo",
                              f"Se ejecutó {path} y luego el archivo desapareció del disco.")
        # 6. desde /dev/shm (casi siempre malware)
        if path.startswith("/dev/shm/"):
            return self.alert(p, "critico", "shm", "Programa en memoria compartida",
                              f"Se ejecuta desde {path}, un lugar usado para esconder malware.")
        # 7. desde /tmp o /var/tmp
        if path.startswith(("/tmp/", "/var/tmp/")) and not path.startswith(("/tmp/.mount_", "/tmp/_MEI")):
            lvl = "critico" if p.euid == 0 else "alto"
            return self.alert(p, lvl, "temporal", "Programa ejecutándose desde carpeta temporal",
                              f"{path} se ejecuta desde una carpeta temporal" +
                              (" con permisos de administrador." if p.euid == 0 else "."))
        # 8. programa del usuario corriendo como root
        if p.euid == 0 and path.startswith("/home/"):
            return self.alert(p, "alto", "root-usuario", "Programa del usuario con permisos de administrador",
                              f"{path} está guardado en una carpeta personal y corre como root.")
        # 9. ejecutable escondido en carpeta oculta de usuario con nombre de sistema
        if home_hidden and base in {"sshd", "systemd", "init", "kthreadd", "dbus-daemon", "cron", "crond",
                                    "kworker", "ksoftirqd", "rsyslogd", "udevd", "bash", "sh", "sudo"}:
            return self.alert(p, "critico", "suplantacion", "Programa escondido con nombre de sistema",
                              f"{path} usa el nombre de un programa del sistema pero está escondido.")
        if home_hidden and path.count("/") <= 4:
            self.alert(p, "medio", "oculto", "Programa en carpeta oculta",
                       f"Se ejecuta {path}. Si no lo reconoces, revísalo en Crack Guard.")
        # 10. LD_PRELOAD de root apuntando a carpeta del usuario/temporal
        if p.euid == 0:
            env = read(f"/proc/{p.pid}/environ", "rb") or b""
            m = re.search(rb"(?:^|\0)LD_PRELOAD=([^\0]+)", env)
            if m and m.group(1).decode(errors="replace").startswith(WRITABLE):
                self.alert(p, "critico", "ld-preload", "Inyección de librería en proceso de administrador",
                           f"LD_PRELOAD={m.group(1).decode(errors='replace')}")

    def check_cpu(self, procs, dt):
        thr = float(self.conf.get("cpu_umbral", 85))
        need = float(self.conf.get("cpu_segundos", 90))
        alive = set()
        for p in procs:
            alive.add(p.key)
            prev = self.cpu.get(p.key)
            if prev and dt > 0:
                pct = (p.cpu - prev[0]) / HZ / dt * 100
                hi = prev[2] + dt if pct >= thr else 0
                self.cpu[p.key] = (p.cpu, time.time(), hi)
                if hi >= need and not self.allowed(p):
                    sus = p.path.startswith(TEMP_DIRS) or p.exe.endswith(" (deleted)") or \
                        (p.path.startswith("/home/") and "/." in p.path[6:] and not any(h in p.path for h in HOME_OK))
                    if sus:
                        self.alert(p, "critico", "cpu-oculta", "Uso de CPU sospechoso (posible minero)",
                                   f"{p.path} lleva {int(hi)} s usando {int(pct)}% de CPU desde un lugar sospechoso.")
                        self.cpu[p.key] = (p.cpu, time.time(), -10 ** 9)
            else:
                self.cpu[p.key] = (p.cpu, time.time(), 0)
        for k in list(self.cpu):
            if k not in alive:
                del self.cpu[k]

    def check_ports(self, procs):
        socks = socket_owners()
        if not socks:
            return
        by_pid = {p.pid: p for p in procs}
        for pid, p in by_pid.items():
            if p.kthread or self.allowed(p):
                continue
            try:
                fds = os.listdir(f"/proc/{pid}/fd")
            except OSError:
                continue
            for fd in fds:
                try:
                    t = os.readlink(f"/proc/{pid}/fd/{fd}")
                except OSError:
                    continue
                if not t.startswith("socket:["):
                    continue
                ino = t[8:-1]
                if ino not in socks:
                    continue
                port, proto, addr = socks[ino]
                k = (p.path, port, proto)
                if k in self.ports_seen:
                    continue
                self.ports_seen.add(k)
                if p.path.startswith(WRITABLE) or p.exe.endswith(" (deleted)") or p.exe.startswith("/memfd:"):
                    lvl = "critico" if not p.path.startswith(("/home/", "/root/")) or p.exe.endswith(" (deleted)") else "alto"
                    self.alert(p, lvl, "puerto", "Programa sospechoso abrió un puerto",
                               f"{p.path} escucha en el puerto {port}/{proto[:3]} ({addr}).")
                elif self.boot_done and p.uid >= 1000:
                    self.alert(p, "medio", "puerto-usuario", "Un programa abrió un puerto",
                               f"{p.base} escucha en {port}/{proto[:3]}. El firewall bloquea conexiones de fuera.")

    # ---------------------------------------------------------- archivos criticos
    def snapshot_files(self):
        snap = {}
        for f in WATCH_FILES:
            f = P + f
            try:
                st = os.stat(f)
                snap[f] = (st.st_mtime_ns, st.st_size)
            except OSError:
                snap[f] = None
        for d in WATCH_DIRS:
            d = P + d
            try:
                for n in os.listdir(d):
                    fp = os.path.join(d, n)
                    if os.path.isfile(fp):
                        st = os.stat(fp)
                        snap[fp] = (st.st_mtime_ns, st.st_size)
            except OSError:
                pass
        return snap

    def pkg_manager_running(self, procs):
        names = {"apt", "apt-get", "dpkg", "unattended-upgr", "aptitude", "synaptic", "packagekitd",
                 "adduser", "useradd", "usermod", "passwd", "chpasswd", "userdel", "deluser", "chage",
                 "calamares", "visudo", "crontab", "systemctl", "crackos-actuali", "instalar.sh"}
        return any(p.comm in names or p.base in names for p in procs)

    def check_files(self, procs):
        if self.conf.get("vigilar_archivos") != "si":
            return
        snap = self.snapshot_files()
        if not self.files:
            self.files = snap
            return
        changed = [f for f in set(snap) | set(self.files) if snap.get(f) != self.files.get(f)]
        self.files = snap
        if not changed:
            return
        mgr = self.pkg_manager_running(procs)
        for f in changed:
            short = f[len(P):] if P else f
            existed = f in snap and snap[f] is not None
            dummy = Proc()
            dummy.pid, dummy.uid, dummy.euid, dummy.exe, dummy.comm, dummy.cmd, dummy.argv0 = 0, 0, 0, short, "", "", ""
            dummy.flags = dummy.ppid = dummy.cpu = dummy.start = 0
            if short == "/etc/ld.so.preload" and existed and (read(f) or "").strip():
                self.alert(dummy, "critico", "ld-so-preload", "Se activó /etc/ld.so.preload",
                           "Ese archivo inyecta librerías en TODOS los programas; lo usan los rootkits. "
                           f"Contenido: {(read(f) or '').strip()[:120]}")
                continue
            if short == "/etc/passwd":
                now = self.users()
                new = [u for u in now if u not in self.passwd_users]
                root0 = [u for u in new if now[u] == "0"] + [u for u in now if now[u] == "0" and u != "root"
                                                              and self.passwd_users.get(u) != "0"]
                self.passwd_users = now
                if root0:
                    self.alert(dummy, "critico", "uid0", "Nueva cuenta con poderes de administrador",
                               f"Se creó una cuenta con UID 0: {', '.join(sorted(set(root0)))}.")
                    continue
                if new and not mgr:
                    self.alert(dummy, "alto", "usuario-nuevo", "Se creó un usuario nuevo", ", ".join(new))
                    continue
            if mgr:
                record({"nivel": "info", "titulo": "Archivo del sistema actualizado", "detalle": short})
                continue
            what = "se creó" if existed and short not in self.files else ("se borró" if not existed else "cambió")
            lvl = "alto" if any(x in short for x in ("sudoers", "authorized_keys", "pam.d", "cron", "shadow")) else "medio"
            self.alert(dummy, lvl, "archivo:" + short, "Cambio en archivo crítico", f"{short} {what}.")

    def check_suid(self):
        for d in ("/tmp", "/var/tmp", "/dev/shm"):
            for root, dirs, files in os.walk(d):
                if root.count("/") - d.count("/") > 4:
                    dirs[:] = []
                for n in files:
                    fp = os.path.join(root, n)
                    try:
                        st = os.lstat(fp)
                    except OSError:
                        continue
                    if st.st_mode & 0o4000 and st.st_uid == 0 and os.path.isfile(fp):
                        dummy = Proc()
                        dummy.pid, dummy.uid, dummy.euid, dummy.exe, dummy.comm, dummy.cmd, dummy.argv0 = 0, 0, 0, fp, n, "", ""
                        dummy.flags = dummy.ppid = dummy.cpu = dummy.start = 0
                        if fp in self.allow_paths:
                            continue
                        try:
                            os.chmod(fp, st.st_mode & ~0o6000)
                            fixed = " Se le quitó el permiso SUID."
                        except OSError:
                            fixed = ""
                        self.alert(dummy, "critico", "suid", "Archivo SUID de root en carpeta temporal",
                                   f"{fp} daría permisos de administrador a quien lo ejecute.{fixed}")

    # ---------------------------------------------------------- antivirus (avisos de ClamAV)
    def check_inbox(self):
        try:
            names = sorted(os.listdir(INBOX))
        except OSError:
            return
        for n in names:
            if n.startswith("."):
                continue
            fp = os.path.join(INBOX, n)
            try:
                ev = json.loads(read(fp) or "{}")
            except ValueError:
                ev = {}
            try:
                os.unlink(fp)
            except OSError:
                pass
            if not ev:
                continue
            path, virus = ev.get("archivo", "?"), ev.get("virus", "?")
            time.sleep(0.3)
            qid = ""
            if os.path.isfile(path):
                qid = quarantine(path, "Virus: " + virus)
            else:
                # clamonacc --move ya lo movio: buscarlo en la cuarentena y registrarlo
                qid = self.register_moved(path, virus)
            ev = {"nivel": "critico", "regla": "virus", "titulo": "Virus bloqueado", "virus": virus,
                  "detalle": f"{virus} en {path}" + (" — aislado en cuarentena." if qid else ""),
                  "exe": path, "cuarentena": qid}
            record(ev)
            self.av_events += 1
            self.events += 1
            self.last = ev
            notify("critico", "☠ Virus bloqueado", f"{virus}\n{path}\n\nEl archivo no se pudo abrir"
                   + (" y quedó en cuarentena." if qid else "."), {"panel": "Abrir Crack Guard"},
                   lambda a: None)
            self.write_state(force=True)

    def register_moved(self, path, virus):
        base = os.path.basename(path)
        cand = os.path.join(QUAR, base)
        if not os.path.isfile(cand):
            return ""
        qid = time.strftime("%Y%m%d-%H%M%S-") + re.sub(r"[^A-Za-z0-9._-]", "_", base)[:60]
        try:
            os.rename(cand, os.path.join(QUAR, qid + ".cuarentena"))
            os.chmod(os.path.join(QUAR, qid + ".cuarentena"), 0)
            with open(os.path.join(QUAR, qid + ".json"), "w") as f:
                json.dump({"id": qid, "original": path, "sha256": "", "motivo": "Virus: " + virus, "uid": -1,
                           "modo": 0o644, "hora": time.strftime("%Y-%m-%d %H:%M:%S")}, f, ensure_ascii=False)
            return qid
        except OSError:
            return ""

    # ---------------------------------------------------------- USB nuevas
    def check_usb(self):
        if self.conf.get("escanear_usb") != "si":
            return
        mounts = set()
        for line in (read("/proc/self/mounts") or "").splitlines():
            f = line.split()
            if len(f) > 2 and f[1].startswith(("/media/", "/run/media/")):
                mounts.add(f[1].replace("\\040", " "))
        new = mounts - self.mounts
        self.mounts = mounts
        if self.first_mounts:
            self.first_mounts = False
            return
        for m in new:
            threading.Thread(target=self.scan_usb, args=(m,), daemon=True).start()

    def scan_usb(self, mount):
        name = os.path.basename(mount)
        notify("medio", "USB conectada: " + name, "Crack Guard la está revisando en busca de virus…")
        record({"nivel": "info", "titulo": "Escaneando USB", "detalle": mount})
        sock = "/run/crackos-av/clamd.sock"
        if os.path.exists(sock):
            cmd = ["clamdscan", "--config-file=/etc/crackos/clamd.conf", "--fdpass", "--multiscan",
                   "--infected", "--no-summary", mount]
        else:
            cmd = ["nice", "-n", "15", "clamscan", "-r", "--infected", "--no-summary", "--max-filesize=100M", mount]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
        except (OSError, subprocess.SubprocessError) as e:
            record({"nivel": "info", "titulo": "No se pudo escanear la USB", "detalle": f"{mount}: {e}"})
            return
        found = [l for l in r.stdout.splitlines() if l.endswith(" FOUND")]
        if not os.path.exists(sock):         # con clamd los avisos llegan solos por VirusEvent
            for l in found:
                path, virus = l[:-6].rsplit(": ", 1)
                self.inbox_put(path, virus)
        if not found:
            notify("medio", "USB limpia: " + name, "No se encontraron virus.")
        record({"nivel": "info", "titulo": "USB escaneada", "detalle": f"{mount}: {len(found)} amenaza(s)"})

    def inbox_put(self, path, virus):
        n = f"{time.time_ns()}-{os.getpid()}"
        with open(os.path.join(INBOX, "." + n), "w") as f:
            json.dump({"archivo": path, "virus": virus}, f)
        os.rename(os.path.join(INBOX, "." + n), os.path.join(INBOX, n + ".json"))

    # ---------------------------------------------------------- estado para la barra y el panel
    def system_status(self):
        if time.time() - self.status_t < 30 and self.status_cache:
            return self.status_cache

        def active(unit):
            try:
                return subprocess.run(["systemctl", "is-active", "--quiet", unit], timeout=5).returncode == 0
            except (OSError, subprocess.SubprocessError):
                return False
        fw = False
        try:
            fw = "Status: active" in subprocess.run(["ufw", "status"], capture_output=True, text=True, timeout=5).stdout
        except (OSError, subprocess.SubprocessError):
            pass
        aa = (read("/sys/module/apparmor/parameters/enabled") or "").strip() == "Y"
        db = 0
        for n in ("daily.cld", "daily.cvd"):
            try:
                db = max(db, int(os.stat("/var/lib/clamav/" + n).st_mtime))
            except OSError:
                pass
        s = {"firewall": fw, "apparmor": aa, "antivirus": active("crackos-clamd"),
             "tiempo_real": active("crackos-clamonacc"), "fail2ban": active("fail2ban"),
             "actualizaciones": os.path.exists("/etc/apt/apt.conf.d/20auto-upgrades"),
             "firmas": time.strftime("%Y-%m-%d %H:%M", time.localtime(db)) if db else ""}
        self.status_cache, self.status_t = s, time.time()
        return s

    def write_state(self, force=False):
        st = {"activo": True, "modo": self.conf.get("modo"), "eventos": self.events, "virus": self.av_events,
              "congelados": [{"pid": k, **{x: v.get(x) for x in ("titulo", "exe", "usuario", "hora", "regla")}}
                             for k, v in self.frozen.items()],
              "ultimo": self.last, "actualizado": int(time.time())}
        if not P:
            st.update(self.system_status())
        tmp = STATE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(st, f, ensure_ascii=False)
        os.chmod(tmp, 0o644)
        os.replace(tmp, STATE)

    # ---------------------------------------------------------- bucle
    def run(self):
        for d in (RUN, os.path.dirname(LOG), QUAR):
            os.makedirs(d, exist_ok=True)
        os.chmod(RUN, 0o755)
        os.makedirs(INBOX, exist_ok=True)
        try:
            import grp
            os.chown(INBOX, 0, grp.getgrnam("clamav").gr_gid)
            os.chmod(INBOX, 0o3770)
        except (KeyError, OSError):
            os.chmod(INBOX, 0o1733)
        os.chmod(QUAR, 0o700)
        if not os.path.exists(ALLOW):
            os.makedirs(os.path.dirname(ALLOW), exist_ok=True)
            with open(ALLOW, "w") as f:
                f.write("# Programas permitidos por Crack Guard (ruta completa o sha256:<hash>)\n")
        record({"nivel": "info", "titulo": "Crack Guard iniciado", "detalle": f"modo {self.conf.get('modo')}"})
        self.boot_done = False
        started = time.time()
        last_t = time.time()
        last_suid = 0
        tick = 0
        while True:
            interval = max(0.5, float(self.conf.get("intervalo", 2)))
            procs = []
            for d in os.listdir("/proc"):
                if d.isdigit():
                    p = Proc.load(int(d))
                    if p:
                        procs.append(p)
            now = time.time()
            with self.lock:
                alive = set()
                for p in procs:
                    alive.add(p.key)
                    if p.key not in self.seen:
                        self.seen[p.key] = True
                        try:
                            self.check_new(p)
                        except Exception as e:  # nunca dejar caer el vigilante
                            log(f"error analizando {p.pid}: {e}")
                for k in list(self.seen):
                    if k not in alive:
                        del self.seen[k]
                for pid in list(self.frozen):     # terminado o reanudado desde el panel
                    if not re.search(r"^State:\s+T", read(f"/proc/{pid}/status") or "", re.M):
                        self.frozen.pop(pid, None)
                self.check_cpu(procs, now - last_t)
                if self.conf.get("vigilar_puertos") == "si" and tick % 3 == 0:
                    self.check_ports(procs)
                if tick % 5 == 0:
                    self.check_files(procs)
                if tick % 2 == 0:
                    self.check_usb()
                if now - last_suid >= float(self.conf.get("suid_cada", 120)):
                    last_suid = now
                    self.check_suid()
                self.check_inbox()
                if tick % 5 == 0:
                    self.write_state()
            if not self.boot_done and now - started > 60:
                self.boot_done = True
            last_t = now
            tick += 1
            time.sleep(interval)


if __name__ == "__main__":
    if os.geteuid() != 0 and not P:
        sys.exit("Crack Guard debe correr como root (servicio crackos-guard).")
    Guard().run()
