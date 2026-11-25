import QtQuick 2.15

// Boton tipo pastilla con icono Nerd Font
Rectangle {
    id: btn
    property string icon: ""
    property string label: ""
    property color accent: "#ff2832"
    property string fontFamily: "JetBrainsMono Nerd Font"
    signal clicked()
    width: row.implicitWidth + 28; height: 38; radius: 19
    color: ma.containsMouse ? Qt.rgba(1, 0.16, 0.2, 0.22) : Qt.rgba(0.08, 0.08, 0.09, 0.78)
    border.color: ma.containsMouse ? accent : Qt.rgba(1, 0.16, 0.2, 0.35)
    border.width: 1
    Behavior on color { ColorAnimation { duration: 150 } }
    Row {
        id: row; anchors.centerIn: parent; spacing: 8
        Text { text: btn.icon; color: btn.accent; font.family: btn.fontFamily; font.pixelSize: 16; anchors.verticalCenter: parent.verticalCenter }
        Text { text: btn.label; visible: btn.label !== ""; color: "#e8e8e8"; font.family: btn.fontFamily; font.pixelSize: 13; anchors.verticalCenter: parent.verticalCenter }
    }
    MouseArea { id: ma; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: btn.clicked() }
}
