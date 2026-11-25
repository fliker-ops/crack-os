#!/usr/bin/env python3
"""Vista previa del tema SDDM sin SDDM (PySide6 + objetos simulados).
Uso: python3 tools/preview_sddm.py salida.png [--safe]"""
import sys, os
from pathlib import Path
from PySide6.QtCore import QObject, Property, Signal, Slot, QUrl, Qt, QTimer, QByteArray
from PySide6.QtGui import QGuiApplication, QStandardItemModel, QStandardItem, QFontDatabase
from PySide6.QtQml import QQmlPropertyMap
from PySide6.QtQuick import QQuickView

ROOT = Path(__file__).resolve().parent.parent
THEME = ROOT / "config/includes.chroot/usr/share/sddm/themes/crackos"
INC = ROOT / "config/includes.chroot"

class Sddm(QObject):
    loginFailed = Signal(); loginSucceeded = Signal()
    def __init__(s): super().__init__()
    @Property(str, constant=True)
    def hostName(s): return "crackos"
    @Property(bool, constant=True)
    def canSuspend(s): return True
    @Property(bool, constant=True)
    def canReboot(s): return True
    @Property(bool, constant=True)
    def canPowerOff(s): return True
    @Slot(str, str, int)
    def login(s, u, p, i): print("login", u, i); QTimer.singleShot(300, s.loginFailed.emit)
    @Slot()
    def powerOff(s): pass
    @Slot()
    def reboot(s): pass
    @Slot()
    def suspend(s): pass

class Model(QStandardItemModel):
    def __init__(s, roles, rows):
        super().__init__()
        s._roles = {Qt.UserRole + i + 1: QByteArray(r.encode()) for i, r in enumerate(roles)}
        for row in rows:
            it = QStandardItem()
            for i, r in enumerate(roles): it.setData(row.get(r, ""), Qt.UserRole + i + 1)
            s.appendRow(it)
    def roleNames(s): return s._roles
    @Property(int, constant=True)
    def lastIndex(s): return 1

app = QGuiApplication(sys.argv)
for f in (ROOT / "assets/fonts").glob("*.ttf"): QFontDatabase.addApplicationFont(str(f))
users = Model(["name", "realName", "icon"], [{"name": "invitado", "realName": "Invitado"},
             {"name": "onofre", "realName": "Onofre"}, {"name": "root", "realName": "Admin"}])
sessions = Model(["name"], [{"name": "Xfce Session"}])
cfg = QQmlPropertyMap()
cfg.insert("background", QUrl.fromLocalFile(str(INC / "usr/share/backgrounds/crackos/crackos-login.png")).toString())
cfg.insert("defaultFace", QUrl.fromLocalFile(str(INC / "usr/share/crackos/face.png")).toString())
cfg.insert("safeMode", "true" if "--safe" in sys.argv else "false"); cfg.insert("accent", "#ff2832"); cfg.insert("font", "JetBrainsMono Nerd Font")
view = QQuickView()
view.setResizeMode(QQuickView.SizeRootObjectToView)
sd = Sddm()
ctx = view.rootContext()
ctx.setContextProperty("sddm", sd); ctx.setContextProperty("userModel", users)
ctx.setContextProperty("sessionModel", sessions); ctx.setContextProperty("config", cfg)
view.setSource(QUrl.fromLocalFile(str(THEME / "Main.qml")))
if view.status() == QQuickView.Error:
    for e in view.errors(): print(e.toString())
    sys.exit(1)
view.resize(1920, 1080)
root = view.rootObject()
view.show()
def grab():
    view.grabWindow().save(sys.argv[1]); app.quit()
QTimer.singleShot(1500, grab)
app.exec()
