import QtQuick 2.0
import calamares.slideshow 1.0

Presentation {
    id: presentation
    function nextSlide() { presentation.goToNextSlide(); }
    Timer { interval: 7000; running: presentation.activatedInCalamares; repeat: true; onTriggered: nextSlide() }

    Slide {
        Rectangle { anchors.fill: parent; color: "#000000" }
        Image { id: bg; source: "slide1.png"; anchors.fill: parent; fillMode: Image.PreserveAspectCrop; opacity: 0.85 }
        Text {
            anchors { horizontalCenter: parent.horizontalCenter; bottom: parent.bottom; bottomMargin: 30 }
            text: "Instalando Crack OS · secure · stealth · system"
            color: "#ff2832"; font.pixelSize: 18; font.family: "JetBrainsMono Nerd Font"
        }
    }
    Slide {
        Rectangle { anchors.fill: parent; color: "#0b0b0d" }
        Column {
            anchors.centerIn: parent; spacing: 16; width: parent.width * 0.8
            Text { text: "MODO SEGURO"; color: "#ff2832"; font.pixelSize: 30; font.bold: true; font.family: "JetBrainsMono Nerd Font" }
            Text { width: parent.width; wrapMode: Text.WordWrap; color: "#e6e6e6"; font.pixelSize: 16; font.family: "JetBrainsMono Nerd Font"
                   text: "Elige \"Modo Seguro\" en el menu de arranque y todo lo que hagas se borrara al reiniciar. Ideal para navegar o probar cosas sin dejar rastro." }
        }
    }
    Slide {
        Rectangle { anchors.fill: parent; color: "#0b0b0d" }
        Column {
            anchors.centerIn: parent; spacing: 16; width: parent.width * 0.8
            Text { text: "LLAVE USB"; color: "#ff2832"; font.pixelSize: 30; font.bold: true; font.family: "JetBrainsMono Nerd Font" }
            Text { width: parent.width; wrapMode: Text.WordWrap; color: "#e6e6e6"; font.pixelSize: 16; font.family: "JetBrainsMono Nerd Font"
                   text: "Cuando quieras, activa la llave USB:  sudo crackos-usbkey create /dev/sdX1  y luego  sudo crackos-usbkey enable. El modo normal solo arrancara con tu USB conectada." }
        }
    }
}
