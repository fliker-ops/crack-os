import QtQuick 2.15

// Anillo HUD giratorio dibujado con Canvas (estilo "Stark", en rojo)
Canvas {
    id: ring
    property color color: "#ff2832"
    property real lineWidth: 2
    property var segments: [[0, 70], [95, 150], [180, 260], [290, 330]]
    property int duration: 12000
    property bool reverse: false
    property real dash: 0
    antialiasing: true
    onPaint: {
        var ctx = getContext("2d");
        ctx.reset();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        var r = Math.min(width, height) / 2 - lineWidth;
        for (var i = 0; i < segments.length; i++) {
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, r,
                    segments[i][0] * Math.PI / 180, segments[i][1] * Math.PI / 180, false);
            ctx.stroke();
        }
        if (dash > 0) {
            for (var a = 0; a < 360; a += dash) {
                var rad = a * Math.PI / 180;
                ctx.beginPath();
                ctx.moveTo(width / 2 + Math.cos(rad) * (r - 6), height / 2 + Math.sin(rad) * (r - 6));
                ctx.lineTo(width / 2 + Math.cos(rad) * (r - 1), height / 2 + Math.sin(rad) * (r - 1));
                ctx.stroke();
            }
        }
    }
    onColorChanged: requestPaint()
    RotationAnimation on rotation {
        from: ring.reverse ? 360 : 0; to: ring.reverse ? 0 : 360
        duration: ring.duration; loops: Animation.Infinite; running: true
    }
}
