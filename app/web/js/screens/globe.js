// Mundo 3D rojo: tu ubicacion real, la Luna, el Sol y los planetas en su posicion real de hoy
import * as THREE from '../../lib/three.module.js';
import { icon, $, esc, toast } from '../ui.js';
import { native } from '../native.js';

const R_KM = 6371, AU = 149597870.7 / R_KM;   // 1 UA en radios terrestres
const D2R = Math.PI / 180;
// elementos orbitales (J2000 + variacion por siglo): a, e, I, L, long.perihelio, long.nodo
const PLANETS = [
  { n: 'Mercurio', r: 0.383, c: '#b8a8a8', el: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], d: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
  { n: 'Venus', r: 0.949, c: '#ffcf9a', el: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], d: [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418] },
  { n: 'Tierra', earth: true, el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], d: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0] },
  { n: 'Marte', r: 0.532, c: '#ff5a3a', el: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], d: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
  { n: 'Júpiter', r: 11.21, c: '#e8b48a', bands: true, el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], d: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
  { n: 'Saturno', r: 9.45, c: '#f0d29a', bands: true, ring: true, el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], d: [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
  { n: 'Urano', r: 4.01, c: '#9adfe8', el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], d: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] },
  { n: 'Neptuno', r: 3.88, c: '#6a8cff', el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], d: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] },
];

function jdNow(d = new Date()) { return d.getTime() / 86400000 + 2440587.5; }

function kepler(p, T, Mshift = 0) {
  const [a, e, I, L, wb, Om] = p.el.map((v, i) => v + p.d[i] * T);
  const w = wb - Om;
  let M = ((L - wb + Mshift) % 360 + 540) % 360 - 180;
  M *= D2R;
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w * D2R), sw = Math.sin(w * D2R), cO = Math.cos(Om * D2R), sO = Math.sin(Om * D2R), cI = Math.cos(I * D2R), sI = Math.sin(I * D2R);
  return [(cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    (sw * sI) * xp + (cw * sI) * yp];
}

// eclipticas -> escena (marco fijo a la Tierra, Y = polo norte)
function makeFrame(jd) {
  const n = jd - 2451545.0;
  const eps = (23.439 - 0.0000004 * n) * D2R;
  const G = ((280.46061837 + 360.98564736629 * n) % 360) * D2R;
  return (x, y, z) => {
    const xq = x, yq = y * Math.cos(eps) - z * Math.sin(eps), zq = y * Math.sin(eps) + z * Math.cos(eps);
    const xf = xq * Math.cos(G) + yq * Math.sin(G), yf = -xq * Math.sin(G) + yq * Math.cos(G);
    return new THREE.Vector3(xf, zq, -yf);
  };
}

function moonEcl(jd) {
  const n = jd - 2451545.0;
  const L = 218.316 + 13.176396 * n, M = (134.963 + 13.064993 * n) * D2R, F = (93.272 + 13.229350 * n) * D2R;
  const D = (297.850 + 12.190749 * n) * D2R;
  const lam = (L + 6.289 * Math.sin(M) + 1.274 * Math.sin(2 * D - M) + 0.658 * Math.sin(2 * D)) * D2R;
  const bet = 5.128 * Math.sin(F) * D2R;
  const dist = (385001 - 20905 * Math.cos(M)) / R_KM;
  return [dist * Math.cos(bet) * Math.cos(lam), dist * Math.cos(bet) * Math.sin(lam), dist * Math.sin(bet)];
}

function ll2v(lat, lon, r = 1) {
  const la = lat * D2R, lo = lon * D2R;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

function noiseTex(base, opts = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 512, 256);
  let s = opts.seed || 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  if (opts.bands) {
    for (let y = 0; y < 256; y += 2) {
      const v = Math.sin(y * 0.11 + r()) * 0.5 + Math.sin(y * 0.031) * 0.5;
      g.fillStyle = `rgba(${v > 0 ? '255,255,255' : '60,10,10'},${Math.abs(v) * 0.22})`; g.fillRect(0, y, 512, 2);
    }
  }
  for (let i = 0; i < (opts.craters || 0); i++) {
    const x = r() * 512, y = r() * 256, rr = 2 + r() ** 3 * 22;
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fill();
  }
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${r() > .5 ? '255,255,255' : '0,0,0'},${r() * 0.08})`; g.fillRect(r() * 512, r() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const ZONES = [[3, 'ÓRBITA TERRESTRE'], [30, 'ÓRBITA ALTA'], [250, 'SISTEMA TIERRA–LUNA'], [6000, 'ESPACIO CERCANO'],
  [60000, 'SISTEMA SOLAR INTERIOR'], [1.2e6, 'SISTEMA SOLAR EXTERIOR'], [1e7, 'NUBE INTERESTELAR'], [Infinity, 'VÍA LÁCTEA (ilustr.)']];

export default {
  full: true,
  async mount(el) {
    el.innerHTML = `<div class="globe-wrap" id="gw">
      <div class="globe-labels" id="labels"></div>
      <div class="hud" style="left:10px;top:8px;max-width:50%">
        <div class="box"><span class="lbl">TU UBICACIÓN</span><br><b id="h-coord">buscando…</b><br><span id="h-acc"></span></div>
        <div class="box"><span class="lbl">HORA LOCAL</span><br><b id="h-time">--:--:--</b><br><span id="h-sun"></span></div></div>
      <div class="hud" style="right:10px;top:8px;text-align:right">
        <div class="box"><span class="lbl">ZOOM</span><br><b id="h-zone"></b><br><span id="h-dist"></span></div>
        <div class="box"><span class="lbl">LUNA</span><br><b id="h-moon"></b><br><span id="h-moond"></span></div></div>
      <div class="zoombar"><button id="zin">+</button><div class="track"><i id="zknob"></i></div><button id="zout">−</button>
        <button id="zme" title="Centrar en mí" style="font-size:12px">${icon('pin', 18)}</button><button id="zrot" style="font-size:11px">${icon('refresh', 16)}</button></div>
      <div class="hud" style="left:10px;bottom:10px"><div class="box" id="h-tip">Pellizca o usa +/− para alejarte: verás la Luna, el Sol y los planetas en su posición real de hoy.</div></div>
    </div>`;
    const wrap = $('#gw', el), labels = $('#labels', el);
    const W = () => wrap.clientWidth, H = () => wrap.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W(), H());
    wrap.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W() / H(), 0.001, 5e9);
    const jd = jdNow(), T = (jd - 2451545) / 36525;
    const toScene = makeFrame(jd);

    // ---- Tierra
    const earth = new THREE.Group(); scene.add(earth);
    const sunDir = new THREE.Vector3();
    const earthMat = new THREE.ShaderMaterial({
      uniforms: { sun: { value: sunDir } }, transparent: false,
      vertexShader: `varying vec3 vN; varying vec3 vW; varying vec3 vV;
        void main(){ vN=normalize(normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 sun; varying vec3 vN; varying vec3 vW; varying vec3 vV;
        void main(){ float f=pow(1.-max(dot(vN,vV),0.),2.5); float d=dot(vN,normalize(sun));
          vec3 night=vec3(.035,.004,.008), day=vec3(.16,.015,.03);
          vec3 c=mix(night,day,smoothstep(-.15,.35,d)) + vec3(1.,.1,.14)*f*.45;
          gl_FragColor=vec4(c,1.); }`,
    });
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), earthMat));
    // reticula
    const grid = [];
    for (let lat = -75; lat <= 75; lat += 15) for (let lon = 0; lon < 360; lon += 3) grid.push(ll2v(lat, lon, 1.002), ll2v(lat, lon + 3, 1.002));
    for (let lon = 0; lon < 360; lon += 15) for (let lat = -90; lat < 90; lat += 3) grid.push(ll2v(lat, lon, 1.002), ll2v(lat + 3, lon, 1.002));
    earth.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grid), new THREE.LineBasicMaterial({ color: 0xff2832, transparent: true, opacity: 0.09 })));
    // tierra firme y fronteras
    const data = await fetch('assets/globe.json').then(r => r.json());
    const pts = new Float32Array(data.dots.length / 2 * 3);
    for (let i = 0; i < data.dots.length; i += 2) { const v = ll2v(data.dots[i], data.dots[i + 1], 1.004); pts.set([v.x, v.y, v.z], i / 2 * 3); }
    const dotGeo = new THREE.BufferGeometry(); dotGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const dotMat = new THREE.PointsMaterial({ color: 0xff3b44, size: 0.012, sizeAttenuation: true, transparent: true, opacity: 0.85 });
    earth.add(new THREE.Points(dotGeo, dotMat));
    const bl = [];
    data.borders.forEach(l => { for (let i = 0; i < l.length - 2; i += 2) bl.push(ll2v(l[i + 1], l[i], 1.005), ll2v(l[i + 3], l[i + 2], 1.005)); });
    earth.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(bl), new THREE.LineBasicMaterial({ color: 0xff5a62, transparent: true, opacity: 0.45 })));
    // atmosfera
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(1.08, 64, 48), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float i=pow(max(0.,.62-dot(vN,vV)),3.); gl_FragColor=vec4(1.,.1,.14,1.)*i*1.4; }`,
    })));
    // anillos HUD (como la referencia)
    const hud = new THREE.Group(); earth.add(hud);
    const ringLine = (r, seg, arc, op, dash) => {
      const p = [];
      for (let i = 0; i <= seg; i++) { const a = arc * i / seg; p.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
      const g = new THREE.BufferGeometry().setFromPoints(p);
      const m = dash ? new THREE.LineDashedMaterial({ color: 0xff2832, dashSize: dash, gapSize: dash, transparent: true, opacity: op })
        : new THREE.LineBasicMaterial({ color: 0xff2832, transparent: true, opacity: op });
      const l = new THREE.Line(g, m); if (dash) l.computeLineDistances(); return l;
    };
    const r1 = ringLine(1.32, 200, Math.PI * 2, 0.35, 0.02); r1.rotation.x = 0.25; hud.add(r1);
    const r2 = ringLine(1.42, 120, Math.PI * 1.2, 0.7); r2.rotation.x = -0.35; r2.rotation.z = 0.2; hud.add(r2);
    const r3 = ringLine(1.5, 60, Math.PI * 0.35, 0.95); r3.rotation.x = -0.35; r3.rotation.z = 0.2; hud.add(r3);
    const ticks = [];
    for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, l = i % 10 ? 1.55 : 1.6; ticks.push(new THREE.Vector3(Math.cos(a) * 1.52, 0, Math.sin(a) * 1.52), new THREE.Vector3(Math.cos(a) * l, 0, Math.sin(a) * l)); }
    const tk = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), new THREE.LineBasicMaterial({ color: 0xff2832, transparent: true, opacity: 0.4 }));
    tk.rotation.x = 0.1; hud.add(tk);

    // ---- marcador de ubicacion
    const marker = new THREE.Group(); earth.add(marker);
    const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(.25, '#ff2832'); gr.addColorStop(1, 'rgba(255,40,50,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const mdot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, depthTest: true, blending: THREE.AdditiveBlending }));
    mdot.scale.set(0.09, 0.09, 1); marker.add(mdot);
    const pulse = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.036, 48), new THREE.MeshBasicMaterial({ color: 0xff2832, transparent: true, side: THREE.DoubleSide }));
    marker.add(pulse);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.25, 6), new THREE.MeshBasicMaterial({ color: 0xff2832, transparent: true, opacity: 0.8 }));
    beam.position.y = 0.125; const beamG = new THREE.Group(); beamG.add(beam); marker.add(beamG);
    let me = null;
    const placeMarker = (lat, lon) => {
      const v = ll2v(lat, lon, 1.006);
      marker.position.copy(v);
      marker.lookAt(v.clone().multiplyScalar(2));
      beamG.rotation.x = Math.PI / 2;
      // arcos a ciudades (enlaces)
      [[40.71, -74.0], [51.5, -0.12], [35.68, 139.69], [-23.55, -46.63], [19.43, -99.13], [28.61, 77.2]].forEach(([a, b]) => {
        const s = ll2v(lat, lon, 1.006), e = ll2v(a, b, 1.006), m = s.clone().add(e).multiplyScalar(0.5);
        const ang = s.angleTo(e); m.normalize().multiplyScalar(1 + ang * 0.28);
        const c = new THREE.QuadraticBezierCurve3(s, m, e);
        const g = new THREE.BufferGeometry().setFromPoints(c.getPoints(60));
        const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xff4d55, dashSize: 0.02, gapSize: 0.015, transparent: true, opacity: 0.6 }));
        l.computeLineDistances(); earth.add(l);
      });
    };

    // ---- Sol, Luna y planetas (posiciones reales de hoy)
    const sunEcl = (() => { const n = jd - 2451545, g = (357.528 + 0.9856003 * n) * D2R, L = (280.460 + 0.9856474 * n) * D2R;
      const lam = L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R, r = (1.00014 - 0.01671 * Math.cos(g)) * AU;
      return [r * Math.cos(lam), r * Math.sin(lam), 0]; })();
    const sunPos = toScene(...sunEcl);
    sunDir.copy(sunPos).normalize();
    const earthHelio = kepler(PLANETS[2], T);
    const helioToScene = (h) => toScene((h[0] - earthHelio[0]) * AU, (h[1] - earthHelio[1]) * AU, (h[2] - earthHelio[2]) * AU);
    const sunScene = helioToScene([0, 0, 0]);
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(109, 48, 32), new THREE.MeshBasicMaterial({ color: 0xff3b2a }));
    sunMesh.position.copy(sunScene); scene.add(sunMesh);
    const glowTex = dotTex;
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff5040, blending: THREE.AdditiveBlending, depthWrite: false }));
    sunGlow.position.copy(sunScene); sunGlow.scale.set(900, 900, 1); scene.add(sunGlow);
    const light = new THREE.PointLight(0xffd0c0, 3, 0, 0); light.position.copy(sunScene); scene.add(light);
    scene.add(new THREE.AmbientLight(0x401014, 0.6));

    const mE = moonEcl(jd), moonPos = toScene(...mE);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.2727, 48, 32), new THREE.MeshStandardMaterial({ map: noiseTex('#7a5a5a', { craters: 160, seed: 9 }), roughness: 1 }));
    moon.position.copy(moonPos); scene.add(moon);
    const moonOrbit = []; for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; const r = moonPos.length(); moonOrbit.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const mo = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(moonOrbit), new THREE.LineBasicMaterial({ color: 0xff2832, transparent: true, opacity: 0.25 }));
    mo.lookAt(moonPos.clone().cross(new THREE.Vector3(0, 1, 0)).cross(moonPos)); scene.add(mo);
    // la orbita se orienta con el plano que contiene a la Luna (aprox)
    mo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toScene(0, 0, 1).normalize());

    const bodies = [{ name: 'Luna', obj: moon, real: 0.2727, min: 0.004 }, { name: 'Sol', obj: sunMesh, real: 109, min: 0.012 }];
    PLANETS.forEach((p, i) => {
      if (p.earth) return;
      const pos = helioToScene(kepler(p, T));
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshStandardMaterial({ map: noiseTex(p.c, { bands: p.bands, craters: p.bands ? 0 : 40, seed: i + 2 }), roughness: 0.9, emissive: new THREE.Color(0x330508) }));
      m.position.copy(pos); scene.add(m);
      if (p.ring) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 2.3, 64), new THREE.MeshBasicMaterial({ color: 0xffb08a, side: THREE.DoubleSide, transparent: true, opacity: 0.45 }));
        ring.rotation.x = Math.PI / 2.4; m.add(ring);
      }
      // orbita completa
      const op = []; for (let k = 0; k <= 240; k++) op.push(helioToScene(kepler(p, T, k * 1.5)));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(op), new THREE.LineBasicMaterial({ color: 0xff2832, transparent: true, opacity: 0.28 })));
      bodies.push({ name: p.n, obj: m, real: p.r, min: 0.006, planet: true });
    });
    // orbita de la Tierra
    const eo = []; for (let k = 0; k <= 240; k++) eo.push(helioToScene(kepler(PLANETS[2], T, k * 1.5)));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(eo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })));

    // estrellas
    const sp = []; let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 6000; i++) { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = 3e8; sp.push(Math.sqrt(1 - u * u) * Math.cos(a) * r, u * r, Math.sqrt(1 - u * u) * Math.sin(a) * r); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffd6d8, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8 })));
    // galaxia (escala ilustrativa) para el zoom maximo
    const gp = [], gc = [];
    for (let i = 0; i < 30000; i++) {
      const arm = i % 4, t = rnd() ** 0.6, ang = t * 9 + arm * Math.PI / 2 + (rnd() - .5) * 0.6, rr = t * 6e7;
      gp.push(Math.cos(ang) * rr + (rnd() - .5) * 3e6, (rnd() - .5) * 2e6 * (1 - t), Math.sin(ang) * rr + (rnd() - .5) * 3e6);
      const c = 0.35 + rnd() * 0.45; gc.push(c, c * (0.08 + (1 - t) * 0.35), c * (0.1 + (1 - t) * 0.3));
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
    const galaxyMat = new THREE.PointsMaterial({ size: 1.1, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
    const galaxy = new THREE.Points(gg, galaxyMat);
    galaxy.position.set(-3.8e7, -2e6, 0); galaxy.rotation.z = 0.5; scene.add(galaxy);

    // ---- camara orbital
    let dist = 4.4, theta = 0, phi = 0.35, auto = true, targetDist = 4.4;
    const MIN = 1.15, MAX = 2.5e8;
    const target = new THREE.Vector3();
    const lerpT = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const updateCam = () => {
      const k = lerpT(4000, 80000, dist);
      target.copy(sunScene).multiplyScalar(k);
      const g = lerpT(6e7, 2e8, dist);
      target.lerp(galaxy.position.clone().add(new THREE.Vector3(3.8e7, 0, 0)).multiplyScalar(0.5), g);
      camera.position.set(Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta)).multiplyScalar(dist).add(target);
      camera.lookAt(target);
      camera.near = Math.max(0.0005, dist * 0.0002); camera.updateProjectionMatrix();
    };
    const focusOn = (lat, lon) => { const v = ll2v(lat, lon); theta = Math.atan2(v.x, v.z); phi = lat * D2R * 0.8; };
    // gestos
    const cvs = renderer.domElement;
    let pts2 = new Map(), pinch0 = 0, dist0 = 0;
    cvs.addEventListener('pointerdown', e => { cvs.setPointerCapture(e.pointerId); pts2.set(e.pointerId, { x: e.clientX, y: e.clientY }); auto = false;
      if (pts2.size === 2) { const [a, b] = [...pts2.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = targetDist; } });
    cvs.addEventListener('pointermove', e => {
      const p = pts2.get(e.pointerId); if (!p) return;
      if (pts2.size === 1) {
        const sp = Math.min(1, Math.max(0.15, (dist - 1) / 3)) * 0.006;
        theta -= (e.clientX - p.x) * sp; phi = Math.max(-1.45, Math.min(1.45, phi + (e.clientY - p.y) * sp));
      }
      p.x = e.clientX; p.y = e.clientY;
      if (pts2.size === 2) { const [a, b] = [...pts2.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); targetDist = clampD(dist0 * Math.pow(pinch0 / d, 2.2)); }
    });
    const up = e => { pts2.delete(e.pointerId); };
    cvs.addEventListener('pointerup', up); cvs.addEventListener('pointercancel', up);
    cvs.addEventListener('wheel', e => { e.preventDefault(); targetDist = clampD(targetDist * Math.pow(1.0018, e.deltaY)); }, { passive: false });
    const clampD = d => Math.max(MIN, Math.min(MAX, d));
    const zoomBy = f => { targetDist = clampD(targetDist * f); native.vibrate(6); };
    $('#zin', el).onclick = () => zoomBy(1 / 4);
    $('#zout', el).onclick = () => zoomBy(targetDist < 4 ? 3 : 6);
    $('#zme', el).onclick = () => { targetDist = 2.4; if (me) focusOn(me.lat, me.lon); auto = false; };
    $('#zrot', el).onclick = () => { auto = !auto; toast(auto ? 'Giro automático activado' : 'Giro automático detenido'); };
    window.__crkGlobe = { zoom: d => { targetDist = clampD(d); }, get dist() { return dist; } };

    // ---- ubicacion real
    const tz = -new Date().getTimezoneOffset() / 60;
    native.location().then(p => {
      me = p; placeMarker(p.lat, p.lon); focusOn(p.lat, p.lon);
      $('#h-coord', el).textContent = `${Math.abs(p.lat).toFixed(4)}°${p.lat >= 0 ? 'N' : 'S'}  ${Math.abs(p.lon).toFixed(4)}°${p.lon >= 0 ? 'E' : 'O'}`;
      $('#h-acc', el).textContent = p.acc ? `precisión ±${Math.round(p.acc)} m · ${p.src || 'GPS'}` : (p.src || 'GPS');
    }).catch(() => {
      const lon = tz * 15; me = { lat: 15, lon, approx: true }; placeMarker(15, lon); focusOn(15, lon);
      $('#h-coord', el).textContent = 'GPS no disponible';
      $('#h-acc', el).textContent = `aprox. por tu zona horaria (UTC${tz >= 0 ? '+' : ''}${tz}) · activa la ubicación`;
    });

    // fase lunar real
    const elong = Math.acos(Math.max(-1, Math.min(1, moonPos.clone().normalize().dot(sunDir))));
    const illum = Math.round((1 - Math.cos(elong)) / 2 * 100);
    $('#h-moon', el).textContent = `${illum}% iluminada`;
    $('#h-moond', el).textContent = `${Math.round(moonPos.length() * R_KM).toLocaleString('es')} km de la Tierra`;

    // ---- etiquetas HTML
    const lab = {};
    const label = (key, text, cls = '') => { if (!lab[key]) { lab[key] = document.createElement('div'); lab[key].className = cls; labels.appendChild(lab[key]); } lab[key].textContent = text; return lab[key]; };
    const project = (v, d) => {
      const p = v.clone().project(camera);
      if (p.z > 1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) { d.style.display = 'none'; return; }
      d.style.display = ''; d.style.left = ((p.x + 1) / 2 * W()) + 'px'; d.style.top = ((1 - p.y) / 2 * H()) + 'px';
    };

    let raf, last = performance.now(), frame = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; frame++;
      dist += (targetDist - dist) * Math.min(1, dt * 4);
      if (Math.abs(targetDist - dist) / dist < 0.001) dist = targetDist;
      if (auto) theta += dt * 0.08 * Math.min(1, 3 / dist + 0.05);
      hud.rotation.y += dt * 0.2; r2.rotation.y -= dt * 0.5; r3.rotation.y += dt * 0.9;
      const t = (now / 1000) % 1.6 / 1.6;
      pulse.scale.setScalar(1 + t * 2.5); pulse.material.opacity = 1 - t;
      updateCam();
      bodies.forEach(b => { b.obj.scale.setScalar(Math.max(b.real, camera.position.distanceTo(b.obj.position) * b.min) / (b.obj === sunMesh ? 109 : 1)); });
      const se = camera.position.distanceTo(sunScene); sunGlow.scale.setScalar(Math.max(900, se * 0.05));
      const earthScale = Math.max(1, dist * 0.004);
      earth.scale.setScalar(earthScale);
      dotMat.size = 0.011 * Math.min(1.5, Math.max(0.22, (dist - 1) / 2.6));
      hud.visible = dist > 2.3 && dist < 40;
      galaxyMat.opacity = lerpT(2e7, 1.2e8, dist) * 0.95;
      // etiquetas
      if (me) { const v = marker.getWorldPosition(new THREE.Vector3()); const d = label('me', dist < 6000 ? 'TÚ ESTÁS AQUÍ' : 'TIERRA · TÚ'); project(v, d); }
      bodies.forEach(b => {
        const show = b.name === 'Luna' ? dist > 6 && dist < 40000 : b.planet ? dist > 3000 : dist > 400;
        const d = label(b.name, b.name.toUpperCase(), 'planet');
        if (show && dist < 1.5e8) project(b.obj.position, d); else d.style.display = 'none';
      });
      const gl = label('gal', 'VÍA LÁCTEA', 'planet'); if (galaxyMat.opacity > 0.3) project(galaxy.position, gl); else gl.style.display = 'none';
      if (frame % 10 === 0) {
        const zone = ZONES.find(z => dist < z[0])[1];
        $('#h-zone', el).textContent = zone;
        const km = (dist - 1) * R_KM;
        $('#h-dist', el).textContent = km < 1e6 ? `${Math.round(km).toLocaleString('es')} km` : km < 1e9 * 1.5 ? `${(km / 1.496e8).toFixed(2)} UA` : `${(km / 9.461e12).toFixed(3)} años luz`;
        const z = Math.log(dist / MIN) / Math.log(MAX / MIN);
        $('#zknob', el).style.top = (z * 128) + 'px';
        const d = new Date();
        $('#h-time', el).textContent = d.toLocaleTimeString('es', { hour12: false });
        if (me) {
          const up = ll2v(me.lat, me.lon); const alt = Math.asin(up.dot(sunDir)) / D2R;
          $('#h-sun', el).textContent = alt > 0 ? `☀ de día · sol a ${alt.toFixed(0)}°` : `☾ de noche · sol a ${alt.toFixed(0)}°`;
        }
      }
      renderer.render(scene, camera);
    };
    updateCam();
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); });
    ro.observe(wrap);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); delete window.__crkGlobe; };
  },
};
