#!/usr/bin/env python3
# Agrega el escudo de Crack Guard a una configuracion de Waybar (idempotente).
# Uso: waybar-guard.py ~/.config/waybar
import os
import sys

MOD = '''    "custom/guard": {
        "format": "{}",
        "return-type": "json",
        "exec": "crackguard waybar",
        "interval": 4,
        "on-click": "kitty --class crackos-float -e crackguard panel",
        "on-click-right": "kitty --class crackos-float -e sh -c 'crackguard registro 40; echo; echo Enter para cerrar; read x'"
    },
'''
CSS = '''
/* Crack Guard (seguridad) */
#custom-guard {
    background: rgba(16, 9, 11, 0.72);
    border: 1px solid rgba(255, 60, 70, 0.18);
    border-radius: 19px;
    padding: 0 13px;
    margin: 2px 0;
    color: #f1e9ea;
}
#custom-guard.alerta { color: #ffffff; background: rgba(255, 40, 50, 0.75); border-color: #ff2832; }
#custom-guard.aviso { color: #ffc861; }
#custom-guard.off { color: #8c7a7c; }
#custom-guard:hover { background: rgba(255, 40, 50, 0.35); }
'''

d = os.path.expanduser(sys.argv[1])
cfg = os.path.join(d, "config.jsonc")
if not os.path.exists(cfg):
    cfg = os.path.join(d, "config")
if os.path.exists(cfg):
    s = open(cfg).read()
    if "custom/guard" not in s:
        if '"custom/notification", ' in s:
            s = s.replace('"custom/notification", ', '"custom/guard", "custom/notification", ', 1)
        elif '"modules-right": [' in s:
            s = s.replace('"modules-right": [', '"modules-right": ["custom/guard", ', 1)
        i = s.find('    "custom/power": {')
        if i < 0:
            i = s.rfind("}")
            s = s[:i].rstrip().rstrip(",") + ",\n" + MOD.rstrip().rstrip(",") + "\n" + s[i:]
        else:
            s = s[:i] + MOD + s[i:]
        open(cfg + ".antes-seguridad", "w").write(open(cfg).read())
        open(cfg, "w").write(s)
css = os.path.join(d, "style.css")
if os.path.exists(css) and "#custom-guard" not in open(css).read():
    open(css, "a").write(CSS)
