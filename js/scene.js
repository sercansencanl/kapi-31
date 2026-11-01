import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Yuvarlatılmış kutu (kabin, tampon gibi yumuşak hatlı parçalar için)
const rgeoCache = new Map();
function rbox(w, h, d, r, mat, x = 0, y = 0, z = 0, parent) {
  const key = `${w}|${h}|${d}|${r}`;
  if (!rgeoCache.has(key)) rgeoCache.set(key, new RoundedBoxGeometry(w, h, d, 3, r));
  const m = new THREE.Mesh(rgeoCache.get(key), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

// Son renk düzenlemesi: hafif kontrast, sıcak ışık / soğuk gölge ayrımı, vinyet ve ince film greni.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.32 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float vignette; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c = mix(c, c * vec3(0.94,1.0,1.07), (1.0 - smoothstep(0.0,0.5,l)) * 0.5);   // gölgeler hafif soğuk
      c = mix(c, c * vec3(1.06,1.01,0.93), smoothstep(0.5,1.0,l) * 0.5);          // ışıklar hafif sıcak
      c = (c - 0.5) * 1.06 + 0.5;                                                 // kontrast
      c = mix(vec3(l), c, 1.08);                                                  // doygunluk
      vec2 d = vUv - 0.5; c *= 1.0 - vignette * smoothstep(0.35, 0.95, length(d * vec2(1.15, 1.0)));
      c += (hash(vUv * 900.0 + time) - 0.5) * 0.018;                              // gren
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};
import { tween, Ease, updateTweens, Trauma, settings, wait } from './feel.js';
import * as art from './art.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (color, roughness = 0.7, metalness = 0.05, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
function cyl(rt, rb, h, seg, mat, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

// Kabin konsolu yerleşimi (konsol yerel koordinatı: x yatay, z eğim boyunca; negatif = yukarı/uzak).
const DESK_LAYOUT = {
  wide: {
    s: 0.69,
    manifest: [-0.43, -0.2, -0.05], decl: [-0.145, -0.18, 0.06],
    led: [0.15, -0.39], tablet: [0.16, -0.15], inspect: [0.39, -0.33],
    onay: [0.33, -0.06], vergi: [0.47, -0.06], ret: [0.61, -0.06],
    mug: [-0.61, -0.44], sticky: [-0.6, -0.27, 0.12],
    read: { manifest: [-0.27, -0.02, -0.8], decl: [0.05, -0.02, -0.8] }, // sağdaki el kitabı paneline yer bırak
  },
  narrow: {
    s: 0.37,
    manifest: [-0.14, -0.33, -0.04], decl: [0.15, -0.32, 0.05],
    led: [-0.2, -0.56], tablet: [0.2, -0.56], inspect: [-0.27, 0.0],
    onay: [-0.09, 0.0], vergi: [0.09, 0.0], ret: [0.27, 0.0],
    read: { manifest: [0, 0.03, -0.72], decl: [0, -0.01, -0.7] },
  },
};
const PAPER_W = 0.27, PAPER_H = 0.36;

const VIEWS = {
  booth: { pos: V(-6.6, 6.6, 18.5), target: V(0.9, -0.7, 0) },
  rear:  { pos: V(12.4, 3.0, 4.4),  target: V(4.6, 2.2, 0) },
};
const YARD_COLORS = ['#a8432f', '#2c6a8a', '#cf9f33', '#4c7548', '#8a9096', '#6a3c5a', '#d6cfc0', '#24456a', '#b8572c', '#3b8a86'];

export class World {
  constructor(canvas, host) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xf1cfae, 80, 430);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1500);

    this.cam = { pos: VIEWS.booth.pos.clone(), target: VIEWS.booth.target.clone() };
    this.title = true;
    this.mouse = { x: 0, y: 0 }; this.par = { x: 0, y: 0 };
    this.trauma = new Trauma();
    this.time = 0; this.frozen = 0; this.last = performance.now();
    this.truck = null;
    this.smoke = [];
    this.handlers = { hover: () => {}, containerClick: () => {} };

    this.buildLights();
    this.buildSky();
    this.buildGround();
    this.buildGate();
    this.buildYard();
    this.buildPort();
    this.buildBirds();
    this.buildSmoke();
    this.buildDesk();
    this.setupPost();

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    canvas.addEventListener('pointermove', (e) => this.onPointer(e));
    canvas.addEventListener('pointerleave', () => { this.mouse.x = this.mouse.y = 0; this.setHover(null); });
    canvas.addEventListener('click', (e) => this.onClick(e));

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    requestAnimationFrame((t) => this.loop(t));
  }

  on(name, fn) { this.handlers[name] = fn; }

  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = this.camera.aspect < 1.3 ? 52 : 38;
    this.camera.updateProjectionMatrix();
    this.layoutDesk();
  }

  // ---------------- Render hattı ----------------
  setupPost() {
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    // Ortam yansıması: metal, cam ve boyalı yüzeyler çevreyi yansıtır.
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();
    try {
      const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
      const c = this.composer = new EffectComposer(r);
      c.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.45, 0.5, 3.0);
      c.addPass(this.bloom);
      c.addPass(new OutputPass());
      this.grade = new ShaderPass(GradeShader);
      c.addPass(this.grade);
      c.addPass(new SMAAPass(w * r.getPixelRatio(), h * r.getPixelRatio()));
    } catch (err) {
      console.warn('Efektler kapatıldı:', err);
      this.composer = null;
    }
  }

  // ---------------- Kabin konsolu (kameraya bağlı 3D masa) ----------------
  buildDesk() {
    this.scene.add(this.camera);
    const rig = this.rig = new THREE.Group();
    rig.visible = false; rig.position.y = -1.2;
    this.camera.add(rig);
    const con = this.con = new THREE.Group();
    con.rotation.x = 0.75;
    rig.add(con);

    const metal = std('#ffffff', 0.42, 0.5, { map: art.brushedMetal() }), dark = std('#1b2227', 0.7, 0.3);
    // Yüzey z: -0.5 (uzak, ekranın ortasına yakın) ile +0.6 (yakın, ekran dışı) arası
    box(3.6, 0.06, 1.1, metal, 0, -0.03, 0.05, con);
    box(3.6, 0.05, 0.04, dark, 0, 0.012, -0.5, con);   // arka kenar (pencere pervazı)
    box(3.6, 0.5, 0.04, dark, 0, -0.25, -0.52, con);   // pervaz altı, kamyonla konsol arası
    this.deskMat = box(0.66, 0.003, 0.46, std('#ffffff', 0.9, 0, { map: art.blotter() }), 0, 0.0, 0, con);
    // Konsolun yakın kenarında kauçuk kol dayama
    const pad = cyl(0.025, 0.025, 3.6, 12, std('#20282d', 0.9, 0.1), con); pad.rotation.z = Math.PI / 2; pad.position.set(0, 0.02, 0.22);

    // Masa detayları: kupa, yapışkan not, kalem
    const mug = this.mug = new THREE.Group(); con.add(mug);
    const mugMat = std('#1f3a4c', 0.5, 0.1);
    const body = cyl(0.034, 0.03, 0.075, 20, mugMat, mug); body.position.y = 0.0375;
    const coffee = cyl(0.03, 0.03, 0.002, 20, std('#3b2416', 0.3, 0), mug); coffee.position.y = 0.068;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 16, Math.PI), mugMat);
    handle.rotation.z = -Math.PI / 2; handle.position.set(0.034, 0.038, 0); mug.add(handle);
    const band = cyl(0.0345, 0.0345, 0.012, 20, std('#f0b928', 0.5, 0.1), mug); band.position.y = 0.05;
    this.sticky = this.flatLabel(art.stickyNote(['Sınır 26 t', '20 t üstü:', 'ağır yük!']), 0.11, 0.11);
    this.sticky.material.transparent = false; con.add(this.sticky);
    const pencil = this.pencil = new THREE.Group(); con.add(pencil);
    const pb = cyl(0.006, 0.006, 0.15, 6, std('#e9b320', 0.6, 0), pencil); pb.rotation.z = Math.PI / 2; pb.position.y = 0.006;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.02, 6), std('#d8c19a', 0.8, 0)); tip.rotation.z = Math.PI / 2; tip.position.set(-0.085, 0.006, 0); pencil.add(tip);

    // Pencere çerçevesi
    this.frame = new THREE.Group(); rig.add(this.frame);
    const fm = std('#1f2a31', 0.6, 0.3);
    this.framePosts = [box(0.05, 3, 0.05, fm, 0, 0, -1.3, this.frame), box(0.05, 3, 0.05, fm, 0, 0, -1.3, this.frame)];
    this.frameTop = box(4, 0.06, 0.05, fm, 0, 0, -1.3, this.frame);

    // Kantar LED'i (konsola gömülü)
    this.deskLed = art.makeLed();
    const led = new THREE.Group(); con.add(led);
    box(0.29, 0.02, 0.13, dark, 0, 0.005, 0, led);
    const ledFace = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.108), new THREE.MeshBasicMaterial({ map: this.deskLed.texture, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) }));
    ledFace.rotation.x = -Math.PI / 2; ledFace.position.y = 0.016; led.add(ledFace);
    this.ledGroup = led;

    // Tablet (el kitabı)
    const tab = new THREE.Group(); con.add(tab);
    box(0.27, 0.014, 0.19, std('#111619', 0.4, 0.5), 0, 0.007, 0, tab);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.245, 0.17), new THREE.MeshBasicMaterial({ map: art.tabletTexture(), toneMapped: false }));
    screen.rotation.x = -Math.PI / 2; screen.position.y = 0.0145; tab.add(screen);
    screen.userData.action = 'tablet'; screen.userData.tip = 'El kitabı ve emisyon formu';
    this.tablet = tab; this.tabletScreen = screen;

    // Düğmeler
    this.buttons = {};
    const mk = (name, color, text, sub) => {
      const g = new THREE.Group(); con.add(g);
      const base = cyl(0.052, 0.058, 0.022, 28, dark, g); base.position.y = 0.011;
      const capMat = std(color, 0.35, 0.1, { emissive: color, emissiveIntensity: 0.25 });
      const icon = art.capTexture(name, color);
      const topMat = std('#ffffff', 0.35, 0.1, { map: icon, emissive: '#ffffff', emissiveMap: icon, emissiveIntensity: 0.25 });
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.044, 0.03, 28), [capMat, topMat, capMat]);
      cap.position.y = 0.032; g.add(cap);
      const label = this.flatLabel(art.labelTexture(text, sub), 0.135, 0.046);
      label.position.set(0, 0.003, -0.088); g.add(label);
      cap.userData.action = name; base.userData.action = name;
      this.buttons[name] = { g, cap, capMat, topMat, label, enabled: false, locked: false, color };
      return g;
    };
    mk('onay', '#2f9a5e', 'Geçiş ver', '1');
    mk('vergi', '#f0b928', 'Vergi kes', '2');
    mk('ret', '#c8412f', 'Geri çevir', '3');
    mk('inspect', '#e9862a', 'Kasayı aç', 'E');

    // Masa lambası ışığı
    const lamp = new THREE.PointLight(0xffe6c0, 0.9, 3.5, 1.2); lamp.position.set(-0.1, 0.45, -0.85); rig.add(lamp);

    this.papers = {};
    rig.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    this.layoutDesk();
  }

  flatLabel(texture, w, h) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7, transparent: true }));
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  layoutDesk() {
    if (!this.con) return;
    const d = 1.25, hh = Math.tan((this.camera.fov * Math.PI) / 360) * d, hw = hh * this.camera.aspect;
    const L = this.camera.aspect >= 1.1 ? DESK_LAYOUT.wide : DESK_LAYOUT.narrow;
    this.layout = L;
    const s = Math.max(0.5, Math.min(1.25, hw / L.s));
    this.con.scale.setScalar(s);
    this.con.position.set(0, -0.84 * hh, -d);
    const place = (obj, [x, z]) => obj.position.set(x, 0, z);
    place(this.ledGroup, L.led); place(this.tablet, L.tablet);
    ['onay', 'vergi', 'ret', 'inspect'].forEach((n) => place(this.buttons[n].g, L[n]));
    this.deskMat.position.set((L.manifest[0] + L.decl[0]) / 2, 0.0015, L.manifest[1]);
    const deco = (obj, p) => { obj.visible = !!p; if (p) { obj.position.set(p[0], obj === this.sticky ? 0.0045 : 0, p[1]); if (obj === this.sticky) obj.rotation.set(-Math.PI / 2, 0, p[2]); else if (p[2] != null) obj.rotation.y = p[2]; } };
    deco(this.mug, L.mug); deco(this.sticky, L.sticky); deco(this.pencil, L.pencil);
    // pencere çerçevesi ekran kenarlarında
    const fh = Math.tan((this.camera.fov * Math.PI) / 360) * 1.3, fw = fh * this.camera.aspect;
    this.framePosts[0].position.set(-fw + 0.02, 0, -1.3); this.framePosts[1].position.set(fw - 0.02, 0, -1.3);
    this.frameTop.position.set(0, fh - 0.025, -1.3);
    for (const [k, p] of Object.entries(this.papers)) if (!p.userData.up && !p.userData.busy) this.restPaper(k, p);
  }

  restPaper(kind, p) {
    const [x, z, r] = this.layout[kind];
    p.position.set(x, kind === 'decl' ? 0.009 : 0.006, z);
    p.rotation.set(-Math.PI / 2, 0, r);
    p.scale.setScalar(1);
  }

  async deskShow(on, dur = 0.6) {
    const from = this.rig.position.y, to = on ? 0 : -1.2;
    if (on) this.rig.visible = true;
    await tween(dur, (k) => { this.rig.position.y = from + (to - from) * k; }, on ? Ease.outCubic : Ease.inCubic);
    if (!on) this.rig.visible = false;
  }

  setButtons(state) {
    for (const [n, st] of Object.entries(state)) {
      const b = this.buttons[n]; if (!b) continue;
      b.enabled = !!st.enabled; b.locked = !!st.locked;
      b.capMat.color.set(b.locked ? '#4a555d' : b.color);
      b.capMat.emissive.set(b.locked ? '#000000' : b.color);
      b.topMat.color.set(b.locked ? '#55606a' : '#ffffff');
      b.topMat.emissive.set(b.locked ? '#000000' : '#ffffff');
      b.capMat.emissiveIntensity = b.enabled ? 0.45 : 0.05;
      b.label.material.opacity = b.locked ? 0.35 : b.enabled ? 1 : 0.6;
    }
  }

  async pressButton(n) {
    const b = this.buttons[n]; if (!b) return;
    await tween(0.07, (k) => { b.cap.position.y = 0.032 - 0.016 * k; }, Ease.outCubic);
    tween(0.25, (k) => { b.cap.position.y = 0.016 + 0.016 * k; }, Ease.outBack);
  }

  setDeskLed(big, small) { this.deskLed.set(big, small); }

  async showPapers(t, day) {
    await this.clearPapers(true);
    const kinds = t.hasDecl ? ['manifest', 'decl'] : ['manifest'];
    for (const [i, kind] of kinds.entries()) {
      const texMap = kind === 'manifest' ? art.manifestTexture(t) : art.declTexture(t);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(PAPER_W, PAPER_H), new THREE.MeshStandardMaterial({ map: texMap, roughness: 0.85, side: THREE.DoubleSide, emissive: '#f0b928', emissiveIntensity: 0 }));
      p.userData = { action: `paper:${kind}`, tip: kind === 'manifest' ? 'Manifestoyu oku' : 'Beyanı oku', up: false, busy: true, glow: 2.2 };
      this.con.add(p);
      this.papers[kind] = p;
      this.restPaper(kind, p);
      const end = p.position.clone();
      const start = end.clone().add(V(0, 0.05, -0.75));
      p.position.copy(start);
      tween(0.55, (k) => p.position.lerpVectors(start, end, k), Ease.outCubic).then(() => { p.userData.busy = false; });
      await wait(0.15 + i * 0.05);
    }
  }

  async clearPapers(instant = false) {
    const list = Object.values(this.papers);
    this.papers = {};
    await Promise.all(list.map(async (p) => {
      if (!instant) {
        if (p.parent !== this.con) this.con.attach(p);
        const s = p.position.clone(), e = s.clone().add(V(0, 0.05, -0.8));
        await tween(0.4, (k) => p.position.lerpVectors(s, e, k), Ease.inCubic);
      }
      p.parent?.remove(p); p.material.map?.dispose(); p.material.dispose(); p.geometry.dispose();
    }));
  }

  // Kağıdı okuma pozisyonuna kaldır / masaya bırak.
  // Her animasyon bir sıra numarası alır; yenisi başlayınca eskisinin kareleri yok sayılır.
  // Böylece hareket halindeki kağıda gelen komut kaybolmaz, son komut kazanır.
  async togglePaper(kind, force) {
    const p = this.papers[kind]; if (!p) return;
    const up = force ?? !(p.userData.target ?? p.userData.up);
    if (up === (p.userData.target ?? p.userData.up)) return;
    const id = (p.userData.anim = (p.userData.anim || 0) + 1);
    p.userData.target = up; p.userData.busy = true;
    this.con.updateMatrix();
    if (up) {
      this.rig.attach(p);
      const sP = p.position.clone(), sQ = p.quaternion.clone(), sS = p.scale.x;
      const [x, y, z] = this.layout.read[kind];
      const eP = V(x, y, z), eQ = new THREE.Quaternion();
      await tween(0.4, (k) => { if (p.userData.anim !== id) return; p.position.lerpVectors(sP, eP, k); p.quaternion.slerpQuaternions(sQ, eQ, k); p.scale.setScalar(sS + (1 - sS) * k); }, Ease.outCubic);
    } else {
      if (p.parent !== this.rig) this.rig.attach(p);
      const [x, z, r] = this.layout[kind];
      const local = new THREE.Matrix4().compose(V(x, 0.006, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, r)), V(1, 1, 1));
      const m = this.con.matrix.clone().multiply(local);
      const eP = V(), eQ = new THREE.Quaternion(), eS = V(); m.decompose(eP, eQ, eS);
      const sP = p.position.clone(), sQ = p.quaternion.clone(), sS = p.scale.x;
      await tween(0.35, (k) => { if (p.userData.anim !== id) return; p.position.lerpVectors(sP, eP, k); p.quaternion.slerpQuaternions(sQ, eQ, k); p.scale.setScalar(sS + (eS.x - sS) * k); }, Ease.inOutCubic);
    }
    if (p.userData.anim !== id || this.papers[kind] !== p) return; // daha yeni bir komut geldi ya da kağıt kaldırıldı
    if (!up) { this.con.attach(p); this.restPaper(kind, p); }
    p.userData.up = up; p.userData.target = undefined; p.userData.busy = false;
  }
  lowerPapers() { return Promise.all(Object.keys(this.papers).map((k) => this.togglePaper(k, false))); }

  // Animasyonsuz, anında masaya bırak (kasa görünümüne geçerken).
  snapPapersDown() {
    for (const [kind, p] of Object.entries(this.papers)) {
      p.userData.anim = (p.userData.anim || 0) + 1; // süren animasyonu iptal et
      if (p.parent !== this.con) this.con.attach(p);
      this.restPaper(kind, p);
      p.userData.up = false; p.userData.target = undefined; p.userData.busy = false;
    }
  }
  anyPaperUp() { return Object.values(this.papers).some((p) => p.userData.up); }

  // 3D nesnenin ekrandaki dikdörtgeni (rehber vurgusu için).
  rectOf(key) {
    const obj = key === 'papers' ? Object.values(this.papers) : key === 'buttons' ? ['onay', 'vergi', 'ret'].map((n) => this.buttons[n].g)
      : key === 'inspect' ? [this.buttons.inspect.g] : key === 'led' ? [this.ledGroup] : key === 'tablet' ? [this.tablet]
        : key === 'decl' ? [this.papers.decl] : [];
    const box3 = new THREE.Box3();
    obj.filter(Boolean).forEach((o) => box3.expandByObject(o));
    if (box3.isEmpty()) return null;
    this.camera.updateMatrixWorld();
    const r = this.renderer.domElement.getBoundingClientRect();
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const v = V(i & 1 ? box3.max.x : box3.min.x, i & 2 ? box3.max.y : box3.min.y, i & 4 ? box3.max.z : box3.min.z).project(this.camera);
      const sx = r.left + (v.x + 1) / 2 * r.width, sy = r.top + (1 - v.y) / 2 * r.height;
      x1 = Math.min(x1, sx); y1 = Math.min(y1, sy); x2 = Math.max(x2, sx); y2 = Math.max(y2, sy);
    }
    return { left: x1, top: y1, right: x2, bottom: y2, width: x2 - x1, height: y2 - y1 };
  }

  // ---------------- Çevre ----------------
  buildLights() {
    const hemi = new THREE.HemisphereLight(0xcfe0f0, 0x8a7a66, 0.75);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd9ad, 2.6);
    sun.position.set(-38, 42, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 26; sc.bottom = -26; sc.far = 140;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(1200, 32, 20);
    const cols = [];
    const top = new THREE.Color('#4f86bb'), mid = new THREE.Color('#a5c3da'), hor = new THREE.Color('#f4d3b0');
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 1200;
      const c = y > 0.25 ? mid.clone().lerp(top, Math.min(1, (y - 0.25) / 0.6)) : hor.clone().lerp(mid, Math.max(0, y / 0.25));
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: art.sunGlow(), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(-420, 70, -700); glow.scale.set(380, 380, 1);
    this.scene.add(glow);
  }

  buildGround() {
    const s = this.scene;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), std('#ffffff', 0.95, 0, { map: art.concreteTexture() }));
    ground.rotation.x = -Math.PI / 2; ground.position.z = -100; ground.receiveShadow = true; s.add(ground);

    const lane = new THREE.Mesh(new THREE.PlaneGeometry(220, 8.2), std('#ffffff', 0.88, 0, { map: art.asphaltTexture() }));
    lane.rotation.x = -Math.PI / 2; lane.position.y = 0.02; lane.receiveShadow = true; s.add(lane);
    // bordür taşları
    const curb = std('#cfc9bd', 0.9);
    [-4.2, 4.2].forEach((z) => box(220, 0.12, 0.35, curb, 0, 0.06, z, s));
    const white = std('#e8e6df', 0.8);
    [-3.75, 3.75].forEach((z) => {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(220, 0.16), white);
      l.rotation.x = -Math.PI / 2; l.position.set(0, 0.03, z); s.add(l);
    });
    const stop = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 7.4), white);
    stop.rotation.x = -Math.PI / 2; stop.position.set(-6.2, 0.03, 0); s.add(stop);

    // Kantar platformu
    box(12.4, 0.14, 3.6, std('#7c858b', 0.45, 0.55), 1, 0.07, 0, s);
    const hz = std('#ffffff', 0.6, 0.1, { map: art.hazardTexture() });
    [-1.86, 1.86].forEach((z) => box(12.4, 0.16, 0.2, hz, 1, 0.08, z, s));

    // Beton bariyerler
    // New Jersey profili: geniş taban, eğimli yanlar, dar tepe
    const prof = new THREE.Shape();
    prof.moveTo(-0.3, 0); prof.lineTo(0.3, 0); prof.lineTo(0.3, 0.08); prof.lineTo(0.2, 0.26);
    prof.lineTo(0.1, 0.8); prof.lineTo(-0.1, 0.8); prof.lineTo(-0.2, 0.26); prof.lineTo(-0.3, 0.08); prof.closePath();
    const jersey = new THREE.ExtrudeGeometry(prof, { depth: 3.0, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 1 });
    { // UV: u = uzunluk boyunca, v = yükseklik (doku bandı yatay dursun)
      const p = jersey.attributes.position, uv = jersey.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) / 3.0, p.getY(i) / 0.8);
      uv.needsUpdate = true;
    }
    jersey.translate(0, 0, -1.5); jersey.rotateY(Math.PI / 2);
    const conc = std('#ffffff', 0.92, 0, { map: art.barrierTexture() });
    for (let x = -40; x <= 40; x += 3.15) {
      if (x > -3.5 && x < 0.5) continue;
      const b = new THREE.Mesh(jersey, conc); b.position.set(x, 0, -5.4); b.rotation.y = (Math.random() - 0.5) * 0.03;
      b.castShadow = true; b.receiveShadow = true; s.add(b);
    }
    // Aydınlatma direkleri
    const pole = std('#5d666d', 0.5, 0.6);
    [-20, -8, 8, 20].forEach((x) => {
      const p = cyl(0.12, 0.16, 8, 8, pole, s); p.position.set(x, 4, -6.4);
      box(0.12, 0.12, 2.2, pole, x, 7.9, -5.4, s);
      box(0.7, 0.18, 0.5, std('#fff4d8', 0.4, 0, { emissive: '#ffe7b0', emissiveIntensity: 0.4 }), x, 7.8, -4.4, s);
    });
  }

  buildGate() {
    const s = this.scene;
    // Bariyer
    const yellow = std('#e9b320', 0.5, 0.2);
    box(0.55, 1.3, 0.55, yellow, -7.4, 0.65, 4.4, s);
    box(0.7, 0.45, 0.8, std('#2a2f33', 0.6, 0.3), -7.4, 1.25, 4.4, s);
    this.barrier = new THREE.Group();
    this.barrier.position.set(-7.4, 1.25, 4.0);
    s.add(this.barrier);
    const red = std('#c6402f', 0.5), wht = std('#f3f1ea', 0.5);
    for (let i = 0; i < 10; i++) box(0.14, 0.16, 0.82, i % 2 ? wht : red, 0, 0, -(i + 0.5) * 0.82, this.barrier);
    box(0.12, 1.0, 0.12, yellow, -7.4, 0.5, -4.6, s);

    // Kantar LED ekranı
    const dark = std('#1d2226', 0.6, 0.4);
    const p = cyl(0.14, 0.14, 4.2, 10, dark, s); p.position.set(-1.6, 2.1, -4.7);
    this.led = art.makeLed();
    const ledMat = new THREE.MeshBasicMaterial({ map: this.led.texture, toneMapped: false, color: new THREE.Color(3.3, 3.3, 3.3) });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.34, 0.2), [dark, dark, dark, dark, ledMat, dark]);
    panel.position.set(-1.6, 4.4, -4.7); panel.castShadow = true; s.add(panel);

    // Kulübe
    const wall = std('#e6e0d3', 0.85), glass = std('#22343f', 0.12, 0.6), roof = std('#1f3a4c', 0.6, 0.2);
    const booth = new THREE.Group(); booth.position.set(-9.6, 0, 7.2); s.add(booth);
    box(3.4, 1.4, 3.0, wall, 0, 0.7, 0, booth);
    box(3.44, 1.2, 3.04, glass, 0, 2.0, 0, booth);
    box(3.4, 0.25, 3.0, wall, 0, 2.72, 0, booth);
    box(4.2, 0.22, 3.8, roof, 0, 2.95, 0, booth);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: art.signTexture(), toneMapped: false }));
    sign.position.set(0, 3.55, 1.0); booth.add(sign);
    box(3.4, 0.1, 0.1, roof, 0, 3.12, 1.0, booth);
  }

  buildYard() {
    const geo = new THREE.BoxGeometry(6, 2.6, 2.44);
    const mat = std('#ffffff', 0.75, 0.15, { map: art.yardCorrugated() });
    const slots = [];
    for (let row = 0; row < 7; row++) {
      const z = -13 - row * 3.0;
      for (let x = -52; x <= 52; x += 6.4) {
        if (Math.random() < (row < 2 ? 0.3 : 0.12)) continue;
        const h = 1 + Math.floor(Math.random() * (row < 2 ? 2 : 5));
        for (let k = 0; k < h; k++) slots.push([x + (Math.random() - 0.5) * 0.15, 1.3 + k * 2.6, z]);
      }
    }
    const mesh = new THREE.InstancedMesh(geo, mat, slots.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    slots.forEach(([x, y, z], i) => {
      m4.makeTranslation(x, y, z); mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, col.set(YARD_COLORS[Math.floor(Math.random() * YARD_COLORS.length)]));
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Saha vinci (RTG)
    const y = std('#e3b12b', 0.5, 0.3);
    const rtg = new THREE.Group(); rtg.position.set(16, 0, -20); this.scene.add(rtg);
    [[-3.6, -11], [-3.6, 11], [3.6, -11], [3.6, 11]].forEach(([x, z]) => box(0.7, 16, 0.7, y, x, 8, z, rtg));
    [-11, 11].forEach((z) => box(8, 0.6, 0.8, y, 0, 0.6, z, rtg));
    [-3.6, 3.6].forEach((x) => box(0.9, 1.1, 23, y, x, 16.4, 0, rtg));
    box(2.4, 1.6, 2, std('#d8dde0', 0.5), 0, 15.6, -4, rtg);
  }

  buildPort() {
    const s = this.scene;
    // Rıhtım
    box(700, 1.6, 6, std('#a39b8f', 0.95), 0, -0.2, -40, s);
    const boll = std('#2d3135', 0.5, 0.5);
    for (let x = -80; x <= 80; x += 10) { const b = cyl(0.25, 0.3, 0.6, 8, boll, s); b.position.set(x, 0.9, -42.4); }

    // STS vinçleri
    const cw = std('#dde3e6', 0.55, 0.25), cr = std('#b94a3a', 0.5, 0.2);
    [-42, -8, 26].forEach((x, i) => {
      const c = new THREE.Group(); c.position.set(x, 0, -38); s.add(c);
      [[-6, -4], [6, -4], [-6, 8], [6, 8]].forEach(([lx, lz]) => box(1, 26, 1, cw, lx, 13, lz, c));
      [-4, 8].forEach((z) => box(13, 1, 1, cw, 0, 22, z, c));
      [-6, 6].forEach((lx) => { box(1, 1, 14, cw, lx, 22, 2, c); box(0.8, 0.8, 13, cw, lx, 10, 2, c); });
      box(13, 1.8, 2.2, cw, 0, 28, 2, c);
      box(3, 2.2, 70, cw, 0, 30, -22, c);
      box(5, 3.5, 6, cr, 0, 32.6, 10, c);
      box(2.4, 1.8, 2.4, cr, 0, 27.6, -14 - i * 7, c);
      [[-1.2, 1], [1.2, 1]].forEach(([lx]) => box(0.6, 18, 0.6, cw, lx, 39, 6, c));
      const tie = box(0.25, 0.25, 50, cw, 0, 36, -20, c); tie.rotation.x = -0.17;
    });

    // Deniz
    const seaGeo = new THREE.PlaneGeometry(1200, 520, 96, 40);
    this.sea = new THREE.Mesh(seaGeo, std('#2f7f8e', 0.32, 0.15, { flatShading: true }));
    this.sea.rotation.x = -Math.PI / 2; this.sea.position.set(0, -0.9, -300);
    this.sea.receiveShadow = true; s.add(this.sea);
    this.seaBase = Float32Array.from(seaGeo.attributes.position.array);

    // Gemi
    this.ship = new THREE.Group(); this.ship.position.set(14, 0, -78); s.add(this.ship);
    box(96, 8, 17, std('#22364b', 0.6, 0.2), 0, 3.2, 0, this.ship);
    box(96.4, 2.4, 17.4, std('#9e3529', 0.7), 0, -0.4, 0, this.ship);
    box(11, 15, 16, std('#eeeae0', 0.6), -40, 14.5, 0, this.ship);
    box(11.5, 1.2, 17, std('#22364b', 0.6), -40, 19, 0, this.ship);
    box(4, 6, 4, std('#c8432f', 0.6), -46, 22, 0, this.ship);
    const shipGeo = new THREE.BoxGeometry(6, 2.6, 2.44);
    const cont = new THREE.InstancedMesh(shipGeo, std('#ffffff', 0.75, 0.15, { map: art.yardCorrugated() }), 12 * 6 * 4);
    let n = 0; const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < 12; i++) for (let j = 0; j < 6; j++) {
      const h = 1 + Math.floor(Math.random() * 4);
      for (let k = 0; k < h; k++) {
        m4.makeTranslation(-26 + i * 6.3, 8.5 + k * 2.6, -6.3 + j * 2.52);
        cont.setMatrixAt(n, m4); cont.setColorAt(n, col.set(YARD_COLORS[Math.floor(Math.random() * YARD_COLORS.length)])); n++;
      }
    }
    cont.count = n; cont.castShadow = true; this.ship.add(cont);

    // Uzak Beydağları: gölgesiz, pusa karışan iki katman silüet (hava perspektifi).
    const ridgeLayer = (z, base, amp, color, seed) => {
      const pts = [], W = 2400, N = 90;
      for (let i = 0; i <= N; i++) {
        const x = -W / 2 + (i / N) * W, u = i / N * 6.283 + seed;
        const y = base + amp * (0.55 * Math.sin(u * 1.3) + 0.3 * Math.sin(u * 3.7 + 1.1) + 0.15 * Math.sin(u * 9.1 + 2.3));
        pts.push(x, Math.max(0, y));
      }
      const shape = new THREE.Shape();
      shape.moveTo(-W / 2, -20);
      for (let i = 0; i < pts.length; i += 2) shape.lineTo(pts[i], pts[i + 1]);
      shape.lineTo(W / 2, -20);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, fog: false, toneMapped: true }));
      m.position.set(0, -6, z);
      s.add(m);
    };
    ridgeLayer(-760, 70, 55, '#c9bfcb', 0.4);
    ridgeLayer(-640, 38, 34, '#ad9fb2', 2.1);
  }

  buildBirds() {
    this.birds = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.9, 0.15, 0, 0, 0, 0.12, 0, 0, -0.12, 0.9, 0.15, 0, 0, 0, 0.12, 0, 0, -0.12], 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: '#f5f2ea', side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(geo, mat);
      b.userData = { r: 18 + Math.random() * 18, sp: 0.15 + Math.random() * 0.12, ph: Math.random() * 6, y: 14 + Math.random() * 8, cx: -10 + Math.random() * 30, cz: -30 - Math.random() * 20 };
      this.scene.add(b); this.birds.push(b);
    }
  }

  buildSmoke() {
    const mat = new THREE.SpriteMaterial({ map: art.softDot(), color: '#4a4744', transparent: true, depthWrite: false, opacity: 0 });
    for (let i = 0; i < 36; i++) {
      const sp = new THREE.Sprite(mat.clone()); sp.visible = false;
      sp.userData = { life: 0 };
      this.scene.add(sp); this.smoke.push(sp);
    }
    this.smokeTimer = 0;
  }

  // ---------------- Kamyon modeli ----------------
  buildTruck(t) {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    const paint = std(t.firm.renk, 0.42, 0.3);
    const cabPaint = std('#ece8de', 0.4, 0.2);
    const dark = std('#1c2024', 0.75, 0.3), chrome = std('#d4d9dd', 0.22, 0.9);
    const glass = std('#15232c', 0.08, 0.7);
    const interior = std('#4a4740', 0.9, 0.1);
    const v = t.vehicle.id;

    // Kabin (ön tarafı -X): yuvarlatılmış gövde, firma renginde alt etek
    rbox(2.3, 2.3, 2.45, 0.14, cabPaint, -3.35, 2.25, 0, body);
    rbox(2.38, 0.62, 2.52, 0.08, paint, -3.35, 1.27, 0, body);
    // Ön cam: koyu çerçeve + hafif öne eğik cam
    rbox(0.08, 1.06, 2.22, 0.05, dark, -4.47, 2.86, 0, body);
    const ws = box(0.04, 0.94, 2.08, glass, -4.5, 2.86, 0, body); ws.rotation.z = -0.04;
    box(0.03, 0.9, 0.04, dark, -4.52, 2.86, 0, body); // orta direk
    // Yan camlar ve kapı detayları
    [-1, 1].forEach((sd) => {
      rbox(1.08, 0.8, 0.05, 0.03, dark, -3.95, 2.86, sd * 1.226, body);
      box(1.0, 0.72, 0.03, glass, -3.95, 2.86, sd * 1.24, body);
      box(0.012, 1.55, 0.03, dark, -3.35, 2.15, sd * 1.24, body);        // kapı aralığı
      box(0.16, 0.05, 0.05, chrome, -3.52, 2.3, sd * 1.255, body);       // kapı kolu
      box(1.7, 0.1, 0.03, paint, -3.4, 1.9, sd * 1.245, body);           // kapı şeridi
      // basamaklar
      box(0.5, 0.05, 0.28, chrome, -3.6, 0.9, sd * 1.32, body);
      box(0.5, 0.05, 0.22, chrome, -3.6, 0.55, sd * 1.3, body);
      // ayna kolu + ayna
      box(0.32, 0.04, 0.04, dark, -4.32, 2.95, sd * 1.36, body);
      rbox(0.1, 0.52, 0.24, 0.04, dark, -4.22, 2.82, sd * 1.53, body);
      box(0.012, 0.44, 0.18, std('#9fb4c0', 0.05, 0.9), -4.275, 2.82, sd * 1.53, body);
    });
    // Izgara, farlar, tampon
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.78), std('#ffffff', 0.35, 0.7, { map: art.grilleTexture() }));
    grille.rotation.y = -Math.PI / 2; grille.position.set(-4.53, 1.76, 0); body.add(grille);
    const head = std('#fff3d2', 0.3, 0, { emissive: '#ffe9b8', emissiveIntensity: 7 });
    const lens = std('#cfd8de', 0.05, 0.6);
    [-0.9, 0.9].forEach((z) => {
      rbox(0.1, 0.26, 0.5, 0.04, dark, -4.52, 1.3, z, body);
      box(0.04, 0.18, 0.4, head, -4.56, 1.3, z, body);
      box(0.03, 0.06, 0.16, std('#f0a020', 0.4, 0, { emissive: '#ff9a1a', emissiveIntensity: 1.5 }), -4.57, 1.3, z + Math.sign(z) * 0.32, body); // sinyal
    });
    rbox(0.32, 0.34, 2.6, 0.08, dark, -4.6, 0.92, 0, body);                // tampon
    [-0.95, 0.95].forEach((z) => { const f = cyl(0.07, 0.07, 0.04, 14, lens, body); f.rotation.z = Math.PI / 2; f.position.set(-4.77, 0.92, z); });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.21), new THREE.MeshStandardMaterial({ map: art.plateTexture(t.plate), roughness: 0.5 }));
    plate.rotation.y = -Math.PI / 2; plate.position.set(-4.77, 0.93, 0); body.add(plate);
    // Tavan: rüzgar deflektörü, güneşlik, turuncu işaret lambaları
    const defl = rbox(1.5, 0.5, 2.3, 0.12, cabPaint, -2.95, 3.62, 0, body); defl.rotation.z = 0.2;
    rbox(1.1, 0.12, 2.5, 0.04, paint, -3.6, 3.43, 0, body);
    const marker = std('#ffb347', 0.4, 0, { emissive: '#ff9a1a', emissiveIntensity: 3.5 });
    for (let i = 0; i < 5; i++) box(0.06, 0.06, 0.12, marker, -4.13, 3.52, -0.8 + i * 0.4, body);
    // Yakıt deposu/yan etek (dizel deposu ayrıca eklenir) ve hava tankı
    [-1, 1].forEach((sd) => { const at = cyl(0.14, 0.14, 0.9, 12, chrome, body); at.rotation.z = Math.PI / 2; at.position.set(-1.6, 0.85, sd * 0.68); });

    // Şasi
    box(10.5, 0.3, 1.0, dark, 0.75, 0.9, 0, body);

    // Konteyner (içi boş; kapılar açılınca sandıklar görünür)
    const sideTex = art.containerSide(t.firm, t.code);
    const sideMat = std('#ffffff', 0.6, 0.2, { map: sideTex });
    const cx = 2.1, cy = 2.45;
    box(8, 0.08, 2.5, interior, cx, 1.19, 0, body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 2.5), [paint, paint, paint, interior, paint, paint]);
    roof.position.set(cx, 3.71, 0); roof.castShadow = true; body.add(roof);
    box(0.08, 2.6, 2.5, paint, -1.86, cy, 0, body);
    const rWall = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 0.06), [paint, paint, paint, paint, sideMat, interior]);
    rWall.position.set(cx, cy, 1.22); rWall.castShadow = true; rWall.receiveShadow = true; body.add(rWall);
    const lWall = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 0.06), [paint, paint, paint, paint, interior, sideMat]);
    lWall.position.set(cx, cy, -1.22); lWall.castShadow = true; body.add(lWall);
    const post = std(t.firm.renk, 0.6, 0.3); post.color.multiplyScalar(0.7);
    [[-1.9, 1.25], [-1.9, -1.25], [6.1, 1.25], [6.1, -1.25]].forEach(([x, z]) => box(0.14, 2.66, 0.14, post, x, cy, z, body));
    box(8.1, 0.18, 2.56, post, cx, 1.15, 0, body);
    box(0.12, 0.2, 2.56, post, 6.1, 3.7, 0, body);
    const casting = std('#2b2f33', 0.7, 0.4);
    [-1.93, 6.13].forEach((x) => [1.15, 3.75].forEach((y) => [-1.27, 1.27].forEach((z) => box(0.2, 0.16, 0.16, casting, x, y, z, body))));
    const pickables = [rWall, lWall, roof];

    // Kapılar
    const doors = [];
    [[1.25, -1], [-1.25, 1]].forEach(([hz, dir], i) => {
      const hinge = new THREE.Group(); hinge.position.set(6.12, cy, hz); body.add(hinge);
      const dm = std('#ffffff', 0.6, 0.2, { map: art.containerDoor(t.firm, t.code, i === 0) });
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.56, 1.24), [dm, interior, paint, paint, paint, paint]);
      door.position.set(0, 0, dir * 0.62); door.castShadow = true; hinge.add(door);
      [0.3, 0.85].forEach((o) => { const r = cyl(0.035, 0.035, 2.5, 6, chrome, hinge); r.position.set(0.07, 0, dir * o); });
      box(0.08, 0.12, 0.3, chrome, 0.09, -0.3, dir * 0.95, hinge);
      hinge.userData.dir = dir;
      doors.push(hinge); pickables.push(door);
    });

    // Sandıklar (kapı tarafından başlayarak doldurulur)
    const crates = new THREE.Group(); body.add(crates);
    const woodMat = std('#ffffff', 0.85, 0, { map: art.woodTexture() });
    const label = std('#ffffff', 0.8, 0, { map: art.crateLabel(t.cargo.product) });
    const crateGeo = new THREE.BoxGeometry(1.05, 1.02, 1.08);
    const crateMeshes = [];
    const n = Math.min(t.cargo.tons, 24);
    for (let i = 0; i < n; i++) {
      const depth = Math.floor(i / 4), level = Math.floor((i % 4) / 2), side = i % 2;
      const c = new THREE.Mesh(crateGeo, [label, woodMat, woodMat, woodMat, label, label]);
      c.position.set(5.45 - depth * 1.15, 1.75 + level * 1.06, side ? 0.58 : -0.58);
      c.rotation.y = (Math.random() - 0.5) * 0.06;
      c.castShadow = true; c.receiveShadow = true;
      c.userData = { crate: true, baseY: c.position.y, product: t.cargo.product };
      crates.add(c); crateMeshes.push(c);
    }
    const lamp = new THREE.PointLight(0xffe0b0, 0, 10, 1.4);
    lamp.position.set(7.2, 3.0, 0); body.add(lamp);

    // Tekerlekler
    const wheels = [];
    const tire = std('#161718', 0.9), hub = std('#b9bfc4', 0.3, 0.8), hubDark = std('#3a3f44', 0.6, 0.5);
    const tireGeo = new THREE.TorusGeometry(0.4, 0.13, 10, 28); // yuvarlak lastik omzu
    [-3.5, 3.6, 4.8].forEach((x) => [-1.08, 1.08].forEach((z) => {
      const w = new THREE.Group(); w.position.set(x, 0.52, z); g.add(w);
      const tm = cyl(0.5, 0.5, 0.34, 28, tire, w); tm.rotation.x = Math.PI / 2;
      [-0.12, 0.12].forEach((o) => { const tr = new THREE.Mesh(tireGeo, tire); tr.position.z = o; tr.castShadow = true; w.add(tr); });
      const hm = cyl(0.27, 0.27, 0.38, 20, hub, w); hm.rotation.x = Math.PI / 2;
      const hc = cyl(0.1, 0.12, 0.42, 12, hubDark, w); hc.rotation.x = Math.PI / 2;
      const side = Math.sign(z);
      for (let k = 0; k < 8; k++) { // bijonlar
        const a = (k / 8) * Math.PI * 2;
        const nut = cyl(0.022, 0.022, 0.03, 6, hubDark, w); nut.rotation.x = Math.PI / 2;
        nut.position.set(Math.cos(a) * 0.18, Math.sin(a) * 0.18, side * 0.2);
      }
      wheels.push(w);
    }));
    [3.6, 4.8].forEach((x) => box(1.3, 0.06, 2.6, dark, x, 1.1, 0, body)); // çamurluk

    // Araç tipine göre görsel ipuçları
    let exhaust = null;
    if (v === 'dizel') {
      const st = cyl(0.1, 0.1, 2.5, 10, chrome, body); st.position.set(-2.05, 2.6, 1.08);
      const cap = cyl(0.13, 0.1, 0.2, 10, dark, body); cap.position.set(-2.05, 3.9, 1.08);
      const tank = cyl(0.32, 0.32, 1.1, 14, chrome, body); tank.rotation.z = Math.PI / 2; tank.position.set(-2.6, 0.82, 1.08);
      exhaust = V(-2.05, 4.0, 1.08);
    } else if (v === 'lng') {
      const tm = std('#8cc4e6', 0.35, 0.3);
      [-1.05, 1.05].forEach((z) => {
        const tk = cyl(0.42, 0.42, 2.8, 18, tm, body); tk.rotation.z = Math.PI / 2; tk.position.set(0.3, 0.9, z);
        [-0.8, 0.8].forEach((o) => { const b = cyl(0.44, 0.44, 0.1, 18, std('#ffffff', 0.5), body); b.rotation.z = Math.PI / 2; b.position.set(0.3 + o, 0.9, z); });
      });
    } else {
      const bm = std('#2a2f34', 0.5, 0.4), glow = std('#4ade80', 0.4, 0, { emissive: '#3ddc84', emissiveIntensity: 3.2 });
      [-1, 1].forEach((sd) => {
        box(2.8, 0.62, 0.42, bm, 0.3, 0.9, sd * 0.98, body);
        box(2.8, 0.07, 0.02, glow, 0.3, 1.0, sd * 1.2, body);
        box(1.7, 0.1, 0.03, glow, -3.4, 1.72, sd * 1.24, body);
      });
    }

    g.traverse((o) => { if (o.isMesh) o.userData.truck = true; });
    return { group: g, body, doors, wheels, crates: crateMeshes, lamp, exhaust, pickables, opened: false };
  }

  // ---------------- Kamyon olayları ----------------
  async spawnTruck(t, onLevel) {
    if (this.truck) this.scene.remove(this.truck.group);
    this.truck = this.buildTruck(t);
    const T = this.truck;
    T.group.position.x = 48;
    this.scene.add(T.group);
    let prev = 48;
    await tween(3.8, (k) => {
      const x = 48 * (1 - k);
      this.rollWheels(x - prev); prev = x;
      T.group.position.x = x;
      onLevel?.(1 - k);
    }, Ease.outCubic);
    // fren: burun dalışı + küçük sarsıntı
    this.trauma.add(0.32);
    await tween(0.14, (k) => { T.body.rotation.z = 0.022 * k; }, Ease.outCubic);
    tween(0.6, (k) => { T.body.rotation.z = 0.022 * (1 - k); }, Ease.outBack);
  }

  rollWheels(dx) {
    if (!this.truck) return;
    for (const w of this.truck.wheels) w.rotation.z -= dx / 0.52;
  }

  async weigh(tons, onTick) {
    let last = -1;
    await tween(1.3, (k) => {
      const v = Math.round(tons * k * 10) / 10;
      const shown = (k < 1 ? v + (Math.random() - 0.5) * 0.6 : tons).toFixed(1).replace('.', ',');
      this.led.set(shown, k < 1 ? 'Tartılıyor' : 'Net yük, ton');
      this.deskLed?.set(shown, k < 1 ? 'Tartılıyor' : 'Net yük, ton');
      const step = Math.floor(k * 14);
      if (step !== last) { last = step; onTick?.(k >= 1); }
    }, Ease.outCubic);
    return tons;
  }

  async openDoors() {
    const T = this.truck; if (!T || T.opened) return;
    T.opened = true;
    tween(1.0, (k) => { T.lamp.intensity = 3.2 * k; }, Ease.outCubic);
    await tween(1.1, (k) => {
      T.doors.forEach((h) => { h.rotation.y = -h.userData.dir * 0.9 * Math.PI * k * -1; });
    }, Ease.outBack);
    this.trauma.add(0.12);
  }

  async closeDoorsQuick() {
    const T = this.truck; if (!T || !T.opened) return;
    const start = T.doors.map((h) => h.rotation.y);
    await tween(0.6, (k) => { T.doors.forEach((h, i) => { h.rotation.y = start[i] * (1 - k); }); T.lamp.intensity = 3.2 * (1 - k); }, Ease.inOutCubic);
    T.opened = false;
  }

  moveCam(view, dur = 1.1) {
    const from = { p: this.cam.pos.clone(), t: this.cam.target.clone() };
    const to = VIEWS[view];
    return tween(dur, (k) => {
      this.cam.pos.lerpVectors(from.p, to.pos, k);
      this.cam.target.lerpVectors(from.t, to.target, k);
    }, Ease.inOutCubic);
  }

  async leaveThroughGate(onLevel) {
    const T = this.truck;
    await tween(1.0, (k) => { this.barrier.rotation.x = 1.45 * k; }, Ease.inOutCubic);
    let prev = 0;
    await tween(3.2, (k) => {
      const x = -75 * k; this.rollWheels(x - prev); prev = x; T.group.position.x = x; onLevel?.(0.3 + k * 0.7);
    }, Ease.inCubic);
    this.scene.remove(T.group); this.truck = null;
    await tween(0.9, (k) => { this.barrier.rotation.x = 1.45 * (1 - k); }, Ease.inOutCubic);
  }

  async reverseOut(onLevel) {
    const T = this.truck;
    let prev = 0;
    await tween(3.4, (k) => {
      const x = 55 * k; this.rollWheels(x - prev); prev = x; T.group.position.x = x; onLevel?.(0.3 + k * 0.5);
    }, Ease.inQuad);
    this.scene.remove(T.group); this.truck = null;
  }

  shake(a) { this.trauma.add(a); }
  hitStop(ms) { if (settings.motion) this.frozen = ms / 1000; }
  resetLed() { this.led.set('– –', 'Kantar boş'); this.deskLed?.set('– –', 'Kantar boş'); }

  leaveTitle(dur = 2.6) {
    this.cam.pos.copy(this.camera.position);
    this.cam.target.copy(this.titleTarget || VIEWS.booth.target);
    this.title = false;
    return this.moveCam('booth', dur);
  }

  // ---------------- Etkileşim ----------------
  onPointer(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.ndc.set(this.mouse.x, this.mouse.y);
    this.lastPointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    this.pick();
  }

  pick() {
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (this.rig?.visible && this.deskActive && this.rig.position.y > -0.05) {
      const targets = [this.tabletScreen, ...Object.values(this.papers)];
      for (const b of Object.values(this.buttons)) if (b.enabled) targets.push(b.cap);
      const dh = this.raycaster.intersectObjects(targets, false)[0];
      if (dh) {
        const a = dh.object.userData.action;
        const up = a.startsWith('paper:') && this.papers[a.slice(6)]?.userData.up;
        const BTN_TIP = { onay: 'Geçiş ver <kbd>1</kbd>', vergi: 'Vergi kes <kbd>2</kbd>', ret: 'Geri çevir <kbd>3</kbd>', inspect: 'Kasayı aç <kbd>E</kbd>' };
        const tip = a.startsWith('paper:') ? (up ? 'Masaya bırak <kbd>Q</kbd>' : `${dh.object.userData.tip} <kbd>Q</kbd>`)
          : a === 'tablet' ? `${dh.object.userData.tip} <kbd>F</kbd>` : BTN_TIP[a];
        return this.setHover({ type: 'desk', action: a, tip });
      }
    }
    if (!this.truck || !this.interactive) return this.setHover(null);
    const targets = this.truck.opened ? this.truck.crates : this.truck.pickables;
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit) return this.setHover(null);
    if (this.truck.opened) this.setHover({ type: 'crate', obj: hit.object, product: hit.object.userData.product });
    else this.setHover({ type: 'container' });
  }

  setHover(h) {
    const prev = this.hover;
    if (prev?.obj && prev.obj !== h?.obj) prev.obj.userData.lift = 0;
    if (h?.obj) h.obj.userData.lift = 1;
    this.hover = h;
    this.renderer.domElement.style.cursor = h ? 'pointer' : '';
    this.handlers.hover(h, this.lastPointer);
  }

  onClick(e) {
    this.onPointer(e);
    if (this.hover?.type === 'container') this.handlers.containerClick();
    else if (this.hover?.type === 'desk') this.handlers.desk?.(this.hover.action);
  }

  // ---------------- Döngü ----------------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    if (this.frozen > 0) { this.frozen -= dt; dt = 0; }
    this.time += dt;
    updateTweens(dt);
    const t = this.time;

    // Deniz
    if (this.sea && (this.frame = (this.frame || 0) + 1) % 2 === 0) {
      const pos = this.sea.geometry.attributes.position, b = this.seaBase;
      for (let i = 0; i < pos.count; i++) {
        const x = b[i * 3], y = b[i * 3 + 1];
        pos.array[i * 3 + 2] = Math.sin(x * 0.045 + t * 0.7) * 0.35 + Math.cos(y * 0.06 + t * 0.5) * 0.3;
      }
      pos.needsUpdate = true;
      this.sea.geometry.computeVertexNormals();
    }
    this.ship.position.y = Math.sin(t * 0.4) * 0.12;
    this.ship.rotation.x = Math.sin(t * 0.33) * 0.004;

    for (const b of this.birds) {
      const u = b.userData, a = t * u.sp + u.ph;
      b.position.set(u.cx + Math.cos(a) * u.r, u.y + Math.sin(a * 2) * 0.6, u.cz + Math.sin(a) * u.r);
      b.rotation.y = -a;
      b.scale.y = 0.6 + Math.sin(t * 9 + u.ph) * 0.6;
    }

    // Duman
    if (this.truck?.exhaust && dt > 0) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.16;
        const sp = this.smoke.find((s) => !s.visible);
        if (sp) {
          const p = this.truck.exhaust.clone(); this.truck.body.localToWorld(p);
          sp.position.copy(p); sp.visible = true; sp.userData.life = 0; sp.scale.setScalar(0.35);
        }
      }
    }
    for (const sp of this.smoke) {
      if (!sp.visible) continue;
      const u = sp.userData; u.life += dt;
      sp.position.y += dt * 1.1; sp.position.x += dt * 1.6; sp.position.z -= dt * 0.4;
      sp.scale.setScalar(0.3 + u.life * 1.5);
      sp.material.opacity = Math.max(0, 0.28 * (1 - u.life / 2.2));
      if (u.life > 2.2) sp.visible = false;
    }

    // Konsol düğmeleri: üzerine gelince parlar
    if (this.buttons) for (const [n, b] of Object.entries(this.buttons)) {
      const target = b.locked ? 0 : !b.enabled ? 0.05 : this.hover?.action === n ? 1.0 : 0.4 + Math.sin(t * 3) * 0.06;
      b.capMat.emissiveIntensity += (target - b.capMat.emissiveIntensity) * Math.min(1, dt * 12);
      b.topMat.emissiveIntensity = b.capMat.emissiveIntensity * 0.6;
    }
    for (const p of Object.values(this.papers || {})) {
      // Yeni gelen kağıt kısa süre nabız gibi parlar: "bana tıkla"
      if (p.userData.glow > 0) {
        p.userData.glow = p.userData.up ? 0 : p.userData.glow - dt;
        p.material.emissiveIntensity = Math.max(0, 0.22 * (0.5 + 0.5 * Math.sin(t * 7)) * Math.min(1, p.userData.glow));
      }
      if (p.userData.up || p.userData.busy) continue;
      const base = p === this.papers.decl ? 0.009 : 0.006, tgt = base + (this.hover?.action === p.userData.action ? 0.012 : 0);
      p.position.y += (tgt - p.position.y) * Math.min(1, dt * 14);
    }

    // Sandık hover
    if (this.truck) for (const c of this.truck.crates) {
      const target = c.userData.baseY + (c.userData.lift ? 0.07 : 0);
      c.position.y += (target - c.position.y) * Math.min(1, dt * 14);
    }

    // Kamera
    let pos, target;
    if (this.title) {
      const a = 0.45 + Math.sin(t * 0.045) * 0.55;
      pos = V(Math.sin(a) * 60, 30 + Math.sin(t * 0.2) * 1.5, -6 + Math.cos(a) * 60);
      target = V(-6, 6, -60);
      this.titleTarget = target;
    } else { pos = this.cam.pos; target = this.cam.target; }
    if (settings.motion) {
      this.par.x += (this.mouse.x - this.par.x) * Math.min(1, dt * 2.5);
      this.par.y += (this.mouse.y - this.par.y) * Math.min(1, dt * 2.5);
    } else { this.par.x = this.par.y = 0; }
    const sh = this.trauma.update(dt);
    this.camera.position.set(pos.x + this.par.x * 0.3 + sh.x, pos.y + this.par.y * 0.15 + sh.y, pos.z);
    this.camera.lookAt(target);
    this.camera.rotateZ(sh.r);

    if (this.composer) {
      this.grade.uniforms.time.value = (t * 60) % 1000;
      this.composer.render();
    } else this.renderer.render(this.scene, this.camera);
  }
}
