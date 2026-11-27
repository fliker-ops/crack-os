#!/usr/bin/env python3
"""Crack OS Remote: agente que deja controlar la PC desde la app Crack Remote (Android).

Se ejecuta como root (servicio crackos-remote.service). Cada accion se hace con los
permisos del usuario que inicio sesion desde el telefono; las acciones peligrosas
(formatear, apagar, reiniciar) exigen que el usuario sea administrador (grupo sudo).

Solo usa la biblioteca estandar de Python (PIL es opcional, para miniaturas).
"""
import asyncio, base64, collections, ctypes, ctypes.util, fcntl, glob, grp, hashlib, hmac
import json, os, pty, pwd, re, secrets, shutil, signal, socket, struct, subprocess, sys
import shlex, termios, threading, time, urllib.parse

VERSION = "1.0"
CONF_FILE = "/etc/crackos/remote.conf"
STATE_DIR = os.environ.get("CRACKOS_REMOTE_STATE", "/var/lib/crackos-remote")
DEFAULT_FACE = "/usr/share/crackos/face.png"
CONF = {"port": 4747, "bind": "0.0.0.0", "enabled": True, "notify_login": True}
MAX_BODY = 600 * 1024 * 1024
LOG_LOCK = threading.Lock()


def log(*a):
    with LOG_LOCK:
        print(time.strftime("%H:%M:%S"), *a, flush=True)


def load_conf():
    try:
        with open(CONF_FILE) as f:
            for line in f:
                line = line.split("#", 1)[0].strip()
                if "=" in line:
                    k, v = [x.strip() for x in line.split("=", 1)]
                    if k == "port":
                        CONF["port"] = int(v)
                    elif k in ("enabled", "notify_login"):
                        CONF[k] = v.lower() in ("1", "yes", "si", "true", "on")
                    elif k == "bind":
                        CONF["bind"] = v
    except FileNotFoundError:
        pass


# --------------------------------------------------------------------- usuarios
_libcrypt = None


def crypt(word, salt):
    global _libcrypt
    if _libcrypt is None:
        name = ctypes.util.find_library("crypt") or "libcrypt.so.1"
        _libcrypt = ctypes.CDLL(name)
        _libcrypt.crypt.restype = ctypes.c_char_p
        _libcrypt.crypt.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
    r = _libcrypt.crypt(word.encode(), salt.encode())
    return r.decode() if r else ""


def shadow_hash(user):
    try:
        with open("/etc/shadow") as f:
            for line in f:
                p = line.rstrip("\n").split(":")
                if p[0] == user:
                    return p[1]
    except OSError:
        pass
    return None


def check_password(user, password):
    h = shadow_hash(user)
    if h is None or h.startswith("!") or h.startswith("*"):
        return False
    if h == "":
        return password == ""
    return hmac.compare_digest(crypt(password, h), h)


def is_admin(user):
    for g in ("sudo", "wheel", "admin"):
        try:
            if user in grp.getgrnam(g).gr_mem:
                return True
        except KeyError:
            pass
    return user == "root"


def real_users():
    out = []
    for p in pwd.getpwall():
        if 1000 <= p.pw_uid < 60000 and not p.pw_shell.endswith(("nologin", "false")):
            full = p.pw_gecos.split(",")[0] or p.pw_name
            out.append({"name": p.pw_name, "full": full, "uid": p.pw_uid,
                        "admin": is_admin(p.pw_name), "online": os.path.isdir(f"/run/user/{p.pw_uid}"),
                        "passwordless": shadow_hash(p.pw_name) == ""})
    return sorted(out, key=lambda u: u["uid"])


def avatar_path(user):
    try:
        home = pwd.getpwnam(user).pw_dir
    except KeyError:
        return DEFAULT_FACE
    for p in (f"{home}/.face", f"{home}/.face.icon", f"/var/lib/AccountsService/icons/{user}"):
        if os.path.isfile(p):
            return p
    return DEFAULT_FACE


def demote(pw):
    def fn():
        os.setsid()
        os.initgroups(pw.pw_name, pw.pw_gid)
        os.setgid(pw.pw_gid)
        os.setuid(pw.pw_uid)
    return fn


def newest(paths):
    paths = [p for p in paths if os.path.exists(p)]
    return max(paths, key=os.path.getmtime) if paths else None


def user_env(pw):
    rt = f"/run/user/{pw.pw_uid}"
    env = {"HOME": pw.pw_dir, "USER": pw.pw_name, "LOGNAME": pw.pw_name, "SHELL": pw.pw_shell,
           "PATH": "/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin",
           "LANG": os.environ.get("LANG", "es_ES.UTF-8"), "XDG_RUNTIME_DIR": rt,
           "DBUS_SESSION_BUS_ADDRESS": f"unix:path={rt}/bus", "TERM": "xterm-256color",
           "XDG_SESSION_TYPE": "wayland"}
    w = newest([s for s in glob.glob(f"{rt}/wayland-*") if not s.endswith(".lock")])
    if w:
        env["WAYLAND_DISPLAY"] = os.path.basename(w)
    h = newest([d for d in glob.glob(f"{rt}/hypr/*") if os.path.exists(d + "/.socket.sock")])
    if h:
        env["HYPRLAND_INSTANCE_SIGNATURE"] = os.path.basename(h)
        env["XDG_CURRENT_DESKTOP"] = "Hyprland"
    s = newest(glob.glob(f"{rt}/sway-ipc.*.sock"))
    if s:
        env["SWAYSOCK"] = s
        env.setdefault("XDG_CURRENT_DESKTOP", "sway")
    if os.path.exists("/tmp/.X11-unix/X0"):
        env["DISPLAY"] = ":0"
    return env


def run_as(pw, cmd, data=None, timeout=15, binary=False):
    """Ejecuta un comando como el usuario dentro de su sesion grafica."""
    r = subprocess.run(cmd, input=data, capture_output=True, timeout=timeout, env=user_env(pw),
                       cwd=pw.pw_dir, preexec_fn=demote(pw), shell=isinstance(cmd, str))
    if binary:
        return r.returncode, r.stdout, r.stderr.decode(errors="replace")
    return r.returncode, r.stdout.decode(errors="replace"), r.stderr.decode(errors="replace")


def spawn_as(pw, cmd, stdin_data=None):
    p = subprocess.Popen(cmd, env=user_env(pw), cwd=pw.pw_dir, preexec_fn=demote(pw),
                         stdin=subprocess.PIPE if stdin_data is not None else subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=isinstance(cmd, str))
    if stdin_data is not None:
        p.stdin.write(stdin_data)
        p.stdin.close()
    return p


def session_kind(pw):
    e = user_env(pw)
    if "HYPRLAND_INSTANCE_SIGNATURE" in e:
        return "hyprland"
    if "SWAYSOCK" in e:
        return "sway"
    if "WAYLAND_DISPLAY" in e:
        return "wayland"
    return None


def notify(pw, title, body, urgency="normal"):
    try:
        spawn_as(pw, ["notify-send", "-a", "Crack Remote", "-u", urgency, "-i", "crackos", title, body])
    except Exception as e:
        log("notify", e)


def chown_user(path, pw):
    try:
        os.chown(path, pw.pw_uid, pw.pw_gid)
    except OSError:
        pass


def user_dir(pw, *parts, create=True):
    d = os.path.join(pw.pw_dir, *parts)
    if create and not os.path.isdir(d):
        cur = pw.pw_dir
        for p in os.path.join(*parts).split("/"):
            cur = os.path.join(cur, p)
            if not os.path.isdir(cur):
                os.mkdir(cur)
                chown_user(cur, pw)
    return d


def write_user_file(pw, path, data):
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(data)
    chown_user(tmp, pw)
    os.replace(tmp, path)


def inside(path, roots):
    rp = os.path.realpath(path)
    return any(rp == r or rp.startswith(r.rstrip("/") + "/") for r in roots)


# --------------------------------------------------------------- sesiones/token
class Sessions:
    def __init__(self):
        self.file = os.path.join(STATE_DIR, "sessions.json")
        self.data = {}
        self.fails = collections.defaultdict(list)
        try:
            with open(self.file) as f:
                self.data = json.load(f)
        except Exception:
            pass

    def save(self):
        os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
        tmp = self.file + ".tmp"
        with open(tmp, "w") as f:
            json.dump(self.data, f)
        os.chmod(tmp, 0o600)
        os.replace(tmp, self.file)

    def limited(self, ip):
        now = time.time()
        self.fails[ip] = [t for t in self.fails[ip] if now - t < 120]
        return len(self.fails[ip]) >= 6

    def fail(self, ip):
        self.fails[ip].append(time.time())

    def create(self, user, device):
        tok = secrets.token_urlsafe(32)
        self.data[hashlib.sha256(tok.encode()).hexdigest()] = {
            "user": user, "device": device[:60], "created": time.time(), "seen": time.time()}
        self.save()
        return tok

    def get(self, tok):
        if not tok:
            return None
        k = hashlib.sha256(tok.encode()).hexdigest()
        s = self.data.get(k)
        if not s or time.time() - s["seen"] > 30 * 86400:
            return None
        if time.time() - s["seen"] > 300:
            s["seen"] = time.time()
            self.save()
        try:
            return pwd.getpwnam(s["user"])
        except KeyError:
            return None

    def drop(self, tok):
        self.data.pop(hashlib.sha256((tok or "").encode()).hexdigest(), None)
        self.save()


SESS = None


# ---------------------------------------------------------------- estadisticas
def read_cpu():
    with open("/proc/stat") as f:
        lines = [l.split() for l in f if l.startswith("cpu")]
    return [(sum(map(int, l[1:])), int(l[4]) + int(l[5])) for l in lines]


def read_mem():
    m = {}
    with open("/proc/meminfo") as f:
        for l in f:
            k, v = l.split(":")
            m[k] = int(v.split()[0]) * 1024
    return m


def read_net():
    rx = tx = 0
    with open("/proc/net/dev") as f:
        for l in list(f)[2:]:
            name, rest = l.split(":", 1)
            if name.strip() == "lo":
                continue
            v = rest.split()
            rx += int(v[0]); tx += int(v[8])
    return rx, tx


def read_disk_io():
    r = w = 0
    with open("/proc/diskstats") as f:
        for l in f:
            v = l.split()
            if re.match(r"^(sd[a-z]+|nvme\d+n\d+|vd[a-z]+|mmcblk\d+)$", v[2]):
                r += int(v[5]) * 512; w += int(v[9]) * 512
    return r, w


def read_temp():
    best = None
    for z in glob.glob("/sys/class/thermal/thermal_zone*/temp") + glob.glob("/sys/class/hwmon/hwmon*/temp1_input"):
        try:
            t = int(open(z).read()) / 1000
            if 5 < t < 130:
                best = max(best or 0, t)
        except Exception:
            pass
    return best


def read_battery():
    for b in glob.glob("/sys/class/power_supply/BAT*"):
        try:
            return {"percent": int(open(b + "/capacity").read()), "status": open(b + "/status").read().strip()}
        except Exception:
            pass
    return None


class Sampler(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.hist = collections.deque(maxlen=900)
        self.cur = {}

    def run(self):
        pc, pn, pd, pt = read_cpu(), read_net(), read_disk_io(), time.time()
        while True:
            time.sleep(1)
            try:
                c, n, d, t = read_cpu(), read_net(), read_disk_io(), time.time()
                dt = max(t - pt, 0.001)
                cores = []
                for (a1, i1), (a0, i0) in zip(c, pc):
                    da = a1 - a0
                    cores.append(round(100 * (1 - (i1 - i0) / da), 1) if da else 0.0)
                m = read_mem()
                used = m["MemTotal"] - m.get("MemAvailable", m["MemFree"])
                s = {"t": round(t, 1), "cpu": cores[0], "cores": cores[1:],
                     "mem": round(100 * used / m["MemTotal"], 1), "mem_used": used, "mem_total": m["MemTotal"],
                     "swap": round(100 * (1 - m["SwapFree"] / m["SwapTotal"]), 1) if m.get("SwapTotal") else 0,
                     "rx": round((n[0] - pn[0]) / dt), "tx": round((n[1] - pn[1]) / dt),
                     "dr": round((d[0] - pd[0]) / dt), "dw": round((d[1] - pd[1]) / dt),
                     "temp": read_temp(), "load": os.getloadavg()[0]}
                self.cur = s
                self.hist.append(s)
                pc, pn, pd, pt = c, n, d, t
            except Exception as e:
                log("sampler", e)


SAMPLER = Sampler()


def system_info(pw):
    osr = {}
    try:
        for l in open("/etc/os-release"):
            if "=" in l:
                k, v = l.rstrip().split("=", 1)
                osr[k] = v.strip('"')
    except Exception:
        pass
    cpu = ""
    try:
        cpu = next(l.split(":", 1)[1].strip() for l in open("/proc/cpuinfo") if l.startswith("model name"))
    except Exception:
        pass
    gpu = ""
    try:
        gpu = next((l.split(": ", 1)[-1] for l in subprocess.run(["lspci"], capture_output=True, text=True,
                    timeout=3).stdout.splitlines() if "VGA" in l or "3D" in l), "")
    except Exception:
        pass
    ips = []
    try:
        out = subprocess.run(["ip", "-4", "-o", "addr"], capture_output=True, text=True, timeout=3).stdout
        ips = [l.split()[3].split("/")[0] for l in out.splitlines() if " lo " not in l]
    except Exception:
        pass
    disk = shutil.disk_usage("/")
    return {"host": socket.gethostname(), "os": osr.get("PRETTY_NAME", "Linux"), "kernel": os.uname().release,
            "uptime": float(open("/proc/uptime").read().split()[0]), "cpu": cpu, "cores": os.cpu_count(),
            "gpu": gpu, "ips": ips, "mem_total": read_mem()["MemTotal"], "battery": read_battery(),
            "root_total": disk.total, "root_used": disk.used, "session": session_kind(pw),
            "user": pw.pw_name, "admin": is_admin(pw.pw_name), "agent": VERSION}


def processes(pw):
    hz = os.sysconf("SC_CLK_TCK")

    def snap():
        r = {}
        for d in os.listdir("/proc"):
            if not d.isdigit():
                continue
            try:
                st = open(f"/proc/{d}/stat").read()
                name = st[st.index("(") + 1:st.rindex(")")]
                f = st[st.rindex(")") + 2:].split()
                r[int(d)] = (name, int(f[11]) + int(f[12]), int(f[21]) * os.sysconf("SC_PAGE_SIZE"))
            except Exception:
                pass
        return r
    a = snap(); t0 = time.time(); time.sleep(0.5); b = snap(); dt = time.time() - t0
    total = read_mem()["MemTotal"]
    out = []
    for pid, (name, ticks, rss) in b.items():
        try:
            uid = os.stat(f"/proc/{pid}").st_uid
            owner = pwd.getpwuid(uid).pw_name
        except Exception:
            continue
        prev = a.get(pid, (name, ticks, 0))[1]
        cpu = 100 * (ticks - prev) / hz / dt
        out.append({"pid": pid, "name": name, "user": owner, "cpu": round(cpu, 1),
                    "mem": round(100 * rss / total, 1), "rss": rss})
    out.sort(key=lambda p: (p["cpu"], p["rss"]), reverse=True)
    return out[:80]


# ---------------------------------------------------------------- aplicaciones
ICON_DIRS = ["/usr/share/icons/Papirus-Dark/64x64/apps", "/usr/share/icons/Papirus/64x64/apps",
             "/usr/share/icons/Papirus-Dark/48x48/apps", "/usr/share/icons/hicolor/256x256/apps",
             "/usr/share/icons/hicolor/128x128/apps", "/usr/share/icons/hicolor/64x64/apps",
             "/usr/share/icons/hicolor/48x48/apps", "/usr/share/icons/hicolor/scalable/apps",
             "/usr/share/icons/Adwaita/scalable/apps", "/usr/share/icons/Adwaita/48x48/apps", "/usr/share/pixmaps"]


def parse_desktop(path):
    d, sect = {}, None
    try:
        for l in open(path, encoding="utf-8", errors="replace"):
            l = l.strip()
            if l.startswith("["):
                sect = l
                continue
            if sect == "[Desktop Entry]" and "=" in l:
                k, v = l.split("=", 1)
                d.setdefault(k.strip(), v.strip())
    except OSError:
        return None
    return d


def list_apps(pw):
    seen, apps = set(), []
    for base in (f"{pw.pw_dir}/.local/share/applications", "/usr/local/share/applications", "/usr/share/applications"):
        for f in sorted(glob.glob(base + "/*.desktop")):
            aid = os.path.basename(f)
            if aid in seen:
                continue
            seen.add(aid)
            d = parse_desktop(f)
            if not d or d.get("Type") != "Application" or d.get("NoDisplay") == "true" or d.get("Hidden") == "true":
                continue
            if "Exec" not in d:
                continue
            name = d.get("Name[es]") or d.get("Name", aid)
            apps.append({"id": aid, "name": name, "comment": d.get("Comment[es]") or d.get("Comment", ""),
                         "icon": d.get("Icon", ""), "cats": [c for c in d.get("Categories", "").split(";") if c],
                         "terminal": d.get("Terminal") == "true"})
    apps.sort(key=lambda a: a["name"].lower())
    return apps


def find_desktop(pw, aid):
    if "/" in aid or not aid.endswith(".desktop"):
        return None
    for base in (f"{pw.pw_dir}/.local/share/applications", "/usr/local/share/applications", "/usr/share/applications"):
        p = os.path.join(base, aid)
        if os.path.isfile(p):
            return parse_desktop(p)
    return None


def find_icon(name):
    if not name or "/" in name and not os.path.isabs(name):
        return None
    if os.path.isabs(name):
        return name if os.path.isfile(name) and name.startswith("/usr/share/") else None
    for d in ICON_DIRS:
        for ext in (".png", ".svg", ".xpm"):
            p = os.path.join(d, name + ext)
            if os.path.isfile(p):
                return p
    hits = glob.glob(f"/usr/share/icons/*/*/apps/{glob.escape(name)}.*")
    return hits[0] if hits else None


def launch(pw, cmd):
    kind = session_kind(pw)
    if kind == "hyprland":
        run_as(pw, ["hyprctl", "dispatch", "exec", cmd], timeout=5)
    elif kind == "sway":
        run_as(pw, ["swaymsg", "exec", f"cd {shlex.quote(pw.pw_dir)} && {cmd}"], timeout=5)
    elif kind == "wayland":
        spawn_as(pw, ["sh", "-c", cmd])
    else:
        raise ApiError(409, "El usuario no tiene una sesión gráfica abierta en la PC")


def launch_app(pw, aid):
    d = find_desktop(pw, aid)
    if not d:
        raise ApiError(404, "Aplicación no encontrada")
    cmd = re.sub(r"%[fFuUdDnNickvm]", "", d["Exec"]).replace("%%", "%").strip()
    if d.get("Terminal") == "true":
        cmd = "kitty -e " + cmd if shutil.which("kitty") else "foot " + cmd
    launch(pw, cmd)
    return {"ok": True, "cmd": cmd}


# ---------------------------------------------------------------- ventanas
def windows(pw):
    kind = session_kind(pw)
    if kind == "hyprland":
        _, out, _ = run_as(pw, ["hyprctl", "clients", "-j"])
        _, ws, _ = run_as(pw, ["hyprctl", "activeworkspace", "-j"])
        cur = json.loads(ws or "{}").get("id")
        wins = [{"id": c["address"], "title": c.get("title", ""), "app": c.get("class", ""),
                 "ws": c.get("workspace", {}).get("id"), "focused": c.get("focusHistoryID") == 0}
                for c in json.loads(out or "[]") if c.get("mapped", True)]
        return {"kind": kind, "windows": wins, "workspace": cur}
    if kind == "sway":
        _, out, _ = run_as(pw, ["swaymsg", "-t", "get_tree", "-r"])
        wins, cur = [], None

        def walk(n, ws):
            nonlocal cur
            if n.get("type") == "workspace":
                ws = n.get("num")
            if n.get("focused") and ws is not None:
                cur = ws
            if n.get("pid") and n.get("type") in ("con", "floating_con"):
                wins.append({"id": str(n["id"]), "title": n.get("name") or "", "ws": ws,
                             "app": n.get("app_id") or (n.get("window_properties") or {}).get("class", ""),
                             "focused": n.get("focused", False)})
            for c in n.get("nodes", []) + n.get("floating_nodes", []):
                walk(c, ws)
        walk(json.loads(out or "{}"), None)
        if cur is None:
            _, o2, _ = run_as(pw, ["swaymsg", "-t", "get_workspaces", "-r"])
            cur = next((w["num"] for w in json.loads(o2 or "[]") if w.get("focused")), 1)
        return {"kind": kind, "windows": wins, "workspace": cur}
    return {"kind": kind, "windows": [], "workspace": None}


def window_action(pw, action, wid=None, ws=None):
    kind = session_kind(pw)
    if wid is not None and not re.match(r"^(0x[0-9a-f]+|\d+)$", str(wid)):
        raise ApiError(400, "id de ventana inválido")
    if kind == "hyprland":
        cmds = {"focus": ["focuswindow", f"address:{wid}"], "close": ["closewindow", f"address:{wid}"],
                "fullscreen": ["fullscreen", "0"], "workspace": ["workspace", str(int(ws or 1))],
                "float": ["togglefloating", f"address:{wid}"]}
        if action == "fullscreen" and wid:
            run_as(pw, ["hyprctl", "dispatch", "focuswindow", f"address:{wid}"])
        run_as(pw, ["hyprctl", "dispatch"] + cmds[action])
    elif kind == "sway":
        cmds = {"focus": f"[con_id={wid}] focus", "close": f"[con_id={wid}] kill",
                "fullscreen": f"[con_id={wid}] fullscreen toggle", "workspace": f"workspace number {int(ws or 1)}",
                "float": f"[con_id={wid}] floating toggle"}
        run_as(pw, ["swaymsg", cmds[action]])
    else:
        raise ApiError(409, "Sin sesión gráfica")
    return {"ok": True}


def screen_size(pw):
    kind = session_kind(pw)
    try:
        if kind == "hyprland":
            m = json.loads(run_as(pw, ["hyprctl", "monitors", "-j"])[1])[0]
            return m["width"], m["height"]
        if kind == "sway":
            m = [o for o in json.loads(run_as(pw, ["swaymsg", "-t", "get_outputs", "-r"])[1]) if o.get("active")][0]
            return m["rect"]["width"], m["rect"]["height"]
    except Exception:
        pass
    return 1920, 1080


def screenshot(pw, scale=0.5, quality=60, fmt="jpeg"):
    if not session_kind(pw):
        raise ApiError(409, "Sin sesión gráfica")
    cmd = ["grim", "-t", fmt]
    if fmt == "jpeg":
        cmd += ["-q", str(int(quality))]
    if scale != 1:
        cmd += ["-s", str(scale)]
    rc, out, err = run_as(pw, cmd + ["-"], binary=True, timeout=10)
    if rc != 0 and fmt == "jpeg":   # grim sin soporte JPEG: PNG y conversion con PIL
        rc, out, err = run_as(pw, ["grim", "-t", "png", "-l", "1"] + (["-s", str(scale)] if scale != 1 else []) + ["-"],
                              binary=True, timeout=10)
        if rc == 0 and out:
            try:
                from PIL import Image
                import io
                b = io.BytesIO()
                Image.open(io.BytesIO(out)).convert("RGB").save(b, "JPEG", quality=int(quality))
                out = b.getvalue()
            except Exception:
                pass
    if rc != 0 or not out:
        raise ApiError(500, "No se pudo capturar la pantalla: " + err[:200])
    return out


# ---------------------------------------------------------------- entrada (raton/teclado)
class Uinput:
    EV_SYN, EV_KEY, EV_REL = 0, 1, 2
    REL_X, REL_Y, REL_HWHEEL, REL_WHEEL = 0, 1, 6, 8
    BTN = {"left": 0x110, "right": 0x111, "middle": 0x112}

    def __init__(self):
        self.fd = None
        try:
            fd = os.open("/dev/uinput", os.O_WRONLY | os.O_NONBLOCK)
        except OSError:
            return
        UI_SET_EVBIT, UI_SET_KEYBIT, UI_SET_RELBIT, UI_DEV_CREATE = 0x40045564, 0x40045565, 0x40045566, 0x5501
        for ev in (self.EV_SYN, self.EV_KEY, self.EV_REL):
            fcntl.ioctl(fd, UI_SET_EVBIT, ev)
        for b in self.BTN.values():
            fcntl.ioctl(fd, UI_SET_KEYBIT, b)
        for r in (self.REL_X, self.REL_Y, self.REL_WHEEL, self.REL_HWHEEL):
            fcntl.ioctl(fd, UI_SET_RELBIT, r)
        name = b"Crack Remote Touchpad".ljust(80, b"\0")
        dev = name + struct.pack("HHHHi", 0x06, 0x1337, 0x0001, 1, 0) + b"\0" * (4 * 64 * 4)
        os.write(fd, dev)
        fcntl.ioctl(fd, UI_DEV_CREATE)
        self.fd = fd
        log("uinput listo")

    def emit(self, t, c, v):
        os.write(self.fd, struct.pack("llHHi", 0, 0, t, c, v))

    def syn(self):
        self.emit(self.EV_SYN, 0, 0)

    def move(self, dx, dy):
        self.emit(self.EV_REL, self.REL_X, int(dx)); self.emit(self.EV_REL, self.REL_Y, int(dy)); self.syn()

    def button(self, b, state):
        self.emit(self.EV_KEY, self.BTN[b], 1 if state else 0); self.syn()

    def scroll(self, dy, dx=0):
        if dy:
            self.emit(self.EV_REL, self.REL_WHEEL, int(dy))
        if dx:
            self.emit(self.EV_REL, self.REL_HWHEEL, int(dx))
        self.syn()


UINPUT = None
SWAY_BTN = {"left": "button1", "middle": "button2", "right": "button3"}
KEY_NAMES = {"enter": "Return", "esc": "Escape", "tab": "Tab", "backspace": "BackSpace", "delete": "Delete",
             "up": "Up", "down": "Down", "left": "Left", "right": "Right", "home": "Home", "end": "End",
             "pageup": "Prior", "pagedown": "Next", "space": "space", "super": "Super_L", "print": "Print",
             "volup": "XF86AudioRaiseVolume", "voldown": "XF86AudioLowerVolume", "mute": "XF86AudioMute",
             "play": "XF86AudioPlay", "next": "XF86AudioNext", "prev": "XF86AudioPrev"}
for i in range(1, 13):
    KEY_NAMES[f"f{i}"] = f"F{i}"


def handle_input(pw, m, sway_acc):
    t = m.get("t")
    if t in ("move", "click", "down", "up", "scroll"):
        if UINPUT and UINPUT.fd is not None:
            if t == "move":
                UINPUT.move(m.get("dx", 0), m.get("dy", 0))
            elif t == "click":
                b = m.get("b", "left")
                for _ in range(int(m.get("n", 1))):
                    UINPUT.button(b, 1); UINPUT.button(b, 0)
            elif t in ("down", "up"):
                UINPUT.button(m.get("b", "left"), t == "down")
            else:
                UINPUT.scroll(-int(m.get("dy", 0)), int(m.get("dx", 0)))
            return
        kind = session_kind(pw)
        if kind == "sway":
            if t == "move":
                sway_acc[0] += m.get("dx", 0); sway_acc[1] += m.get("dy", 0)
                dx, dy = int(sway_acc[0]), int(sway_acc[1])
                if dx or dy:
                    sway_acc[0] -= dx; sway_acc[1] -= dy
                    run_as(pw, ["swaymsg", "seat", "-", "cursor", "move", str(dx), str(dy)])
            elif t == "click":
                b = SWAY_BTN.get(m.get("b", "left"), "button1")
                for _ in range(int(m.get("n", 1))):
                    run_as(pw, ["swaymsg", "seat", "-", "cursor", "press", b])
                    run_as(pw, ["swaymsg", "seat", "-", "cursor", "release", b])
            elif t in ("down", "up"):
                run_as(pw, ["swaymsg", "seat", "-", "cursor", "press" if t == "down" else "release",
                            SWAY_BTN.get(m.get("b", "left"), "button1")])
            else:
                b = "button4" if m.get("dy", 0) < 0 else "button5"
                for _ in range(min(abs(int(m.get("dy", 0))), 10)):
                    run_as(pw, ["swaymsg", "seat", "-", "cursor", "press", b])
                    run_as(pw, ["swaymsg", "seat", "-", "cursor", "release", b])
            return
        if kind == "hyprland" and t == "move":
            return
        raise ApiError(409, "El ratón remoto necesita /dev/uinput")
    if t == "text":
        txt = str(m.get("text", ""))[:2000]
        if txt:
            run_as(pw, ["wtype", "--", txt])
    elif t == "key":
        key = KEY_NAMES.get(str(m.get("key", "")).lower(), m.get("key"))
        if not re.match(r"^[A-Za-z0-9_]+$", str(key)):
            raise ApiError(400, "tecla inválida")
        mods = [x for x in m.get("mods", []) if x in ("ctrl", "alt", "shift", "logo")]
        cmd = ["wtype"]
        for x in mods:
            cmd += ["-M", x]
        cmd += ["-k", key]
        for x in reversed(mods):
            cmd += ["-m", x]
        run_as(pw, cmd)


# ---------------------------------------------------------------- multimedia y energia
def volume(pw, set_to=None, mute=None):
    if set_to is not None:
        v = max(0, min(150, int(set_to)))
        if shutil.which("wpctl"):
            run_as(pw, ["wpctl", "set-volume", "-l", "1.5", "@DEFAULT_AUDIO_SINK@", f"{v / 100:.2f}"])
        else:
            run_as(pw, ["pamixer", "--allow-boost", "--set-volume", str(v)])
    if mute is not None:
        if shutil.which("wpctl"):
            run_as(pw, ["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", "1" if mute else "0"])
        else:
            run_as(pw, ["pamixer", "-m" if mute else "-u"])
    if shutil.which("wpctl"):
        rc, out, _ = run_as(pw, ["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"])
        mm = re.search(r"([\d.]+)", out)
        if rc == 0 and mm:
            return {"volume": round(float(mm.group(1)) * 100), "muted": "MUTED" in out}
    if shutil.which("pamixer"):
        rc, out, _ = run_as(pw, ["pamixer", "--get-volume"])
        rc2, out2, _ = run_as(pw, ["pamixer", "--get-mute"])
        if rc in (0, 1) and out.strip().isdigit():
            return {"volume": int(out), "muted": out2.strip() == "true"}
    return {"volume": None, "muted": None, "error": "sin audio"}


def brightness(set_to=None):
    if not shutil.which("brightnessctl"):
        return {"brightness": None}
    if set_to is not None:
        subprocess.run(["brightnessctl", "-q", "set", f"{max(1, min(100, int(set_to)))}%"], timeout=5)
    out = subprocess.run(["brightnessctl", "-m"], capture_output=True, text=True, timeout=5).stdout
    p = out.strip().split(",")
    if len(p) >= 4 and p[1] == "backlight":
        return {"brightness": int(p[3].rstrip("%"))}
    return {"brightness": None}


def media(pw, action=None):
    if not shutil.which("playerctl"):
        return {"player": None}
    if action in ("play-pause", "next", "previous", "stop"):
        run_as(pw, ["playerctl", action])
        time.sleep(0.3)
    rc, out, _ = run_as(pw, ["playerctl", "metadata", "--format", "{{status}}\t{{artist}}\t{{title}}\t{{playerName}}"])
    if rc != 0 or not out.strip():
        return {"player": None}
    st, artist, title, name = (out.strip().split("\t") + ["", "", "", ""])[:4]
    return {"player": name, "status": st, "artist": artist, "title": title}


def power(pw, action):
    admin = is_admin(pw.pw_name)
    if action == "lock":
        cmd = "crackos-lock" if shutil.which("crackos-lock") else "loginctl lock-session"
        spawn_as(pw, ["sh", "-c", cmd])
    elif action == "logout":
        k = session_kind(pw)
        if k == "hyprland":
            run_as(pw, ["hyprctl", "dispatch", "exit"])
        elif k == "sway":
            run_as(pw, ["swaymsg", "exit"])
        else:
            raise ApiError(409, "Sin sesión gráfica")
    elif action in ("suspend", "reboot", "poweroff"):
        if action != "suspend" and not admin:
            raise ApiError(403, "Solo un administrador puede apagar o reiniciar")
        notify(pw, "Crack Remote", {"suspend": "Suspendiendo", "reboot": "Reiniciando",
                                    "poweroff": "Apagando"}[action] + " desde el teléfono…", "critical")
        threading.Timer(2.0, lambda: subprocess.run(["systemctl", action])).start()
    else:
        raise ApiError(400, "acción desconocida")
    return {"ok": True}


# ---------------------------------------------------------------- fondos de pantalla
def wallpapers(pw):
    cur = ""
    try:
        cur = open(f"{pw.pw_dir}/.config/crackos/wallpaper").read().strip()
    except Exception:
        pass
    items = []
    for p in sorted(glob.glob("/usr/share/backgrounds/crackos/*.png")):
        if re.search(r"-(safe|login)\.png$", p):
            continue
        items.append({"path": p, "name": os.path.basename(p).rsplit(".", 1)[0].replace("crackos-", "").title(),
                      "system": True})
    for ext in ("png", "jpg", "jpeg"):
        for p in sorted(glob.glob(f"{pw.pw_dir}/Imágenes/Fondos/*.{ext}")):
            items.append({"path": p, "name": os.path.basename(p).rsplit(".", 1)[0], "system": False})
    if not cur and items:
        cur = "/usr/share/backgrounds/crackos/crackos-wallpaper.png"
    w, h = screen_size(pw)
    return {"items": items, "current": cur, "screen": [w, h]}


def wallpaper_allowed(pw, path):
    return inside(path, ["/usr/share/backgrounds", f"{pw.pw_dir}/Imágenes", pw.pw_dir]) and os.path.isfile(path)


THUMBS = {}


def thumbnail(path, width):
    key = (path, width, os.path.getmtime(path))
    if key in THUMBS:
        return THUMBS[key]
    data, ctype = None, "image/png"
    try:
        from PIL import Image
        import io
        im = Image.open(path).convert("RGB")
        im.thumbnail((width, width * 4))
        b = io.BytesIO(); im.save(b, "JPEG", quality=82)
        data, ctype = b.getvalue(), "image/jpeg"
    except Exception:
        if shutil.which("ffmpeg"):
            r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={width}:-2", "-f", "image2pipe",
                                "-vcodec", "mjpeg", "-q:v", "4", "-"], capture_output=True, timeout=20)
            if r.returncode == 0 and r.stdout:
                data, ctype = r.stdout, "image/jpeg"
    if data is None:
        data = open(path, "rb").read()
        ctype = "image/jpeg" if path.lower().endswith(("jpg", "jpeg")) else "image/png"
    if len(THUMBS) > 60:
        THUMBS.clear()
    THUMBS[key] = (data, ctype)
    return data, ctype


def set_wallpaper(pw, path):
    if not wallpaper_allowed(pw, path):
        raise ApiError(400, "Fondo no permitido")
    d = user_dir(pw, ".config", "crackos")
    write_user_file(pw, os.path.join(d, "wallpaper"), (path + "\n").encode())
    if not session_kind(pw):
        return {"ok": True, "applied": False}
    if shutil.which("crackos-wallpaper"):
        spawn_as(pw, ["crackos-wallpaper", path])
    else:
        spawn_as(pw, ["sh", "-c", 'pkill -x -u "$USER" swaybg; exec swaybg -m fill -i "$0"', path])
    return {"ok": True, "applied": True}


# ---------------------------------------------------------------- archivos, tareas, tokens
def file_roots(pw):
    return [pw.pw_dir, f"/media/{pw.pw_name}", "/mnt"]


def list_dir(pw, path):
    path = path or pw.pw_dir
    if not inside(path, file_roots(pw)) or not os.path.isdir(path):
        raise ApiError(403, "Carpeta no permitida")
    items = []
    for e in os.scandir(path):
        if e.name.startswith("."):
            continue
        try:
            st = e.stat()
            items.append({"name": e.name, "dir": e.is_dir(), "size": st.st_size, "mtime": st.st_mtime})
        except OSError:
            pass
    items.sort(key=lambda x: (not x["dir"], x["name"].lower()))
    return {"path": os.path.realpath(path), "home": pw.pw_dir, "items": items[:500]}


def tasks_file(pw):
    return os.path.join(user_dir(pw, ".config", "crackos"), "tareas.json")


def load_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def token_usage(pw):
    since = time.time() - 31 * 86400
    seen = set()
    days = collections.defaultdict(lambda: {"in": 0, "out": 0, "cache": 0})
    models = collections.Counter()
    recent = []
    files = glob.glob(f"{pw.pw_dir}/.claude/projects/*/*.jsonl") + glob.glob(f"{pw.pw_dir}/.config/claude/projects/*/*.jsonl")
    for f in files:
        try:
            if os.path.getmtime(f) < since:
                continue
            for line in open(f, encoding="utf-8", errors="replace"):
                if '"usage"' not in line:
                    continue
                try:
                    j = json.loads(line)
                except Exception:
                    continue
                msg = j.get("message") or {}
                u = msg.get("usage")
                ts = j.get("timestamp")
                if not u or not ts:
                    continue
                key = (msg.get("id"), j.get("requestId"))
                if key[0] and key in seen:
                    continue
                seen.add(key)
                t = time.mktime(time.strptime(ts[:19], "%Y-%m-%dT%H:%M:%S")) - time.timezone
                if t < since:
                    continue
                inp = u.get("input_tokens", 0); out = u.get("output_tokens", 0)
                cache = u.get("cache_creation_input_tokens", 0) + u.get("cache_read_input_tokens", 0)
                day = time.strftime("%Y-%m-%d", time.localtime(t))
                days[day]["in"] += inp; days[day]["out"] += out; days[day]["cache"] += cache
                models[msg.get("model", "?")] += inp + out
                recent.append((t, inp + out))
        except OSError:
            pass
    now = time.time()
    hours = [0] * 24
    for t, n in recent:
        h = int((now - t) // 3600)
        if h < 24:
            hours[23 - h] += n
    cfg = load_json(os.path.join(pw.pw_dir, ".config/crackos/tokens.json"), {})
    win5 = sum(n for t, n in recent if now - t < 5 * 3600)
    month = sum(n for t, n in recent if now - t < 30 * 86400)
    return {"source": "Claude Code (~/.claude)", "found": bool(files),
            "days": [{"day": d, **v} for d, v in sorted(days.items())], "hours": hours,
            "models": dict(models.most_common(6)), "window5h": win5, "month": month,
            "limit5h": cfg.get("limit5h"), "limitMonth": cfg.get("limitMonth")}


# ---------------------------------------------------------------- discos
PROTECTED_MOUNTS = ("/", "/boot", "/boot/efi", "/efi", "/home", "/usr", "/var", "/run/live/medium",
                    "/lib/live/mount/medium", "/run/initramfs/live", "[SWAP]")


def lsblk():
    out = subprocess.run(["lsblk", "-J", "-b", "-o", "NAME,PATH,SIZE,TYPE,FSTYPE,LABEL,UUID,MOUNTPOINTS,MODEL,"
                          "TRAN,RM,RO,PARTTYPENAME,FSAVAIL,FSUSED"], capture_output=True, text=True, timeout=10)
    return json.loads(out.stdout or '{"blockdevices": []}')["blockdevices"]


def blkid_fill(d):
    """lsblk depende de udev para FSTYPE/LABEL; si falta, se pregunta a blkid."""
    if d.get("fstype") or d.get("children"):
        return
    try:
        out = subprocess.run(["blkid", "-o", "export", d["path"]], capture_output=True, text=True, timeout=5).stdout
        kv = dict(l.split("=", 1) for l in out.splitlines() if "=" in l)
        d["fstype"] = kv.get("TYPE") or (kv.get("PTTYPE") and None)
        d["label"] = kv.get("LABEL") or d.get("label")
    except Exception:
        pass


def disk_tree():
    devs = lsblk()
    for d in devs:
        blkid_fill(d)
        for c in d.get("children") or []:
            blkid_fill(c)

    def mounts(d):
        return [m for m in (d.get("mountpoints") or []) if m]

    def all_mounts(d):
        r = mounts(d)
        for c in d.get("children") or []:
            r += all_mounts(c)
        return r

    def prot_reason(d):
        ms = all_mounts(d)
        for m in ms:
            if m in PROTECTED_MOUNTS:
                return f"contiene {m} (sistema en uso)"
        if d.get("ro"):
            return "solo lectura"
        return None

    out = []
    test_loop = os.environ.get("CRACKOS_REMOTE_TEST_LOOP")   # solo para pruebas con imagenes de disco
    for d in devs:
        if d["type"] == "loop":
            if not test_loop or not d.get("size"):
                continue
        elif d["type"] != "disk" or d["name"].startswith(("zram", "sr", "ram")):
            continue
        disk_prot = prot_reason(d)
        parts = []
        for c in d.get("children") or []:
            parts.append({"name": c["name"], "path": c["path"], "size": c["size"], "fstype": c.get("fstype"),
                          "label": c.get("label"), "mounts": all_mounts(c), "type": c.get("parttypename") or c["type"],
                          "used": c.get("fsused"), "avail": c.get("fsavail"), "protected": prot_reason(c)})
        out.append({"name": d["name"], "path": d["path"], "size": d["size"], "model": (d.get("model") or "").strip(),
                    "tran": d.get("tran"), "removable": bool(d.get("rm")), "fstype": d.get("fstype"),
                    "label": d.get("label"), "mounts": mounts(d), "protected": disk_prot, "parts": parts})
    return out


def find_dev(path):
    for d in disk_tree():
        if d["path"] == path:
            return d, None
        for p in d["parts"]:
            if p["path"] == path:
                return p, d
    return None, None


FORMAT_TICKETS, JOBS = {}, {}
FS_CMDS = {"ext4": lambda dev, lab: ["mkfs.ext4", "-F", "-L", lab[:16], dev],
           "fat32": lambda dev, lab: ["mkfs.vfat", "-F", "32", "-n", lab[:11].upper(), dev],
           "exfat": lambda dev, lab: ["mkfs.exfat", "-L", lab[:15], dev],
           "ntfs": lambda dev, lab: ["mkfs.ntfs", "-f", "-L", lab[:32], dev]}


def format_prepare(pw, b):
    if not is_admin(pw.pw_name):
        raise ApiError(403, "Solo un administrador puede formatear")
    path, fs = b.get("path", ""), b.get("fstype", "ext4")
    label = re.sub(r"[^A-Za-z0-9_-]", "", b.get("label") or "CRACK")[:16] or "CRACK"
    if fs not in FS_CMDS:
        raise ApiError(400, "Sistema de archivos no soportado")
    dev, parent = find_dev(path)
    if not dev:
        raise ApiError(404, "Dispositivo no encontrado")
    if dev.get("protected") or (parent and parent.get("protected") and not parent.get("parts")):
        raise ApiError(423, "Protegido: " + (dev.get("protected") or parent.get("protected")))
    whole = parent is None
    if whole and any(p.get("protected") for p in dev.get("parts", [])):
        raise ApiError(423, "Ese disco tiene particiones del sistema en uso")
    tid = secrets.token_hex(8)
    name = os.path.basename(path)
    FORMAT_TICKETS[tid] = {"user": pw.pw_name, "path": path, "fs": fs, "label": label, "whole": whole,
                           "size": dev["size"], "created": time.time(), "phrase": f"FORMATEAR {name}"}
    return {"ticket": tid, "phrase": f"FORMATEAR {name}", "wait": 5, "whole": whole, "size": dev["size"],
            "label": label, "fstype": fs, "mounts": dev.get("mounts", [])}


def run_format_job(jid, t, pw):
    job = JOBS[jid]

    def step(msg):
        job["log"].append(msg)
        log("format", jid, msg)

    def sh(cmd):
        step("$ " + " ".join(cmd))
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        if r.stdout.strip():
            job["log"].extend(r.stdout.strip().splitlines()[-4:])
        if r.returncode != 0:
            raise RuntimeError((r.stderr or r.stdout).strip()[-300:] or f"falló {cmd[0]}")
    try:
        dev = t["path"]
        job["progress"] = 10
        for line in subprocess.run(["lsblk", "-nrpo", "NAME,MOUNTPOINT", dev], capture_output=True, text=True).stdout.splitlines():
            parts = line.split(" ", 1)
            if len(parts) == 2 and parts[1].strip():
                sh(["umount", "-l", parts[0]])
        job["progress"] = 25
        target = dev
        if t["whole"]:
            sh(["wipefs", "-a", dev])
            ptype = "0700" if t["fs"] != "ext4" else "8300"
            step("creando tabla GPT con una partición")
            r = subprocess.run(["sfdisk", "--label", "gpt", dev], input="type=" +
                               ("EBD0A0A2-B9E5-4433-87C0-68B6B72699C7" if ptype == "0700" else "0FC63DAF-8483-4772-8E79-3D69D8477DE4") + "\n",
                               capture_output=True, text=True, timeout=60)
            if r.returncode != 0:
                raise RuntimeError(r.stderr.strip()[-300:])
            subprocess.run(["partprobe", dev], capture_output=True)
            subprocess.run(["udevadm", "settle"], capture_output=True)
            time.sleep(1)
            kids = subprocess.run(["lsblk", "-nrpo", "NAME,TYPE", dev], capture_output=True, text=True).stdout.split("\n")
            parts = [k.split()[0] for k in kids if k.endswith(" part")]
            if not parts and os.path.exists(dev + "p1"):
                parts = [dev + "p1"]
            if parts:
                target = parts[0]
            else:   # sin udev (o el kernel no vio la particion): se formatea el dispositivo completo
                step("no apareció la partición nueva; se formatea el dispositivo completo")
                sh(["wipefs", "-a", dev])
                target = dev
        else:
            sh(["wipefs", "-a", dev])
        job["progress"] = 50
        sh(FS_CMDS[t["fs"]](target, t["label"]))
        job["progress"] = 90
        if t["fs"] == "ext4":
            mp = f"/run/crackos-remote-{jid}"
            os.makedirs(mp, exist_ok=True)
            if subprocess.run(["mount", target, mp]).returncode == 0:
                os.chown(mp, pw.pw_uid, pw.pw_gid)
                subprocess.run(["umount", mp])
            os.rmdir(mp)
        job["progress"] = 100
        job["state"] = "ok"
        step(f"listo: {target} formateado como {t['fs']} ({t['label']})")
        notify(pw, "Crack Remote", f"{target} formateado como {t['fs']}")
    except Exception as e:
        job["state"] = "error"
        step("ERROR: " + str(e))


def format_confirm(pw, b):
    t = FORMAT_TICKETS.pop(b.get("ticket", ""), None)
    if not t or t["user"] != pw.pw_name:
        raise ApiError(400, "Confirmación vencida, empieza de nuevo")
    age = time.time() - t["created"]
    if age < 5:
        raise ApiError(400, "Espera unos segundos y vuelve a confirmar")
    if age > 180:
        raise ApiError(400, "Confirmación vencida, empieza de nuevo")
    if b.get("phrase", "").strip() != t["phrase"]:
        raise ApiError(400, f'Escribe exactamente: {t["phrase"]}')
    if not check_password(pw.pw_name, b.get("password", "")):
        raise ApiError(401, "Contraseña incorrecta")
    dev, parent = find_dev(t["path"])
    if not dev or dev["size"] != t["size"] or dev.get("protected"):
        raise ApiError(409, "El dispositivo cambió; revisa otra vez")
    jid = secrets.token_hex(6)
    JOBS[jid] = {"state": "running", "progress": 0, "log": [], "path": t["path"]}
    notify(pw, "Crack Remote", f"Formateando {t['path']} desde el teléfono", "critical")
    threading.Thread(target=run_format_job, args=(jid, t, pw), daemon=True).start()
    return {"job": jid}


# ---------------------------------------------------------------- HTTP / WebSocket
class ApiError(Exception):
    def __init__(self, code, msg):
        super().__init__(msg)
        self.code, self.msg = code, msg


class Request:
    def __init__(self, method, path, query, headers, body, peer):
        self.method, self.path, self.query, self.headers, self.body, self.peer = method, path, query, headers, body, peer

    def json(self):
        try:
            return json.loads(self.body or b"{}")
        except Exception:
            raise ApiError(400, "JSON inválido")

    def q(self, k, d=None):
        return self.query.get(k, [d])[0]

    def token(self):
        a = self.headers.get("authorization", "")
        return a[7:] if a.lower().startswith("bearer ") else self.q("t")


CORS = (b"Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Authorization, Content-Type\r\n"
        b"Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\nAccess-Control-Max-Age: 86400\r\n")
STATUS = {200: "OK", 204: "No Content", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
          409: "Conflict", 413: "Too Large", 423: "Locked", 429: "Too Many Requests", 500: "Error"}


async def respond(w, code, body=b"", ctype="application/json", extra=b""):
    if isinstance(body, (dict, list)):
        body = json.dumps(body, ensure_ascii=False).encode()
    head = f"HTTP/1.1 {code} {STATUS.get(code, 'OK')}\r\nContent-Type: {ctype}\r\nContent-Length: {len(body)}\r\n"
    w.write(head.encode() + CORS + extra + b"Connection: keep-alive\r\n\r\n" + body)
    await w.drain()


class WS:
    def __init__(self, r, w):
        self.r, self.w = r, w
        self.closed = False

    async def recv(self):
        buf, op0 = b"", None
        while True:
            h = await self.r.readexactly(2)
            fin, op = h[0] & 0x80, h[0] & 0x0F
            ln = h[1] & 0x7F
            if ln == 126:
                ln = struct.unpack(">H", await self.r.readexactly(2))[0]
            elif ln == 127:
                ln = struct.unpack(">Q", await self.r.readexactly(8))[0]
            if ln > 16 * 1024 * 1024:
                raise ConnectionError("frame grande")
            mask = await self.r.readexactly(4) if h[1] & 0x80 else b"\0\0\0\0"
            data = bytearray(await self.r.readexactly(ln))
            for i in range(ln):
                data[i] ^= mask[i % 4]
            if op == 8:
                self.closed = True
                return None
            if op == 9:
                await self.send(bytes(data), 10)
                continue
            if op == 10:
                continue
            if op != 0:
                op0 = op
            buf += data
            if fin:
                return buf.decode(errors="replace") if op0 == 1 else bytes(buf)

    async def send(self, data, op=None):
        if self.closed:
            return
        if isinstance(data, str):
            data, op = data.encode(), op or 1
        op = op or 2
        n = len(data)
        head = bytes([0x80 | op])
        head += bytes([n]) if n < 126 else (bytes([126]) + struct.pack(">H", n) if n < 65536 else bytes([127]) + struct.pack(">Q", n))
        self.w.write(head + data)
        await self.w.drain()


# --------------- terminal remota (PTY)
async def ws_terminal(ws, pw, req):
    cols, rows = int(req.q("cols", "80")), int(req.q("rows", "24"))
    pid, fd = pty.fork()
    if pid == 0:
        try:
            env = user_env(pw)
            env["COLORTERM"] = "truecolor"
            os.initgroups(pw.pw_name, pw.pw_gid)
            os.setgid(pw.pw_gid)
            os.setuid(pw.pw_uid)
            os.chdir(pw.pw_dir)
            shell = pw.pw_shell if os.path.exists(pw.pw_shell) else "/bin/bash"
            os.execvpe(shell, ["-" + os.path.basename(shell)], env)
        except Exception as e:
            os.write(2, str(e).encode())
        os._exit(1)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    loop = asyncio.get_running_loop()
    q = asyncio.Queue()

    def readable():
        try:
            data = os.read(fd, 65536)
        except OSError:
            data = b""
        q.put_nowait(data)
        if not data:
            loop.remove_reader(fd)
    loop.add_reader(fd, readable)

    async def pump():
        while True:
            data = await q.get()
            if not data:
                await ws.send(json.dumps({"t": "exit"}))
                return
            await ws.send(data)
    task = asyncio.create_task(pump())
    try:
        while not task.done():
            m = await ws.recv()
            if m is None:
                break
            if isinstance(m, bytes):
                os.write(fd, m)
                continue
            try:
                j = json.loads(m)
            except Exception:
                os.write(fd, m.encode())
                continue
            if j.get("t") == "in":
                os.write(fd, j.get("d", "").encode())
            elif j.get("t") == "resize":
                fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", int(j["rows"]), int(j["cols"]), 0, 0))
    except (asyncio.IncompleteReadError, ConnectionError, OSError):
        pass
    finally:
        task.cancel()
        try:
            loop.remove_reader(fd)
        except Exception:
            pass
        try:
            os.kill(pid, signal.SIGHUP)
        except OSError:
            pass
        os.close(fd)
        try:
            os.waitpid(pid, os.WNOHANG)
        except ChildProcessError:
            pass


async def ws_input(ws, pw, req):
    acc = [0.0, 0.0]
    while True:
        m = await ws.recv()
        if m is None:
            return
        try:
            j = json.loads(m)
            await asyncio.to_thread(handle_input, pw, j, acc)
        except ApiError as e:
            await ws.send(json.dumps({"t": "error", "msg": e.msg}))
        except Exception as e:
            log("input", e)


async def ws_stats(ws, pw, req):
    async def reader():
        while await ws.recv() is not None:
            pass
    rt = asyncio.create_task(reader())
    try:
        while not rt.done():
            await ws.send(json.dumps(SAMPLER.cur))
            await asyncio.sleep(1)
    finally:
        rt.cancel()


# --------------- rutas
ROUTES = {}


def route(method, path, auth=True):
    def deco(fn):
        ROUTES[(method, path)] = (fn, auth)
        return fn
    return deco


@route("GET", "/api/hello", auth=False)
def r_hello(req, pw):
    return {"name": socket.gethostname(), "os": "Crack OS", "agent": VERSION, "port": CONF["port"],
            "users": len(real_users())}


@route("GET", "/api/users", auth=False)
def r_users(req, pw):
    return {"host": socket.gethostname(), "users": real_users()}


@route("GET", "/api/avatar", auth=False)
def r_avatar(req, pw):
    p = avatar_path(req.q("user", ""))
    data = open(p, "rb").read()
    return ("raw", data, "image/png" if data[:4] == b"\x89PNG" else "image/jpeg")


@route("POST", "/api/login", auth=False)
def r_login(req, pw):
    b = req.json()
    ip = req.peer
    if SESS.limited(ip):
        raise ApiError(429, "Demasiados intentos. Espera 2 minutos.")
    user = b.get("user", "")
    if user not in [u["name"] for u in real_users()] or not check_password(user, b.get("password", "")):
        SESS.fail(ip)
        log("login fallido", user, ip)
        time.sleep(1)
        raise ApiError(401, "Usuario o contraseña incorrectos")
    tok = SESS.create(user, b.get("device", "teléfono"))
    p = pwd.getpwnam(user)
    log("login", user, ip)
    if CONF["notify_login"]:
        notify(p, "Teléfono conectado", f"{b.get('device', 'Un teléfono')} inició sesión como {user} ({ip})")
    return {"token": tok, "user": user, "admin": is_admin(user), "host": socket.gethostname()}


@route("POST", "/api/logout")
def r_logout(req, pw):
    SESS.drop(req.token())
    return {"ok": True}


@route("GET", "/api/system")
def r_system(req, pw):
    return system_info(pw)


@route("GET", "/api/stats")
def r_stats(req, pw):
    n = int(req.q("n", "300"))
    return {"cur": SAMPLER.cur, "hist": list(SAMPLER.hist)[-n:]}


@route("GET", "/api/processes")
def r_procs(req, pw):
    return {"procs": processes(pw)}


@route("POST", "/api/processes/kill")
def r_kill(req, pw):
    b = req.json()
    pid = int(b.get("pid", 0))
    if pid <= 1:
        raise ApiError(400, "PID inválido")
    try:
        uid = os.stat(f"/proc/{pid}").st_uid
    except FileNotFoundError:
        raise ApiError(404, "El proceso ya no existe")
    if uid != pw.pw_uid and not is_admin(pw.pw_name):
        raise ApiError(403, "Ese proceso es de otro usuario")
    os.kill(pid, signal.SIGKILL if b.get("force") else signal.SIGTERM)
    return {"ok": True}


@route("GET", "/api/apps")
def r_apps(req, pw):
    return {"apps": list_apps(pw)}


@route("GET", "/api/icon")
def r_icon(req, pw):
    p = find_icon(req.q("name", ""))
    if not p:
        raise ApiError(404, "sin icono")
    ct = "image/svg+xml" if p.endswith(".svg") else "image/png"
    return ("raw", open(p, "rb").read(), ct, b"Cache-Control: max-age=86400\r\n")


@route("POST", "/api/apps/launch")
def r_launch(req, pw):
    b = req.json()
    if b.get("id"):
        return launch_app(pw, b["id"])
    cmd = b.get("cmd", "").strip()
    if not cmd:
        raise ApiError(400, "Falta el comando")
    launch(pw, cmd)
    return {"ok": True}


@route("GET", "/api/windows")
def r_windows(req, pw):
    return windows(pw)


@route("POST", "/api/windows")
def r_window_action(req, pw):
    b = req.json()
    if b.get("action") not in ("focus", "close", "fullscreen", "workspace", "float"):
        raise ApiError(400, "acción inválida")
    return window_action(pw, b["action"], b.get("id"), b.get("ws"))


@route("GET", "/api/screen")
def r_screen(req, pw):
    scale = min(1.0, max(0.1, float(req.q("scale", "0.4"))))
    fmt = "png" if req.q("fmt") == "png" else "jpeg"
    return ("raw", screenshot(pw, scale, int(req.q("q", "55")), fmt), "image/" + fmt, b"Cache-Control: no-store\r\n")


@route("POST", "/api/screenshot")
def r_screenshot_save(req, pw):
    data = screenshot(pw, 1, fmt="png")
    d = user_dir(pw, "Imágenes", "Capturas")
    p = os.path.join(d, time.strftime("captura-remota-%Y%m%d-%H%M%S.png"))
    write_user_file(pw, p, data)
    return {"ok": True, "path": p}


@route("GET", "/api/volume")
def r_vol(req, pw):
    return {**volume(pw), **brightness()}


@route("POST", "/api/volume")
def r_vol_set(req, pw):
    b = req.json()
    v = volume(pw, b.get("volume"), b.get("muted"))
    br = brightness(b.get("brightness"))
    return {**v, **br}


@route("GET", "/api/media")
def r_media(req, pw):
    return media(pw)


@route("POST", "/api/media")
def r_media_set(req, pw):
    return media(pw, req.json().get("action"))


@route("POST", "/api/power")
def r_power(req, pw):
    return power(pw, req.json().get("action"))


@route("GET", "/api/wallpapers")
def r_wps(req, pw):
    return wallpapers(pw)


@route("GET", "/api/wallpaper/image")
def r_wp_img(req, pw):
    p = req.q("path", "")
    if not wallpaper_allowed(pw, p):
        raise ApiError(403, "no permitido")
    w = int(req.q("w", "0"))
    if w:
        data, ct = thumbnail(p, max(64, min(w, 3840)))
    else:
        data, ct = open(p, "rb").read(), "image/png"
    return ("raw", data, ct, b"Cache-Control: max-age=600\r\n")


@route("POST", "/api/wallpaper/set")
def r_wp_set(req, pw):
    return set_wallpaper(pw, req.json().get("path", ""))


@route("POST", "/api/wallpaper/upload")
def r_wp_upload(req, pw):
    data = req.body
    if data[:8] != b"\x89PNG\r\n\x1a\n" and data[:3] != b"\xff\xd8\xff":
        raise ApiError(400, "La imagen debe ser PNG o JPG")
    d = user_dir(pw, "Imágenes", "Fondos")
    name = re.sub(r"[^\w-]", "", req.q("name", "")) or time.strftime("crack-remote-%Y%m%d-%H%M%S")
    p = os.path.join(d, name + (".png" if data[:4] == b"\x89PNG" else ".jpg"))
    write_user_file(pw, p, data)
    r = {"path": p}
    if req.q("apply", "1") == "1":
        r.update(set_wallpaper(pw, p))
    return r


@route("POST", "/api/avatar")
def r_avatar_set(req, pw):
    data = req.body
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ApiError(400, "La foto debe ser PNG")
    write_user_file(pw, os.path.join(pw.pw_dir, ".face"), data)
    os.makedirs("/var/lib/AccountsService/icons", exist_ok=True)
    with open(f"/var/lib/AccountsService/icons/{pw.pw_name}", "wb") as f:
        f.write(data)
    os.makedirs("/var/lib/AccountsService/users", exist_ok=True)
    up = f"/var/lib/AccountsService/users/{pw.pw_name}"
    txt = open(up).read() if os.path.exists(up) else "[User]\n"
    if "Icon=" in txt:
        txt = re.sub(r"Icon=.*", f"Icon=/var/lib/AccountsService/icons/{pw.pw_name}", txt)
    else:
        txt = txt.rstrip("\n") + f"\nIcon=/var/lib/AccountsService/icons/{pw.pw_name}\n"
    open(up, "w").write(txt)
    return {"ok": True}


@route("GET", "/api/tasks")
def r_tasks(req, pw):
    return load_json(tasks_file(pw), {"tasks": [], "rev": 0})


@route("PUT", "/api/tasks")
def r_tasks_put(req, pw):
    b = req.json()
    tasks = b.get("tasks")
    if not isinstance(tasks, list) or len(tasks) > 2000:
        raise ApiError(400, "lista inválida")
    old = load_json(tasks_file(pw), {"tasks": [], "rev": 0})
    data = {"tasks": tasks, "rev": old.get("rev", 0) + 1, "updated": time.time()}
    write_user_file(pw, tasks_file(pw), json.dumps(data, ensure_ascii=False, indent=1).encode())
    added = b.get("added")
    if added:
        notify(pw, "Nueva tarea desde el teléfono", str(added)[:200])
    return data


@route("GET", "/api/tokens")
def r_tokens(req, pw):
    return token_usage(pw)


@route("POST", "/api/tokens/limits")
def r_tokens_limits(req, pw):
    b = req.json()
    cfg = {"limit5h": int(b["limit5h"]) if b.get("limit5h") else None,
           "limitMonth": int(b["limitMonth"]) if b.get("limitMonth") else None}
    write_user_file(pw, os.path.join(user_dir(pw, ".config", "crackos"), "tokens.json"), json.dumps(cfg).encode())
    return cfg


@route("GET", "/api/clipboard")
def r_clip(req, pw):
    rc, out, err = run_as(pw, ["wl-paste", "-n", "-t", "text"], timeout=4)
    return {"text": out if rc == 0 else ""}


@route("POST", "/api/clipboard")
def r_clip_set(req, pw):
    spawn_as(pw, ["wl-copy"], req.json().get("text", "").encode())
    return {"ok": True}


@route("POST", "/api/notify")
def r_notify(req, pw):
    b = req.json()
    notify(pw, str(b.get("title", "Mensaje"))[:120], str(b.get("body", ""))[:1000], b.get("urgency", "normal"))
    return {"ok": True}


@route("GET", "/api/files")
def r_files(req, pw):
    return list_dir(pw, req.q("path"))


@route("GET", "/api/files/download")
def r_download(req, pw):
    p = req.q("path", "")
    if not inside(p, file_roots(pw)) or not os.path.isfile(p):
        raise ApiError(403, "Archivo no permitido")
    if os.path.getsize(p) > 200 * 1024 * 1024:
        raise ApiError(413, "Archivo muy grande (máx 200 MB)")
    name = urllib.parse.quote(os.path.basename(p))
    return ("raw", open(p, "rb").read(), "application/octet-stream",
            f"Content-Disposition: attachment; filename*=UTF-8''{name}\r\n".encode())


@route("POST", "/api/files/upload")
def r_upload(req, pw):
    d = req.q("dir") or user_dir(pw, "Descargas")
    name = os.path.basename(req.q("name", "archivo"))
    if not name or name.startswith(".") or not inside(d, file_roots(pw)) or not os.path.isdir(d):
        raise ApiError(400, "Destino inválido")
    p = os.path.join(d, name)
    base, ext = os.path.splitext(p)
    i = 1
    while os.path.exists(p):
        p = f"{base} ({i}){ext}"; i += 1
    write_user_file(pw, p, req.body)
    notify(pw, "Archivo recibido", f"{os.path.basename(p)} se guardó en {d}")
    return {"ok": True, "path": p}


@route("GET", "/api/disks")
def r_disks(req, pw):
    return {"disks": disk_tree(), "admin": is_admin(pw.pw_name)}


@route("POST", "/api/disks/format/prepare")
def r_fmt_prep(req, pw):
    return format_prepare(pw, req.json())


@route("POST", "/api/disks/format/confirm")
def r_fmt_conf(req, pw):
    return format_confirm(pw, req.json())


@route("GET", "/api/jobs")
def r_job(req, pw):
    j = JOBS.get(req.q("id", ""))
    if not j:
        raise ApiError(404, "sin trabajo")
    return j


@route("POST", "/api/run")
def r_run(req, pw):
    """Ejecuta un comando corto como el usuario y devuelve la salida (accesos rapidos)."""
    cmd = req.json().get("cmd", "")
    if not cmd:
        raise ApiError(400, "Falta el comando")
    try:
        rc, out, err = run_as(pw, ["bash", "-lc", cmd], timeout=20)
    except subprocess.TimeoutExpired:
        raise ApiError(500, "El comando tardó demasiado")
    return {"rc": rc, "out": out[-20000:], "err": err[-5000:]}


WS_ROUTES = {"/ws/terminal": ws_terminal, "/ws/input": ws_input, "/ws/stats": ws_stats}


async def handle(r, w):
    peer = (w.get_extra_info("peername") or ("?",))[0]
    try:
        while True:
            line = await asyncio.wait_for(r.readline(), 120)
            if not line:
                return
            try:
                method, target, _ = line.decode("latin-1").split(" ", 2)
            except ValueError:
                return
            headers = {}
            while True:
                h = await r.readline()
                if h in (b"\r\n", b"\n", b""):
                    break
                k, _, v = h.decode("latin-1").partition(":")
                headers[k.strip().lower()] = v.strip()
            u = urllib.parse.urlsplit(target)
            query = urllib.parse.parse_qs(u.query)
            n = int(headers.get("content-length", "0") or 0)
            if n > MAX_BODY:
                await respond(w, 413, {"error": "Demasiado grande"})
                return
            body = await r.readexactly(n) if n else b""
            req = Request(method, u.path, query, headers, body, peer)
            if method == "OPTIONS":
                await respond(w, 204)
                continue
            if u.path in WS_ROUTES and headers.get("upgrade", "").lower() == "websocket":
                pw = SESS.get(req.token())
                if not pw:
                    await respond(w, 401, {"error": "Sesión inválida"})
                    return
                key = headers.get("sec-websocket-key", "")
                acc = base64.b64encode(hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest())
                w.write(b"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                        b"Sec-WebSocket-Accept: " + acc + b"\r\n\r\n")
                await w.drain()
                await WS_ROUTES[u.path](WS(r, w), pw, req)
                return
            ent = ROUTES.get((method, u.path))
            if not ent:
                await respond(w, 404, {"error": "No existe"})
                continue
            fn, auth = ent
            pw = None
            if auth:
                pw = SESS.get(req.token())
                if not pw:
                    await respond(w, 401, {"error": "Sesión vencida, entra otra vez"})
                    continue
            try:
                res = await asyncio.to_thread(fn, req, pw)
                if isinstance(res, tuple) and res[0] == "raw":
                    await respond(w, 200, res[1], res[2], res[3] if len(res) > 3 else b"")
                else:
                    await respond(w, 200, res)
            except ApiError as e:
                await respond(w, e.code, {"error": e.msg})
            except subprocess.TimeoutExpired:
                await respond(w, 500, {"error": "La PC tardó demasiado en responder"})
            except Exception as e:
                log("error", u.path, repr(e))
                await respond(w, 500, {"error": str(e)[:300]})
    except (asyncio.IncompleteReadError, ConnectionError, asyncio.TimeoutError):
        pass
    finally:
        try:
            w.close()
        except Exception:
            pass


class Discovery(asyncio.DatagramProtocol):
    def connection_made(self, t):
        self.t = t

    def datagram_received(self, data, addr):
        if data.strip() == b"CRACKOS_DISCOVER":
            self.t.sendto(json.dumps({"crackos": True, "name": socket.gethostname(), "port": CONF["port"],
                                      "agent": VERSION}).encode(), addr)


async def main():
    global SESS, UINPUT
    load_conf()
    if not CONF["enabled"]:
        log("desactivado en", CONF_FILE)
        return
    SESS = Sessions()
    try:
        UINPUT = Uinput()
    except Exception as e:
        log("uinput no disponible:", e)
    SAMPLER.start()
    srv = await asyncio.start_server(handle, CONF["bind"], CONF["port"], limit=1 << 20)
    loop = asyncio.get_running_loop()
    try:
        await loop.create_datagram_endpoint(Discovery, local_addr=(CONF["bind"], CONF["port"]), allow_broadcast=True)
    except OSError as e:
        log("descubrimiento UDP no disponible:", e)
    log(f"Crack OS Remote {VERSION} escuchando en {CONF['bind']}:{CONF['port']}")
    async with srv:
        await srv.serve_forever()


if __name__ == "__main__":
    signal.signal(signal.SIGCHLD, signal.SIG_DFL)
    asyncio.run(main())
