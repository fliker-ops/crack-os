#!/usr/bin/env python3
"""Simula la animacion Plymouth (misma logica que crackos.script) y la guarda como MP4."""
import sys, re, subprocess, tempfile, random
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parent.parent
T = ROOT / "config/includes.chroot/usr/share/plymouth/themes/crackos"
script = (T / "crackos.script").read_text()
INTRO, LOOP, GLITCH = (int(re.search(rf"^{k} = (\d+);", script, re.M).group(1)) for k in ("INTRO", "LOOP", "GLITCH"))
frames = [Image.open(T / f"skull-{i:03d}.png").convert("RGBA") for i in range(INTRO + LOOP + GLITCH)]
title = Image.open(T / "title.png"); gl = [Image.open(T / f"title-glitch{k}.png") for k in range(2)]
sub = Image.open(T / "subtitle.png"); barbg = Image.open(T / "bar-bg.png"); bar = Image.open(T / "bar.png")
W, H = 1920, 1080
cx = W // 2; top = int(H * 0.5 - frames[0].height * 0.72)
ty = top + frames[0].height - 10; sy = ty + title.height - 40; by = sy + sub.height + 26
rnd = random.Random(3)
out = sys.argv[1] if len(sys.argv) > 1 else "boot-preview.mp4"
with tempfile.TemporaryDirectory() as tmp:
    frame, d, glitching, op = 0, 1, -1, 0.0
    for n in range(25 * 9):
        if frame < INTRO - 1: frame += 1
        elif glitching >= 0:
            glitching += 1
            if glitching >= GLITCH: glitching, frame, d = -1, INTRO, 1
            else: frame = INTRO + LOOP + glitching
        else:
            frame = max(frame, INTRO) + d
            if frame >= INTRO + LOOP - 1: frame, d = INTRO + LOOP - 1, -1
            if frame <= INTRO: frame, d = INTRO, 1
            if n in (150,): glitching = 0
        img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        img.alpha_composite(frames[frame], (cx - frames[frame].width // 2, top))
        if frame >= INTRO * 0.6 or glitching >= 0: op = min(1.0, op + 0.08)
        t = gl[rnd.randrange(2)] if (glitching >= 0 or rnd.randrange(90) == 3) else title
        for im, x, y in ((t, cx - t.width // 2, ty), (sub, cx - sub.width // 2, sy), (barbg, cx - barbg.width // 2, by)):
            a = im.copy(); a.putalpha(a.getchannel("A").point(lambda v: int(v * op))); img.alpha_composite(a, (x, y))
        w = max(1, int(bar.width * min(1, n / 200)))
        b = bar.resize((w, bar.height)); b.putalpha(b.getchannel("A").point(lambda v: int(v * op)))
        img.alpha_composite(b, (cx - barbg.width // 2, by))
        img.convert("RGB").resize((1280, 720)).save(f"{tmp}/{n:04d}.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "25", "-i", f"{tmp}/%04d.png",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", out], check=True)
print(out)
