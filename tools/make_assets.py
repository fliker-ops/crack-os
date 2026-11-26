#!/usr/bin/env python3
"""Genera todos los recursos graficos de Crack OS a partir del video de intro.

Uso:  python3 tools/make_assets.py
Requiere: ffmpeg, Pillow, numpy. Escribe en config/includes.chroot y config/bootloaders.
"""
import os, subprocess, tempfile, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "assets/src/crack-intro.mp4"
FONTS = ROOT / "assets/fonts"
INC = ROOT / "config/includes.chroot"
RED = (255, 40, 50)
DARK_RED = (140, 10, 20)

def font(name, size):
    return ImageFont.truetype(str(FONTS / f"JetBrainsMonoNerdFont-{name}.ttf"), size)

def extract_frames(tmp):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(VIDEO), "-vf", "fps=60",
                    f"{tmp}/%04d.png"], check=True)
    return lambda i: Image.open(f"{tmp}/{i:04d}.png").convert("RGB")

def spaced_text(text, fnt, spacing, fill, glow=None, glow_radius=14, pad=40):
    """Texto con espaciado entre letras y brillo (glow) rojo."""
    widths = [fnt.getbbox(c)[2] for c in text]
    w = sum(widths) + spacing * (len(text) - 1) + pad * 2
    asc, desc = fnt.getmetrics()
    h = asc + desc + pad * 2
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x = pad
    for c, cw in zip(text, widths):
        d.text((x, pad), c, font=fnt, fill=fill)
        x += cw + spacing
    if glow:
        g = Image.new("RGBA", layer.size, glow + (0,))
        g.putalpha(layer.getchannel("A"))
        g = g.filter(ImageFilter.GaussianBlur(glow_radius))
        out = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        out = Image.alpha_composite(out, g)
        out = Image.alpha_composite(out, g)
        out = Image.alpha_composite(out, layer)
        return out
    return layer

def title(size=110, soft=False):
    if soft:  # version sobria: casi sin brillo
        return spaced_text("CRACK OS", font("Bold", size), int(size * 0.32),
                           (235, 235, 235, 255), glow=(90, 0, 8), glow_radius=size // 10)
    return spaced_text("CRACK OS", font("ExtraBold", size), int(size * 0.42),
                       (255, 245, 245, 255), glow=RED, glow_radius=size // 7)

def subtitle(size=22, text="SECURE  ·  STEALTH  ·  SYSTEM"):
    return spaced_text(text, font("Regular", size), int(size * 0.55), RED + (255,),
                       glow=DARK_RED, glow_radius=6)

def paste_center(base, layer, cx, cy):
    base.alpha_composite(layer, (int(cx - layer.width / 2), int(cy - layer.height / 2)))

def boot_lines(lines, size=17):
    fnt = font("Regular", size)
    h = int(size * 1.5)
    img = Image.new("RGBA", (int(size * 0.62 * 44), h * len(lines) + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, l in enumerate(lines):
        d.text((0, i * h), l, font=fnt, fill=(225, 225, 225, 235))
    d.rectangle((0, h * len(lines) + 12, img.width, h * len(lines) + 15), fill=RED + (255,))
    return img

def clean_frame(fr):
    """Quita el texto CRACK-LOCK original rellenando con 'lluvia' de otra zona."""
    im = fr.copy()
    patch = im.crop((0, 650, 640, 915)).copy()
    im.paste(patch, (630, 650))
    im.paste(im.crop((60, 650, 140, 915)).copy(), (1270, 650))
    im.paste(im.crop((0, 1020, 300, 1075)), (1620, 1020))
    return im.convert("RGBA")

def wallpaper(fr, safe=False):
    im = clean_frame(fr)
    paste_center(im, title(84, soft=True), 960, 715)
    paste_center(im, spaced_text("secure  ·  stealth  ·  system", font("Regular", 18), 6, (200, 50, 58, 255)), 960, 778)
    if safe:
        tag = spaced_text("MODO SEGURO  ·  los cambios se borran al reiniciar", font("Regular", 20), 3, (220, 60, 66, 255))
        paste_center(im, tag, 960, 860)
    return im.convert("RGB")

def radial_mask(w, h, inner=0.62, outer=0.98):
    y, x = np.mgrid[0:h, 0:w]
    r = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
    m = np.clip((outer - r) / (outer - inner), 0, 1)
    return m[..., None]

def plymouth(get):
    out = INC / "usr/share/plymouth/themes/crackos"
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.png"):
        f.unlink()
    box = (740, 160, 1180, 620)            # zona de la calavera en el video 1080p
    scale = 0.75
    W, H = int((box[2] - box[0]) * scale), int((box[3] - box[1]) * scale)
    mask = radial_mask(W, H)
    seq = list(range(1, 121, 3)) + list(range(150, 241, 4)) + list(range(256, 318, 3))
    for n, i in enumerate(seq):
        im = get(i).crop(box).resize((W, H), Image.LANCZOS)
        a = (np.asarray(im).astype(float) * mask).astype(np.uint8)
        Image.fromarray(a).save(out / f"skull-{n:03d}.png", optimize=True)
    intro = len(range(1, 121, 3)); loop = len(range(150, 241, 4)); glitch = len(seq) - intro - loop
    title(64).save(out / "title.png")
    # variantes con glitch RGB
    t = title(64)
    for k in range(2):
        r, g, b, a = t.split()
        off = 6 + 4 * k
        rr = ImageChops.offset(r, off, 0); bb = ImageChops.offset(b, -off, 0)
        gl = Image.merge("RGBA", (rr, g, bb, a))
        arr = np.asarray(gl).copy()
        rnd = random.Random(k)
        for _ in range(4):
            y0 = rnd.randrange(0, arr.shape[0] - 8); hh = rnd.randrange(3, 9)
            arr[y0:y0 + hh] = np.roll(arr[y0:y0 + hh], rnd.choice([-14, -8, 9, 15]), axis=1)
        Image.fromarray(arr).save(out / f"title-glitch{k}.png")
    subtitle(14, "SECURE  ·  STEALTH  ·  SYSTEM").save(out / "subtitle.png")
    Image.new("RGBA", (360, 3), RED + (255,)).save(out / "bar.png")
    Image.new("RGBA", (360, 3), (60, 8, 12, 255)).save(out / "bar-bg.png")
    Image.new("RGBA", (12, 12), RED + (255,)).save(out / "bullet.png")
    e = Image.new("RGBA", (380, 44), (0, 0, 0, 0)); d = ImageDraw.Draw(e)
    d.rounded_rectangle((1, 1, 378, 42), 10, fill=(10, 10, 10, 230), outline=RED + (255,), width=2)
    e.save(out / "entry.png")
    return intro, loop, glitch

def grub_bg(fr):
    im = clean_frame(fr)
    # oscurece y sube la calavera para dejar sitio al menu
    im = Image.alpha_composite(im, Image.new("RGBA", im.size, (0, 0, 0, 70)))
    skull = fr.crop((740, 160, 1180, 620)).resize((286, 299), Image.LANCZOS)
    m = radial_mask(286, 299)
    skull = Image.fromarray((np.asarray(skull).astype(float) * m).astype(np.uint8))
    base = Image.new("RGBA", im.size, (0, 0, 0, 255))
    rain = im.crop((0, 0, 1920, 1080))
    base.alpha_composite(rain)
    blk = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0)); d = ImageDraw.Draw(blk)
    d.rectangle((560, 60, 1360, 1040), fill=(0, 0, 0, 255))
    blk = blk.filter(ImageFilter.GaussianBlur(40))
    base.alpha_composite(blk)
    base.paste(skull, (817, 90))
    paste_center(base, title(60, soft=True), 960, 440)
    d = ImageDraw.Draw(base)
    d.text((960, 1035), "↑↓ elegir   ENTER arrancar   E editar   C consola",
           font=font("Regular", 15), fill=(150, 150, 150, 255), anchor="mm")
    return base.convert("RGB")

def main():
    with tempfile.TemporaryDirectory() as tmp:
        get = extract_frames(tmp)
        fr = get(253)
        wp = INC / "usr/share/backgrounds/crackos"; wp.mkdir(parents=True, exist_ok=True)
        wallpaper(fr).save(wp / "crackos-wallpaper.png")
        wallpaper(fr, safe=True).save(wp / "crackos-wallpaper-safe.png")
        # variantes para Super+Shift+W
        dark = Image.new("RGBA", (1920, 1080), (0, 0, 0, 255))
        g = Image.fromarray((radial_mask(1920, 1080, 0.0, 1.1)[..., 0] * 60).astype(np.uint8))
        dark.paste(Image.new("RGBA", (1920, 1080), (90, 6, 14, 255)), (0, 0), g)
        sk = fr.crop((740, 160, 1180, 620)).resize((330, 345), Image.LANCZOS)
        skm = Image.fromarray((radial_mask(330, 345)[..., 0] * 255).astype(np.uint8))
        dark.paste(sk, (1920 - 330 - 140, 1080 - 345 - 110), skm)
        dark.convert("RGB").save(wp / "crackos-oscuro.png")
        rain = clean_frame(fr)
        rain.paste(rain.crop((40, 150, 480, 630)).copy(), (740, 150))
        paste_center(rain, title(46, soft=True), 960, 1010)
        rain.convert("RGB").save(wp / "crackos-lluvia.png")
        # fondo de login: mismo fondo, algo mas oscuro
        lg = clean_frame(fr)
        lg.paste(lg.crop((40, 150, 480, 630)).copy(), (740, 150))   # solo lluvia, sin calavera
        vig = Image.fromarray((255 * (1 - radial_mask(1920, 1080, 0.2, 1.4)[..., 0] * 0.0)).astype(np.uint8))
        lg = Image.alpha_composite(lg, Image.new("RGBA", (1920, 1080), (0, 0, 0, 40)))
        lg.convert("RGB").save(wp / "crackos-login.png")
        intro, loop, glitch = plymouth(get)
        import re
        sp = INC / "usr/share/plymouth/themes/crackos/crackos.script"
        if sp.exists():
            t = sp.read_text()
            for k, v in (("INTRO", intro), ("LOOP", loop), ("GLITCH", glitch)):
                t = re.sub(rf"^{k} = \d+;", f"{k} = {v};", t, flags=re.M)
            sp.write_text(t)
        gb = grub_bg(fr)
        gt = INC / "boot/grub/themes/crackos"; gt.mkdir(parents=True, exist_ok=True)
        gb.save(gt / "background.png")
        # piezas 9-slice del menu de GRUB
        for side, size, col in (("c", (8, 8), (60, 6, 12, 200)), ("w", (4, 8), RED + (255,)),
                                ("e", (1, 8), (60, 6, 12, 200)), ("n", (8, 1), (90, 10, 18, 220)),
                                ("s", (8, 1), (90, 10, 18, 220)), ("nw", (4, 1), RED + (255,)),
                                ("sw", (4, 1), RED + (255,)), ("ne", (1, 1), (90, 10, 18, 220)),
                                ("se", (1, 1), (90, 10, 18, 220))):
            Image.new("RGBA", size, col).save(gt / f"select_{side}.png")
        for side in ("c", "n", "s", "e", "w", "nw", "ne", "sw", "se"):
            Image.new("RGBA", (8, 8), (0, 0, 0, 235) if side == "c" else (255, 40, 50, 160)).save(gt / f"terminal_box_{side}.png")
        # GRUB del Live (EFI) e ISOLINUX (BIOS)
        bl = ROOT / "config/bootloaders-overlay"; bl.mkdir(parents=True, exist_ok=True)
        gb.save(bl / "splash-grub.png")
        gb.resize((640, 480), Image.LANCZOS).save(bl / "splash-isolinux.png")
        # icono / avatar calavera
        sk = fr.crop((780, 190, 1140, 610)).convert("RGB")
        side = max(sk.size); sq = Image.new("RGB", (side, side), (0, 0, 0)); sq.paste(sk, ((side - sk.width) // 2, (side - sk.height) // 2))
        ic = INC / "usr/share/icons/hicolor"
        for s in (16, 24, 32, 48, 64, 128, 256):
            p = ic / f"{s}x{s}/apps"; p.mkdir(parents=True, exist_ok=True)
            # icono con fondo transparente (el negro pasa a alfa)
            rgba = sq.resize((s, s), Image.LANCZOS).convert("RGBA")
            arr = np.asarray(rgba).copy(); arr[..., 3] = np.clip(arr[..., :3].max(axis=2) * 2, 0, 255)
            Image.fromarray(arr).save(p / "crackos.png")
        face = INC / "usr/share/crackos"; face.mkdir(parents=True, exist_ok=True)
        sq.resize((256, 256), Image.LANCZOS).save(face / "face.png")
        # Calamares
        cb = INC / "etc/calamares/branding/crackos"; cb.mkdir(parents=True, exist_ok=True)
        sq.resize((128, 128), Image.LANCZOS).save(cb / "logo.png")
        w = clean_frame(fr).crop((560, 100, 1360, 900)).convert("RGBA")
        paste_center(w, title(60), 400, 640)
        w.convert("RGB").resize((600, 600), Image.LANCZOS).save(cb / "welcome.png")
        clean_frame(fr).convert("RGB").resize((960, 540), Image.LANCZOS).save(cb / "slide1.png")
    print("Recursos generados.")

if __name__ == "__main__":
    main()
