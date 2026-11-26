import QtQuick 2.15

// Crack OS - pantalla de acceso (SDDM). Estilo HUD rojo/negro.
Rectangle {
    id: root
    width: 1920; height: 1080
    color: "black"

    readonly property color accent: config.accent ? config.accent : "#ff2832"
    readonly property string mono: config.font ? config.font : "JetBrainsMono Nerd Font"
    property int userIndex: userModel.lastIndex >= 0 ? userModel.lastIndex : 0
    property int sessionIndex: sessionModel.lastIndex >= 0 ? sessionModel.lastIndex : 0
    property string selectedUser: ""
    property bool safeMode: config.safeMode === "true" || config.safeMode === true
    property bool busy: false

    function doLogin() {
        if (busy) return;
        busy = true;
        status.text = "Verificando...";
        status.color = "#bdbdbd";
        sddm.login(selectedUser, password.text, sessionIndex);
    }
    Component.onCompleted: password.forceActiveFocus()

    Connections {
        target: sddm
        function onLoginFailed() {
            busy = false;
            password.text = "";
            status.text = "Contraseña incorrecta";
            status.color = root.accent;
            shake.restart();
            password.forceActiveFocus();
        }
        function onLoginSucceeded() { status.text = "Bienvenido"; }
    }

    // ---------- Fondo ----------
    Image {
        anchors.fill: parent
        source: config.background ? config.background : ""
        fillMode: Image.PreserveAspectCrop
        asynchronous: false
    }
    Rectangle { anchors.fill: parent; color: "#000000"; opacity: 0.55 }
    // ---------- Barra superior ----------
    Item {
        id: topBar
        anchors { top: parent.top; left: parent.left; right: parent.right; margins: 28 }
        height: 40
        Row {
            spacing: 12; anchors.verticalCenter: parent.verticalCenter
            Text { text: ""; color: root.accent; font.family: root.mono; font.pixelSize: 18 }
            Text { text: "CRACK OS"; color: "#f2f2f2"; font.family: root.mono; font.pixelSize: 15; font.bold: true; font.letterSpacing: 3 }
            Text { text: sddm.hostName ? sddm.hostName : ""; color: "#6f6f6f"; font.family: root.mono; font.pixelSize: 14 }
        }
        Rectangle {
            visible: root.safeMode
            anchors.centerIn: parent
            width: safeTxt.implicitWidth + 30; height: 30; radius: 15
            color: Qt.rgba(1, 0.16, 0.2, 0.18); border.color: root.accent
            Text { id: safeTxt; anchors.centerIn: parent; text: "  Modo seguro"; color: root.accent; font.family: root.mono; font.pixelSize: 13; font.letterSpacing: 2 }
        }
        Text {
            id: dateTxt
            anchors { right: parent.right; verticalCenter: parent.verticalCenter }
            color: "#9a9a9a"; font.family: root.mono; font.pixelSize: 14
        }
    }

    // ---------- Reloj HUD ----------
    Item {
        id: clockHud
        width: 260; height: 260
        anchors { horizontalCenter: parent.horizontalCenter; top: parent.top; topMargin: parent.height * 0.08 }
        HudRing { anchors.fill: parent; anchors.margins: 30; color: Qt.rgba(1, 0.16, 0.2, 0.45); lineWidth: 2; segments: [[0, 300]]; duration: 60000 }
        Column {
            anchors.centerIn: parent; spacing: 2
            Text { id: clockTxt; anchors.horizontalCenter: parent.horizontalCenter; color: "#ffffff"; font.family: root.mono; font.pixelSize: 58; font.weight: Font.DemiBold }
            Text { id: secTxt; anchors.horizontalCenter: parent.horizontalCenter; color: "#a0a0a0"; font.family: root.mono; font.pixelSize: 14; font.letterSpacing: 1 }
        }
        Timer {
            interval: 1000; running: true; repeat: true; triggeredOnStart: true
            onTriggered: {
                var d = new Date();
                clockTxt.text = Qt.formatTime(d, "HH:mm");
                secTxt.text = d.toLocaleDateString(Qt.locale("es_ES"), "dddd d");
                dateTxt.text = d.toLocaleDateString(Qt.locale("es_ES"), "d MMMM yyyy");
            }
        }
    }

    // ---------- Seleccion de usuarios ----------
    Text {
        id: pickLabel
        anchors { horizontalCenter: parent.horizontalCenter; top: clockHud.bottom; topMargin: 34 }
        text: "Selecciona usuario"
        color: "#8c8c8c"; font.family: root.mono; font.pixelSize: 14; font.letterSpacing: 1
    }
    ListView {
        id: users
        anchors { horizontalCenter: parent.horizontalCenter; top: pickLabel.bottom; topMargin: 18 }
        height: 200
        width: Math.min(root.width - 200, Math.max(1, count) * 180)
        orientation: ListView.Horizontal
        interactive: count * 180 > width
        model: userModel
        currentIndex: root.userIndex
        clip: true
        highlightFollowsCurrentItem: true
        preferredHighlightBegin: width / 2 - 90; preferredHighlightEnd: width / 2 + 90
        highlightRangeMode: count * 180 > width ? ListView.StrictlyEnforceRange : ListView.NoHighlightRange
        onCurrentIndexChanged: root.userIndex = currentIndex
        delegate: Item {
            id: card
            width: 180; height: 200
            property bool active: ListView.isCurrentItem
            Component.onCompleted: if (active) root.selectedUser = model.name
            onActiveChanged: if (active) root.selectedUser = model.name
            Item {
                id: avatarBox
                width: 120; height: 120
                anchors.horizontalCenter: parent.horizontalCenter
                y: card.active ? 0 : 14
                scale: card.active ? 1.0 : 0.78
                opacity: card.active ? 1.0 : 0.5
                Behavior on scale { NumberAnimation { duration: 220; easing.type: Easing.OutCubic } }
                Behavior on opacity { NumberAnimation { duration: 220 } }
                Behavior on y { NumberAnimation { duration: 220 } }
                HudRing {
                    anchors.fill: parent; anchors.margins: -14
                    visible: card.active
                    color: Qt.rgba(1, 0.16, 0.2, 0.8); lineWidth: 1.5
                    segments: [[0, 360]]
                    duration: 60000
                }
                Rectangle {
                    anchors.fill: parent; anchors.margins: 6
                    color: "#0c0c0c"; radius: 18
                    border.color: card.active ? root.accent : "#3a3a3a"; border.width: 2
                    Image {
                        id: face
                        anchors.fill: parent; anchors.margins: 8
                        source: model.icon ? model.icon : ""
                        fillMode: Image.PreserveAspectCrop
                        onStatusChanged: if (status === Image.Error) source = config.defaultFace
                        Component.onCompleted: if (source == "") source = config.defaultFace
                    }
                }
            }
            Text {
                anchors { horizontalCenter: parent.horizontalCenter; top: avatarBox.bottom; topMargin: 22 }
                width: parent.width - 10
                horizontalAlignment: Text.AlignHCenter
                elide: Text.ElideRight
                text: (model.realName && model.realName !== "" ? model.realName : model.name)
                color: card.active ? "#ffffff" : "#8a8a8a"
                font.family: root.mono; font.pixelSize: 16; font.bold: card.active; font.letterSpacing: 0.5
            }
            MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: { users.currentIndex = index; password.forceActiveFocus(); }
            }
        }
    }

    // ---------- Contrasena ----------
    Item {
        id: loginBox
        width: 420; height: 54
        anchors { horizontalCenter: parent.horizontalCenter; top: users.bottom; topMargin: 14 }
        SequentialAnimation {
            id: shake
            NumberAnimation { target: loginBox; property: "anchors.horizontalCenterOffset"; to: -14; duration: 50 }
            NumberAnimation { target: loginBox; property: "anchors.horizontalCenterOffset"; to: 14; duration: 50 }
            NumberAnimation { target: loginBox; property: "anchors.horizontalCenterOffset"; to: -9; duration: 50 }
            NumberAnimation { target: loginBox; property: "anchors.horizontalCenterOffset"; to: 9; duration: 50 }
            NumberAnimation { target: loginBox; property: "anchors.horizontalCenterOffset"; to: 0; duration: 50 }
        }
        Rectangle {
            id: field
            anchors { left: parent.left; right: goBtn.left; rightMargin: 10; top: parent.top; bottom: parent.bottom }
            radius: 27
            color: Qt.rgba(0.05, 0.05, 0.06, 0.88)
            border.color: password.activeFocus ? root.accent : "#3d3d3d"; border.width: 2
            Text { id: lock; text: ""; color: root.accent; font.family: root.mono; font.pixelSize: 18; anchors { left: parent.left; leftMargin: 20; verticalCenter: parent.verticalCenter } }
            TextInput {
                id: password
                anchors { left: lock.right; leftMargin: 14; right: parent.right; rightMargin: 20; verticalCenter: parent.verticalCenter }
                echoMode: TextInput.Password
                passwordCharacter: "●"
                color: "#ffffff"; selectionColor: root.accent
                font.family: root.mono; font.pixelSize: 17; font.letterSpacing: 2
                clip: true
                focus: true
                Keys.onReturnPressed: root.doLogin()
                Keys.onEnterPressed: root.doLogin()
                Keys.onLeftPressed: if (text === "" && users.currentIndex > 0) users.currentIndex--
                Keys.onRightPressed: if (text === "" && users.currentIndex < users.count - 1) users.currentIndex++
                Text {
                    visible: password.text === ""
                    text: "Contraseña"
                    color: "#666666"; font: password.font
                    anchors.verticalCenter: parent.verticalCenter
                }
            }
        }
        Rectangle {
            id: goBtn
            width: 54; height: 54; radius: 27
            anchors.right: parent.right
            color: goMa.containsMouse ? "#ff4b55" : root.accent
            Text { anchors.centerIn: parent; text: root.busy ? "" : ""; color: "#0a0a0a"; font.family: root.mono; font.pixelSize: 20; font.bold: true }
            MouseArea { id: goMa; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: root.doLogin() }
        }
    }
    Text {
        id: status
        anchors { horizontalCenter: parent.horizontalCenter; top: loginBox.bottom; topMargin: 18 }
        text: root.safeMode ? "Sesión temporal: los cambios se borran al reiniciar" : ""
        color: "#8c8c8c"; font.family: root.mono; font.pixelSize: 13; font.letterSpacing: 0.5
    }

    // ---------- Barra inferior ----------
    Item {
        anchors { left: parent.left; right: parent.right; bottom: parent.bottom; margins: 28 }
        height: 40
        Row {
            spacing: 10; anchors.verticalCenter: parent.verticalCenter
            HudButton {
                icon: ""
                label: sessionName.text
                accent: root.accent; fontFamily: root.mono
                onClicked: root.sessionIndex = (root.sessionIndex + 1) % Math.max(1, sessionModel.rowCount())
            }
            // Obtiene el nombre de la sesion seleccionada desde el modelo
            Repeater {
                model: sessionModel
                delegate: Item { visible: false; Component.onCompleted: if (index === root.sessionIndex) sessionName.text = model.name
                                 Connections { target: root; function onSessionIndexChanged() { if (index === root.sessionIndex) sessionName.text = model.name } } }
            }
            Text { id: sessionName; visible: false; text: "Xfce" }
        }
        Row {
            spacing: 10; anchors { right: parent.right; verticalCenter: parent.verticalCenter }
            HudButton { icon: ""; label: "Suspender"; visible: sddm.canSuspend; accent: root.accent; fontFamily: root.mono; onClicked: sddm.suspend() }
            HudButton { icon: ""; label: "Reiniciar"; visible: sddm.canReboot; accent: root.accent; fontFamily: root.mono; onClicked: sddm.reboot() }
            HudButton { icon: ""; label: "Apagar"; visible: sddm.canPowerOff; accent: root.accent; fontFamily: root.mono; onClicked: sddm.powerOff() }
        }
    }
}
